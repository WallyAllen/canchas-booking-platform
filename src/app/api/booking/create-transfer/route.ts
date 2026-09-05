import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createPendingBooking, BookingError } from '@/lib/booking/create-pending-booking'

/**
 * Crea una reserva a pagar por transferencia bancaria.
 *
 * A diferencia de Mercado Pago, acá no hay confirmación automática: la reserva
 * queda `pending` hasta que el usuario reporte el pago (adjuntando comprobante
 * en el chat) y una persona del complejo lo verifique.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { courtId, date, time } = body

    if (!courtId || !date || !time) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    const result = await createPendingBooking({
      courtId,
      date,
      time,
      userId: user.id,
      depositMethod: 'transfer'
    })

    // Si los créditos cubrieron la seña entera no hay nada que transferir:
    // se confirma igual que en el flujo de Mercado Pago.
    if (result.amountToPay === 0) {
      const adminSupabase = createAdminClient()
      await adminSupabase.from('bookings')
        .update({ status: 'confirmed', payment_status: 'paid' })
        .eq('id', result.bookingId)

      return NextResponse.json({
        bookingId: result.bookingId,
        venueId: result.venueId,
        amountToPay: 0,
        redirectTo: `/booking/${courtId}/success?booking_id=${result.bookingId}`
      })
    }

    return NextResponse.json({
      bookingId: result.bookingId,
      venueId: result.venueId,
      amountToPay: result.amountToPay,
      creditsApplied: result.creditsApplied,
      redirectTo: `/booking/${courtId}/transfer?booking_id=${result.bookingId}`
    })
  } catch (error: unknown) {
    if (error instanceof BookingError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('create-transfer error:', error)
    return NextResponse.json({ error: 'No se pudo crear la reserva. Intentá de nuevo.' }, { status: 500 })
  }
}
