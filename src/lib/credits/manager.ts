/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { createClient } from "@/lib/supabase/server"

export function calculateCancellationPolicy(booking: any) {
  const now = new Date()
  const bookingDate = new Date(`${booking.booking_date}T${booking.start_time}`)
  const diffHours = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60)

  // Si ya pasó o está por ocurrir en 1 hora, no se puede cancelar
  if (diffHours <= 1) {
    return {
      canCancel: false,
      refundType: 'forfeit',
      creditAmount: 0,
      reason: 'No se puede cancelar con menos de 1 hora de anticipación.'
    }
  }

  // > 6 horas -> Crédito
  if (diffHours >= 6) {
    // Calculamos la seña real que se debería devolver (asumimos 30% del total como seña mínima)
    const depositAmount = Math.ceil(booking.total_price * 0.3)
    return {
      canCancel: true,
      refundType: 'credit',
      creditAmount: depositAmount,
      reason: 'Cancelación con más de 6hs de anticipación. Recibís crédito en la plataforma.'
    }
  }

  // < 6 horas y > 1 hora -> Se pierde
  return {
    canCancel: true,
    refundType: 'forfeit',
    creditAmount: 0,
    reason: 'Cancelación con menos de 6hs de anticipación. Perdés la seña abonada.'
  }
}

export function canReschedule(booking: any) {
  const now = new Date()
  const bookingDate = new Date(`${booking.booking_date}T${booking.start_time}`)
  const diffHours = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60)

  if (diffHours >= 2) {
    return { allowed: true, reason: 'Reprogramación permitida.' }
  }
  
  return { allowed: false, reason: 'Reprogramación no permitida con menos de 2 horas de anticipación.' }
}

export async function createCredit(userId: string, bookingId: string, amount: number) {
  const supabase = await createClient()
  
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 90) // 90 días de validez

  const { data, error } = await (supabase.from('credits') as any)
    .insert({
      user_id: userId,
      booking_id: bookingId,
      amount,
      expires_at: expiresAt.toISOString(),
      status: 'available'
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating credit:', error)
    throw new Error('Error al crear crédito')
  }

  return data
}

export async function getAvailableCredits(userId: string) {
  const supabase = await createClient()
  const now = new Date().toISOString()
  
  const { data, error } = await (supabase.from('credits') as any)
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'available')
    .gt('expires_at', now)

  if (error) {
    console.error('Error getting credits:', error)
    return 0
  }

  const credits = data || []
  return credits.reduce((acc: number, curr: any) => acc + curr.amount, 0)
}

export async function applyCredits(userId: string, bookingId: string, amountToApply: number) {
  const supabase = await createClient()
  const now = new Date().toISOString()
  
  // Obtenemos créditos disponibles
  const { data: credits, error } = await (supabase.from('credits') as any)
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'available')
    .gt('expires_at', now)
    .order('expires_at', { ascending: true }) // Consumimos los que expiran primero

  if (error || !credits) {
    throw new Error('Error recuperando créditos')
  }

  let remainingToApply = amountToApply
  
  for (const credit of credits) {
    if (remainingToApply <= 0) break;

    // MVP: Consumimos el crédito completo. 
    // (Si un crédito es de $5000 y solo necesitás $3000, en este MVP se consume entero para simplificar)
    await (supabase.from('credits') as any)
      .update({ status: 'used', used_at: now })
      .eq('id', credit.id)
      
    remainingToApply -= credit.amount
  }
  
  return remainingToApply > 0 ? remainingToApply : 0
}
