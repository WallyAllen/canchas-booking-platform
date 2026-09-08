
"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { consumeLockedCredits } from "@/lib/credits/manager"
import { avisarPorChat, mensajeReservaConfirmada, mensajeTransferenciaRechazada } from "@/lib/notifications/in-app"

async function assertOwnsBooking(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookingId: string,
  userId: string
) {
  const { data: booking } = await supabase.from("bookings")
    .select("court_id, courts!inner(venues!inner(owner_id))")
    .eq("id", bookingId)
    .single()

  const ownerId = booking?.courts?.venues?.owner_id
  if (!booking || ownerId !== userId) {
    throw new Error("No autorizado")
  }
}

export async function updateBookingStatus(bookingId: string, status: 'confirmed' | 'cancelled' | 'completed' | 'no_show') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  await assertOwnsBooking(supabase, bookingId, user.id)

  const { error } = await supabase.from("bookings")
    .update({ status: status })
    .eq("id", bookingId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/dashboard/bookings")
  revalidatePath("/dashboard/schedule")
}

export async function updatePaymentStatus(bookingId: string, paymentStatus: 'pending' | 'paid' | 'refunded') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  await assertOwnsBooking(supabase, bookingId, user.id)

  const { error } = await supabase.from("bookings")
    .update({ payment_status: paymentStatus })
    .eq("id", bookingId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/dashboard/bookings")
  revalidatePath("/dashboard/schedule")
}

/**
 * El complejo verificó el comprobante y da la seña por recibida.
 *
 * Marca pago y confirmación en una sola escritura: una reserva por
 * transferencia queda además en `status='pending'`, así que tocar solo
 * `payment_status` la dejaría pagada pero sin confirmar.
 */
export async function confirmTransferPayment(bookingId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  await assertOwnsBooking(supabase, bookingId, user.id)

  const { data: booking, error } = await supabase.from("bookings")
    .update({ payment_status: 'paid', status: 'confirmed' })
    .eq("id", bookingId)
    .select('user_id, booking_date, start_time, courts(venues(id, name, owner_id))')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // Los créditos que se hubieran bloqueado al reservar ya se usaron.
  await consumeLockedCredits(bookingId).catch(console.error)

  // Avisarle al usuario que su transferencia fue verificada.
  //
  // Este es el único momento en que una reserva por transferencia queda
  // confirmada, y no notificaba nada: el usuario transfería, esperaba, y se
  // enteraba solo si volvía a entrar a "Mis Reservas".
  //
  // Va por el chat y no por mail a propósito: el comprobante lo subió por acá,
  // así que es donde está mirando, y no depende de configurar un proveedor de
  // correo ni de verificar un dominio para funcionar.
  if (booking) {
    await avisarPorChat(booking, mensajeReservaConfirmada(booking))
  }

  revalidatePath("/dashboard/bookings")
  revalidatePath("/dashboard/schedule")
  revalidatePath("/bookings")
}

/**
 * El comprobante no era válido (o nunca llegó la plata): se cancela la reserva
 * y se liberan los créditos que estaban bloqueados para ella.
 */
export async function rejectTransferPayment(bookingId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  await assertOwnsBooking(supabase, bookingId, user.id)

  const { data: booking, error } = await supabase.from("bookings")
    .update({ status: 'cancelled', payment_status: 'pending', cancelled_at: new Date().toISOString() })
    .eq("id", bookingId)
    .select('user_id, booking_date, start_time, courts(venues(id, name, owner_id))')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // Un rechazo sin aviso es peor que una confirmación sin aviso: el usuario cree
  // que tiene el turno y se entera el día del partido.
  if (booking) {
    await avisarPorChat(booking, mensajeTransferenciaRechazada(booking))
  }

  const adminSupabase = createAdminClient()
  await adminSupabase.from("credits")
    .update({ locked_for_booking_id: null })
    .eq("locked_for_booking_id", bookingId)

  revalidatePath("/dashboard/bookings")
  revalidatePath("/dashboard/schedule")
  revalidatePath("/bookings")
}
