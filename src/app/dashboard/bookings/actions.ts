/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/label-has-associated-control */
"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateBookingStatus(bookingId: string, status: 'confirmed' | 'cancelled' | 'completed' | 'no_show') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { error } = await (supabase.from("bookings") as any)
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

  const { error } = await (supabase.from("bookings") as any)
    .update({ payment_status: paymentStatus })
    .eq("id", bookingId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/dashboard/bookings")
  revalidatePath("/dashboard/schedule")
}
