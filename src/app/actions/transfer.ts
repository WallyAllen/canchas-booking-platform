"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

/**
 * El usuario declara haber hecho la transferencia.
 *
 * Mueve la reserva a `awaiting_verification`, que la saca del alcance del cron
 * de purga (029): a partir de acá la reserva solo se cancela por decisión de
 * una persona, nunca automáticamente, porque puede haber plata real transferida.
 *
 * Usa el cliente admin a propósito: el trigger `protect_booking_fields` (021)
 * impide que un jugador modifique `payment_status`, y está bien que así sea.
 * La autorización la hacemos acá arriba, explícitamente.
 */
export async function reportTransfer(bookingId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data: booking } = await supabase.from("bookings")
    .select<'id, user_id, deposit_method, payment_status, status', {
      id: string
      user_id: string
      deposit_method: string | null
      payment_status: string
      status: string
    }>("id, user_id, deposit_method, payment_status, status")
    .eq("id", bookingId)
    .single()

  if (!booking || booking.user_id !== user.id) {
    throw new Error("No autorizado")
  }
  if (booking.deposit_method !== 'transfer') {
    throw new Error("Esta reserva no se paga por transferencia")
  }
  if (booking.payment_status !== 'pending') {
    // Ya reportada o ya confirmada: no es un error para el usuario.
    return
  }
  if (booking.status !== 'pending') {
    throw new Error("La reserva ya no está pendiente de pago")
  }

  const adminSupabase = createAdminClient()
  const { error } = await adminSupabase.from("bookings")
    .update({
      payment_status: 'awaiting_verification',
      transfer_reported_at: new Date().toISOString()
    })
    .eq("id", bookingId)
    .eq("payment_status", 'pending')

  if (error) {
    console.error("reportTransfer error:", error)
    throw new Error("No se pudo registrar el aviso de pago")
  }

  revalidatePath("/bookings")
  revalidatePath("/dashboard/bookings")
}
