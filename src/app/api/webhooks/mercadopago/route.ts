import { NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/mercadopago/helpers'
import { createAdminClient } from '@/lib/supabase/server'
import { consumeLockedCredits } from '@/lib/credits/manager'
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

    // Seguridad: verificar firma. En producción, sin secreto configurado no
    // se puede verificar nada, así que se falla cerrado en vez de aceptar
    // el webhook sin validar (era el comportamiento anterior).
    const xSignature = request.headers.get('x-signature')
    const xRequestId = request.headers.get('x-request-id')
    const secret = process.env.MP_WEBHOOK_SECRET

    if (!xSignature || !xRequestId) {
      return NextResponse.json({ error: 'Missing security headers' }, { status: 403 })
    }
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        console.error('MP_WEBHOOK_SECRET no está configurada en producción — rechazando webhook.')
        return NextResponse.json({ error: 'Webhook signature verification not configured' }, { status: 500 })
      }
      console.warn('MP_WEBHOOK_SECRET no configurada: firma sin verificar (solo tolerado fuera de producción).')
    } else {
      const isValid = verifyWebhookSignature(xSignature, xRequestId, id, secret)
      if (!isValid) {
        return NextResponse.json({ error: 'Firma inválida' }, { status: 403 })
      }
    }

    // Inicializar MP
    const client = new MercadoPagoConfig({ 
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || 'TEST-dummy-token' 
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
      const supabase = createAdminClient()
      
      const { data: currentBooking } = await supabase.from('bookings').select('payment_status').eq('id', bookingId).single()
      if (currentBooking && currentBooking.payment_status === 'paid') {
         return NextResponse.json({ success: true, message: 'Already paid' }, { status: 200 })
      }

      const { data: booking, error } = await supabase.from('bookings')
        .update({
          payment_status: 'paid',
          status: 'confirmed'
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
        // Consumir créditos bloqueados
        await consumeLockedCredits(bookingId).catch(console.error)
        
        const { notify } = await import('@/lib/notifications')
        const { waitUntil } = await import('@vercel/functions')
        waitUntil(
          notify('booking_confirmed', { 
            booking, 
            user: booking.profiles, 
            venue: booking.courts?.venues 
          }).catch(console.error)
        )
      }
      
      console.log(`✅ [Webhook MP] Reserva ${bookingId} confirmada.`)
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: unknown) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: 'Internal error processing webhook' }, { status: 500 })
  }
}
