import { NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/mercadopago/helpers'
import { createAdminClient } from '@/lib/supabase/server'
import { consumeLockedCredits } from '@/lib/credits/manager'
import type { PaymentReconciliationReason } from '@/types/database'
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

      const { data: currentBooking } = await supabase.from('bookings')
        .select('id, status, payment_status, cancelled_reason, booking_date, start_time')
        .eq('id', bookingId)
        .maybeSingle()

      // Un pago aprobado que no tiene reserva es plata cobrada sin contraparte.
      // Devolvemos 200 igual: MP reintenta ante un 5xx y después se rinde, así
      // que dejarlo fallar solo esconde el problema en un loop de reintentos.
      // La fila en payment_reconciliations (migración 032) es lo que hace que
      // alguien se entere; el log queda como respaldo si el insert falla.
      const orphan = async (motivo: PaymentReconciliationReason) => {
        console.error(
          `🔴 [Webhook MP] PAGO HUÉRFANO — requiere reembolso manual. ` +
          `motivo=${motivo} payment_id=${paymentData.id} booking_id=${bookingId} ` +
          `monto=${paymentData.transaction_amount} payer=${paymentData.payer?.email ?? 'desconocido'}`
        )

        // onConflict sobre mp_payment_id: MP reintenta la notificación y no
        // queremos una fila por reintento. ignoreDuplicates deja intacta la
        // que ya esté, incluso si un admin la marcó resuelta.
        const { error: queueError } = await supabase
          .from('payment_reconciliations')
          .upsert({
            mp_payment_id: String(paymentData.id),
            booking_id: bookingId,
            reason: motivo,
            amount: paymentData.transaction_amount ?? null,
            payer_email: paymentData.payer?.email ?? null
          }, { onConflict: 'mp_payment_id', ignoreDuplicates: true })

        if (queueError) {
          // No escalamos: perder el encolado no debe transformarse en un 500 que
          // haga reintentar a MP. El console.error de arriba queda como rastro.
          console.error('No se pudo encolar el pago huérfano para reconciliación:', queueError)
        }

        return NextResponse.json({ received: true, reconcile: motivo }, { status: 200 })
      }

      if (!currentBooking) {
        return await orphan('reserva_inexistente')
      }

      if (currentBooking.payment_status === 'paid') {
        return NextResponse.json({ success: true, message: 'Already paid' }, { status: 200 })
      }

      if (currentBooking.status === 'cancelled') {
        // Solo se resucita lo que canceló el cron por vencimiento del embudo de
        // pago (ver migración 031). Si la canceló una persona, un pago que llega
        // después se reembolsa, no reactiva la reserva.
        if (currentBooking.cancelled_reason !== 'payment_timeout') {
          return await orphan('cancelada_a_proposito')
        }
        // Tampoco tiene sentido confirmar un turno que ya pasó.
        const slotStart = new Date(`${currentBooking.booking_date}T${currentBooking.start_time}`)
        if (Number.isNaN(slotStart.getTime()) || slotStart <= new Date()) {
          return await orphan('turno_ya_vencido')
        }
      }

      const { data: booking, error } = await supabase.from('bookings')
        .update({
          payment_status: 'paid',
          status: 'confirmed',
          mp_payment_id: String(paymentData.id),
          cancelled_at: null,
          cancelled_reason: null
        })
        .eq('id', bookingId)
        .select('*, profiles(*), courts(*, venues(*))')
        .single()

      if (error) {
        // 23505 = el índice parcial bookings_no_double_booking_idx (migración 008).
        // Mientras esta reserva estaba cancelada, otro usuario tomó el turno. La
        // base nos frena el overbooking; acá solo queda reembolsar.
        if (error.code === '23505') {
          return await orphan('turno_reasignado')
        }
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
