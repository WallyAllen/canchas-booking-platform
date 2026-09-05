import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createPaymentPreference } from '@/lib/mercadopago/client'
import { createPendingBooking, BookingError } from '@/lib/booking/create-pending-booking'

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

    const body = await request.json()
    const { title, courtId, date, time } = body

    if (!title || !courtId || !date || !time) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

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
