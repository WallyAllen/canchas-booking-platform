/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPaymentPreference } from '@/lib/mercadopago/client'
import { calculateDeposit } from '@/lib/mercadopago/helpers'
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

    const depositAmount = calculateDeposit(price)
    
    // Check credits
    const credits = await getAvailableCredits(user.id)
    let amountToPay = depositAmount

    if (credits > 0) {
      amountToPay = credits >= depositAmount ? 0 : depositAmount - credits
      
      // MVP: Consumimos los créditos ahora mismo. Si falla MP, el admin tendrá que devolverlos manualmente.
      // (Una mejor arquitectura reservaría los créditos en estado 'pending')
      await applyCredits(user.id, bookingId, Math.min(credits, depositAmount))
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
