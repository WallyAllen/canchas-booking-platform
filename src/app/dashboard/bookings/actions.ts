/* eslint-disable jsx-a11y/label-has-associated-control */
"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

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
