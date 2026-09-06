import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createPendingBooking, BookingError } from '@/lib/booking/create-pending-booking'
import { checkRateLimit, identityFrom, rateLimitedResponse } from '@/lib/rate-limit'
import { CreatePendingBookingSchema } from '@/lib/utils/validators'

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

    // Mismo riesgo que create-preference: cada llamada ocupa un turno. Acá la
    // ventana de bloqueo es peor todavía, porque una reserva por transferencia
    // sobrevive 3 horas antes de que el cron la levante (migración 029).
    const limit = await checkRateLimit({
      action: 'create-transfer',
      identity: identityFrom(request, user.id),
      limit: 5,
      windowSeconds: 300
    })
    if (!limit.allowed) return rateLimitedResponse(limit.retryAfter)

    // Zod en vez de chequear que no sean undefined: valida además que courtId
    // sea un UUID y que la fecha y la hora tengan formato, en vez de dejar que
    // un valor mal formado llegue hasta la consulta a Postgres.
    const parsed = CreatePendingBookingSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Parámetros inválidos' },
        { status: 400 }
      )
    }
    const { courtId, date, time } = parsed.data

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
