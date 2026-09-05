"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"

/**
 * El usuario abandonó el checkout: se libera el turno y los créditos.
 *
 * Antes esto hacía un `.delete()`, y no funcionaba: `bookings` tiene RLS activo
 * con policies de SELECT, INSERT y UPDATE, pero ninguna `FOR DELETE`. RLS es
 * default-deny, así que el borrado filtraba a 0 filas, no devolvía error, y la
 * función respondía `{ success: true }` habiendo hecho nada. El turno quedaba
 * bloqueado para todos hasta que pasara el cron.
 *
 * El arreglo no es agregar la policy de DELETE. Borrar la fila reintroduce el
 * pago huérfano que resolvió la migración 031: si el pago ya estaba en vuelo
 * cuando el usuario abandonó, llega a una reserva inexistente. Cancelar deja el
 * rastro, libera el turno igual (`get_venue_availability` y el índice parcial
 * `bookings_no_double_booking_idx` excluyen las canceladas) y encima usa la
 * policy de UPDATE, que sí existe.
 *
 * El motivo es 'user_abandoned' y no 'payment_timeout' a propósito: el webhook
 * solo resucita lo segundo. Si el usuario se fue por su cuenta y después cae el
 * pago, va a la cola de reconciliación para reembolso, que es lo correcto.
 */
export async function cancelPendingBooking(bookingId: string) {
  const supabase = await createClient()

  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) return { success: false, error: "No autenticado" }

  // Se filtra por user_id además de apoyarse en RLS, y por los dos estados
  // 'pending' para no pisar una reserva ya confirmada o ya cancelada.
  const { data: cancelled, error } = await supabase
    .from("bookings")
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_reason: 'user_abandoned'
    })
    .eq("id", bookingId)
    .eq("user_id", userData.user.id)
    .eq("status", "pending")
    .eq("payment_status", "pending")
    .select("id")

  if (error) {
    console.error("Error al cancelar booking pendiente:", error)
    return { success: false, error: error.message }
  }

  // Sin este chequeo volvemos al bug original: 0 filas afectadas no es un error
  // para PostgREST, así que hay que mirar el resultado para saber si pasó algo.
  if (!cancelled || cancelled.length === 0) {
    return { success: false, error: "La reserva no existe o ya no está pendiente" }
  }

  // El `ON DELETE SET NULL` de credits.locked_for_booking_id (migración 019)
  // desbloqueaba los créditos solo. Al cancelar en vez de borrar hay que hacerlo
  // explícito, y va con el admin client porque la migración 015 le sacó a los
  // usuarios el UPDATE sobre `credits`. Es seguro: la reserva que acabamos de
  // cancelar ya quedó verificada como propia por el filtro de arriba.
  const adminSupabase = createAdminClient()
  const { error: unlockError } = await adminSupabase
    .from("credits")
    .update({ locked_for_booking_id: null })
    .eq("locked_for_booking_id", bookingId)

  if (unlockError) {
    // No se escala: la reserva ya está cancelada y el turno liberado, que es lo
    // urgente. El barrido de la migración 033 desata en la próxima corrida
    // cualquier crédito que haya quedado atado a una reserva cancelada.
    console.error("No se pudieron desbloquear los créditos de la reserva:", unlockError)
  }

  return { success: true }
}
