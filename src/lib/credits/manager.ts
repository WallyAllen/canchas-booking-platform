import { createClient, createAdminClient } from "@/lib/supabase/server"
import type { Booking } from "@/types/domain"

/**
 * Solo las columnas que estas funciones leen. Un `Pick` en vez de `Booking`
 * entero porque las llaman también con filas que traen joins (profiles, courts,
 * venues) y con objetos armados en los tests: lo que importa es que tengan la
 * fecha, la hora y el precio.
 */
type BookingTiming = Pick<Booking, 'booking_date' | 'start_time' | 'total_price'>

export function calculateCancellationPolicy(booking: BookingTiming) {
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

export function canReschedule(booking: Pick<Booking, 'booking_date' | 'start_time'>) {
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

  const { data, error } = await supabase.from('credits')
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

  const { data, error } = await supabase.from('credits')
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
  return credits.reduce((acc, curr) => acc + curr.amount, 0)
}

// Bloquea créditos disponibles contra una reserva pendiente (SEC-04: antes se
// marcaban 'used' de forma inmediata sin usar locked_for_booking_id de la
// migración 019, lo que permitía doble gasto entre dos reservas concurrentes).
// Cada UPDATE es condicional a que el crédito siga sin bloquear — si dos
// requests compiten por el mismo crédito, solo una lo gana.
/** Los montos son DECIMAL(10,2): se redondea para no arrastrar ruido de punto flotante. */
function round2(value: number) {
  return Math.round(value * 100) / 100
}

export async function applyCredits(userId: string, bookingId: string, venueId: string, amountToApply: number) {
  // Admin client, no el del usuario. La migración 015 quitó la policy
  // "Users can update their own credits" y la reemplazó por una solo para
  // admins. Con el cliente del usuario, el UPDATE de abajo filtraba a 0 filas
  // sin devolver error: no se bloqueaba ningún crédito, pero el descuento se
  // aplicaba igual porque el monto a pagar se calcula aparte. El usuario pagaba
  // menos y se quedaba con el crédito entero, reutilizable sin límite.
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const { data: credits, error } = await supabase.from('credits')
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
    if (remainingToApply <= 0) break

    const { data: locked } = await supabase.from('credits')
      .update({ locked_for_booking_id: bookingId })
      .eq('id', credit.id)
      .eq('status', 'available')
      .is('locked_for_booking_id', null)
      .select('id, amount')

    if (!locked || locked.length === 0) continue // otro request se lo llevó primero

    const lockedAmount = Number(locked[0].amount)

    if (lockedAmount > remainingToApply) {
      // El crédito vale más que lo que falta cubrir. Antes se consumía entero y
      // la diferencia se perdía: con un crédito de $5000 y una seña de $3000, el
      // usuario regalaba $2000. Se parte en dos y el excedente vuelve como
      // crédito disponible, heredando vencimiento y complejo del original.
      const leftover = round2(lockedAmount - remainingToApply)

      // Se emite el excedente ANTES de achicar el original. Si algo falla entre
      // las dos escrituras, el error queda a favor del usuario (crédito de más),
      // que es el lado correcto para equivocarse cuando se trata de su plata.
      const { error: leftoverError } = await supabase.from('credits').insert({
        user_id: credit.user_id,
        venue_id: credit.venue_id,
        booking_id: credit.booking_id,
        amount: leftover,
        status: 'available',
        expires_at: credit.expires_at
      })

      if (leftoverError) {
        // No se parte: se prefiere dejar el crédito entero bloqueado (el usuario
        // conserva el valor en la reserva) antes que achicarlo sin haber emitido
        // el excedente, que sí perdería plata.
        console.error('No se pudo emitir el crédito por el excedente:', leftoverError)
      } else {
        const { error: shrinkError } = await supabase.from('credits')
          .update({ amount: remainingToApply })
          .eq('id', credit.id)

        if (shrinkError) {
          console.error('No se pudo achicar el crédito partido:', shrinkError)
        }
      }

      remainingToApply = 0
    } else {
      remainingToApply = round2(remainingToApply - lockedAmount)
    }
  }

  return remainingToApply > 0 ? remainingToApply : 0
}

// Finaliza el bloqueo como gasto real una vez confirmado el pago (llamado
// desde el webhook de Mercado Pago tras marcar la reserva 'paid').
export async function consumeLockedCredits(bookingId: string) {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const { error } = await supabase.from('credits')
    .update({ status: 'used', used_at: now })
    .eq('locked_for_booking_id', bookingId)

  if (error) {
    console.error('Error consuming locked credits:', error)
    throw new Error('Error al consumir créditos bloqueados')
  }
}
