/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/mercadopago/helpers'
import { createClient } from '@/lib/supabase/server'
import { Payment } from 'mercadopago'
import { MercadoPagoConfig } from 'mercadopago'

export async function POST(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams
    const topic = searchParams.get('topic') || searchParams.get('type')
    const id = searchParams.get('data.id') || searchParams.get('id')
    
    // Si no es un evento de pago, retornamos 200 rápido (ignoramos)
    if (topic !== 'payment' || !id) {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // Seguridad: verificar firma (Opcional en dev, recomendado en prod)
    const xSignature = request.headers.get('x-signature')
    const xRequestId = request.headers.get('x-request-id')
    const secret = process.env.MP_WEBHOOK_SECRET

    if (secret && xSignature && xRequestId) {
      const isValid = verifyWebhookSignature(xSignature, xRequestId, id, secret)
      if (!isValid) {
        return NextResponse.json({ error: 'Firma inválida' }, { status: 403 })
      }
    }

    // Inicializar MP
    const client = new MercadoPagoConfig({ 
      accessToken: process.env.MP_ACCESS_TOKEN || 'TEST-dummy-token' 
    })
    const payment = new Payment(client)
    
    // Obtener detalles reales del pago
    const paymentData = await payment.get({ id })
    
    // Validar status
    if (paymentData.status === 'approved') {
      const bookingId = paymentData.external_reference
      if (!bookingId) {
        throw new Error('Pago aprobado pero no tiene external_reference (bookingId)')
      }

      // Actualizar en DB usando el client del servidor
      const supabase = await createClient()
      
      const { data: booking, error } = await (supabase.from('bookings') as any)
        .update({ 
          payment_status: 'paid',
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .select('*, profiles(*), courts(*, venues(*))')
        .single()

      if (error) {
        console.error('Error actualizando booking en Supabase:', error)
        throw error
      }
      
      // Notificaciones
      if (booking) {
        const { notify } = await import('@/lib/notifications')
        await notify('booking_confirmed', { 
          booking, 
          user: booking.profiles, 
          venue: booking.courts?.venues 
        })
      }
      
      console.log(`✅ [Webhook MP] Reserva ${bookingId} confirmada.`)
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
