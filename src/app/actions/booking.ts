"use server"

import { createClient } from "@/lib/supabase/server"

export async function cancelPendingBooking(bookingId: string) {
  const supabase = await createClient()
  
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) return { success: false, error: "No autenticado" }

  const { error } = await supabase
    .from("bookings")
    .delete()
    .eq("id", bookingId)
    .eq("user_id", userData.user.id)
    .eq("payment_status", "pending")

  if (error) {
    console.error("Error al cancelar booking pendiente:", error)
    return { success: false, error: error.message }
  }

  return { success: true }
}
