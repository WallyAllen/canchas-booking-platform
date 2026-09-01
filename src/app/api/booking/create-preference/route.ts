import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createPaymentPreference } from '@/lib/mercadopago/client'

import { getAvailableCredits, applyCredits } from '@/lib/credits/manager'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { title, courtId, date, time } = body

    if (!title || !courtId || !date || !time) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const { data: court } = await supabase.from('courts')
      .select('venue_id, venues(require_deposit, deposit_percentage)')
      .eq('id', courtId)
      .single()

    if (!court) {
      return NextResponse.json({ error: 'Cancha no encontrada' }, { status: 404 })
    }

    // Calcular el total_price usando pricing_rules
    const bookingDate = new Date(`${date}T${time}`)
    const dayOfWeek = bookingDate.getDay()
    
    const { data: rules } = await supabase.from("pricing_rules")
      .select("*")
      .eq("court_id", courtId)
      .eq("day_of_week", dayOfWeek)
      .lte("start_time", `${time}:00`)
      .gte("end_time", `${time}:00`)

    let price = 15000
    if (rules && rules.length > 0) {
      const rule = rules[0] as import('@/types/domain').PricingRule
      if (rule.is_promo_active && rule.promo_price) {
        price = rule.promo_price
      } else {
        price = rule.price
      }
    }

    // @ts-expect-error fix inference
    const venueId = court.venue_id
    // @ts-expect-error fix inference
    const requireDeposit = court.venues?.require_deposit ?? true
    // @ts-expect-error fix inference
    const depositPercentage = court.venues?.deposit_percentage ?? 30

    const depositAmount = requireDeposit ? Math.ceil((price * depositPercentage) / 100) : 0
    let amountToPay = depositAmount

    // Check credits for this specific venue
    const credits = await getAvailableCredits(user.id, venueId)
    if (credits > 0 && amountToPay > 0) {
      amountToPay = credits >= depositAmount ? 0 : depositAmount - credits
    }

    // 1. Crear el booking pending con adminSupabase
    const { data: booking, error: insertError } = await adminSupabase.from("bookings")
      .insert({
        user_id: user.id,
        court_id: courtId,
        booking_date: date,
        start_time: `${time}:00`,
        end_time: "23:59:00",
        total_price: price,
        deposit_amount: depositAmount,
        payment_status: "pending",
        status: "pending"
      })
      .select()
      .single()

    if (insertError || !booking) {
      return NextResponse.json({ error: 'Error creando reserva temporal' }, { status: 500 })
    }
    const bookingId = booking.id

    // 2. Bloquear créditos
    if (credits > 0 && depositAmount > 0) {
      await applyCredits(user.id, bookingId, venueId, Math.min(credits, depositAmount))
    }

    // 3. Confirmar directo si se cubrió todo con créditos
    if (amountToPay === 0) {
      await adminSupabase.from('bookings')
        .update({ status: 'confirmed', payment_status: 'paid' } as never)
        .eq('id', bookingId)
        
      return NextResponse.json({ 
        preferenceId: null, 
        initPoint: `/booking/${courtId}/success?booking_id=${bookingId}` 
      })
    }

    // 4. Crear preferencia de MP
    const preference = await createPaymentPreference({
      title,
      price: amountToPay,
      bookingId,
      courtId
    })

    return NextResponse.json({ preferenceId: preference.id, initPoint: preference.init_point })
  } catch (error: unknown) {
    console.error('create-preference error:', error)
    return NextResponse.json({ error: 'No se pudo iniciar el pago. Intentá de nuevo.' }, { status: 500 })
  }
}