/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { createClient, createAdminClient } from "@/lib/supabase/server"

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

export async function createCredit(userId: string, bookingId: string, venueId: string, amount: number) {
  const supabase = createAdminClient()
  
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 90) // 90 días de validez

  const { data, error } = await (supabase.from('credits') as any)
    .insert({
      user_id: userId,
      booking_id: bookingId,
      venue_id: venueId,
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

export async function getAvailableCredits(userId: string, venueId: string) {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data, error } = await (supabase.from('credits') as any)
    .select('*')
    .eq('user_id', userId)
    .eq('venue_id', venueId)
    .eq('status', 'available')
    .is('locked_for_booking_id', null)
    .gt('expires_at', now)

  if (error) {
    console.error('Error getting credits:', error)
    return 0
  }

  const credits = data || []
  return credits.reduce((acc: number, curr: any) => acc + curr.amount, 0)
}

// Bloquea créditos disponibles contra una reserva pendiente (SEC-04: antes se
// marcaban 'used' de forma inmediata sin usar locked_for_booking_id de la
// migración 019, lo que permitía doble gasto entre dos reservas concurrentes).
// Cada UPDATE es condicional a que el crédito siga sin bloquear — si dos
// requests compiten por el mismo crédito, solo una lo gana.
export async function applyCredits(userId: string, bookingId: string, venueId: string, amountToApply: number) {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data: credits, error } = await (supabase.from('credits') as any)
    .select('*')
    .eq('user_id', userId)
    .eq('venue_id', venueId)
    .eq('status', 'available')
    .is('locked_for_booking_id', null)
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
    const { data: locked } = await (supabase.from('credits') as any)
      .update({ locked_for_booking_id: bookingId })
      .eq('id', credit.id)
      .eq('status', 'available')
      .is('locked_for_booking_id', null)
      .select('id, amount')

    if (!locked || locked.length === 0) continue // otro request se lo llevó primero

    remainingToApply -= credit.amount
  }

  return remainingToApply > 0 ? remainingToApply : 0
}

// Finaliza el bloqueo como gasto real una vez confirmado el pago (llamado
// desde el webhook de Mercado Pago tras marcar la reserva 'paid').
export async function consumeLockedCredits(bookingId: string) {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const { error } = await (supabase.from('credits') as any)
    .update({ status: 'used', used_at: now })
    .eq('locked_for_booking_id', bookingId)

  if (error) {
    console.error('Error consuming locked credits:', error)
    throw new Error('Error al consumir créditos bloqueados')
  }
}
