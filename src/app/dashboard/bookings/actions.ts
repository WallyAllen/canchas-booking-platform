/* eslint-disable jsx-a11y/label-has-associated-control */
"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { consumeLockedCredits } from "@/lib/credits/manager"

async function assertOwnsBooking(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookingId: string,
  userId: string
) {
  const { data: booking } = await supabase.from("bookings")
    .select("court_id, courts!inner(venues!inner(owner_id))")
    .eq("id", bookingId)
    .single()

  // @ts-expect-error fix inference
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
    .update({ status: status } as never)
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
    .update({ payment_status: paymentStatus } as never)
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

  const { error } = await supabase.from("bookings")
    .update({ payment_status: 'paid', status: 'confirmed' } as never)
    .eq("id", bookingId)

  if (error) {
    throw new Error(error.message)
  }

  // Los créditos que se hubieran bloqueado al reservar ya se usaron.
  await consumeLockedCredits(bookingId).catch(console.error)

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

  const { error } = await supabase.from("bookings")
    .update({ status: 'cancelled', payment_status: 'pending', cancelled_at: new Date().toISOString() } as never)
    .eq("id", bookingId)

  if (error) {
    throw new Error(error.message)
  }

  const adminSupabase = createAdminClient()
  await adminSupabase.from("credits")
    .update({ locked_for_booking_id: null })
    .eq("locked_for_booking_id", bookingId)

  revalidatePath("/dashboard/bookings")
  revalidatePath("/dashboard/schedule")
  revalidatePath("/bookings")
}
