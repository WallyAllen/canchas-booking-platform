/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPaymentPreference } from '@/lib/mercadopago/client'

import { getAvailableCredits, applyCredits } from '@/lib/credits/manager'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { title, price, bookingId, courtId } = body

    if (!title || !price || !bookingId || !courtId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const { data: court } = await (supabase.from('courts') as any)
      .select('venue_id, venues(require_deposit, deposit_percentage)')
      .eq('id', courtId)
      .single()

    if (!court) {
      return NextResponse.json({ error: 'Cancha no encontrada' }, { status: 404 })
    }

    const venueId = court.venue_id
    const requireDeposit = court.venues?.require_deposit ?? true
    const depositPercentage = court.venues?.deposit_percentage ?? 30

    // Check credits for this specific venue
    const credits = await getAvailableCredits(user.id, venueId)
    
    // Si no requiere seña, el deposit amount es 0
    const depositAmount = requireDeposit ? Math.ceil((price * depositPercentage) / 100) : 0
    let amountToPay = depositAmount

    if (credits > 0 && amountToPay > 0) {
      amountToPay = credits >= depositAmount ? 0 : depositAmount - credits
      
      // MVP: Consumimos los créditos ahora mismo. Si falla MP, el admin tendrá que devolverlos manualmente.
      await applyCredits(user.id, bookingId, venueId, Math.min(credits, depositAmount))
    }

    // Si con los créditos se cubrió el 100% de la seña, confirmamos directo
    if (amountToPay === 0) {
      await (supabase.from('bookings') as any)
        .update({ status: 'confirmed', payment_status: 'paid' })
        .eq('id', bookingId)
        
      return NextResponse.json({ 
        preferenceId: null, 
        initPoint: `/booking/${courtId}/success?booking_id=${bookingId}` 
      })
    }

    const preference = await createPaymentPreference({
      title,
      price: amountToPay,
      bookingId,
      courtId
    })

    return NextResponse.json({ preferenceId: preference.id, initPoint: preference.init_point })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
