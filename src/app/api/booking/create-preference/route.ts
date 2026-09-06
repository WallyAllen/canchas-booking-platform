import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createPaymentPreference } from '@/lib/mercadopago/client'
import { createPendingBooking, BookingError } from '@/lib/booking/create-pending-booking'
import { checkRateLimit, identityFrom, rateLimitedResponse } from '@/lib/rate-limit'
import { CreatePendingBookingSchema, NonEmptyStringSchema } from '@/lib/utils/validators'

export async function POST(request: Request) {
  try {
    // Mercado Pago está deshabilitado hasta tener credenciales de producción.
    // La UI lo muestra como "Próximamente" y no llega hasta acá, pero el
    // endpoint sigue expuesto: sin este guard, un POST directo crearía la
    // reserva y después fallaría al crear la preferencia, dejando basura.
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'El pago con Mercado Pago todavía no está disponible. Usá transferencia bancaria.' },
        { status: 503 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Cada llamada crea una reserva 'pending', y una pending ocupa el turno
    // hasta que la limpie el cron. Sin límite, un script puede bloquear todas
    // las canchas de la plataforma sin pagar nada.
    const limit = await checkRateLimit({
      action: 'create-preference',
      identity: identityFrom(request, user.id),
      limit: 5,
      windowSeconds: 300
    })
    if (!limit.allowed) return rateLimitedResponse(limit.retryAfter)

    // Zod en vez de chequear que no sean undefined: valida además que courtId
    // sea un UUID y que la fecha y la hora tengan formato, en vez de dejar que
    // un valor mal formado llegue hasta la consulta a Postgres.
    const body = await request.json()
    const parsed = CreatePendingBookingSchema.extend({ title: NonEmptyStringSchema }).safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Parámetros inválidos' },
        { status: 400 }
      )
    }
    const { title, courtId, date, time } = parsed.data

    const result = await createPendingBooking({
      courtId,
      date,
      time,
      userId: user.id,
      depositMethod: 'mercadopago'
    })

    // Si se cubrió todo con créditos, confirmamos directo sin pasar por MP.
    if (result.amountToPay === 0) {
      const adminSupabase = createAdminClient()
      await adminSupabase.from('bookings')
        .update({ status: 'confirmed', payment_status: 'paid' })
        .eq('id', result.bookingId)

      return NextResponse.json({
        preferenceId: null,
        initPoint: `/booking/${courtId}/success?booking_id=${result.bookingId}`
      })
    }

    const preference = await createPaymentPreference({
      title,
      price: result.amountToPay,
      bookingId: result.bookingId,
      courtId
    })

    return NextResponse.json({ preferenceId: preference.id, initPoint: preference.init_point })
  } catch (error: unknown) {
    if (error instanceof BookingError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('create-preference error:', error)
    return NextResponse.json({ error: 'No se pudo iniciar el pago. Intentá de nuevo.' }, { status: 500 })
  }
}
