/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/label-has-associated-control */
"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function createManualBooking(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const courtId = formData.get("court_id") as string
  const date = formData.get("date") as string
  const time = formData.get("time") as string
  const clientName = formData.get("client_name") as string
  const price = parseFloat(formData.get("price") as string) || 0

  if (!courtId || !date || !time) {
    throw new Error("Faltan datos obligatorios")
  }

  // Verificar que la cancha pertenece al usuario
  const { data: court } = await (supabase.from("courts") as any)
    .select("venue_id, venues!inner(owner_id)")
    .eq("id", courtId)
    .single()

  if (!court || (court.venues as any).owner_id !== user.id) {
    throw new Error("No autorizado")
  }

  // Insertar la reserva usando el ID del admin como `user_id` (ya que es obligatoria en schema actual)
  const { error } = await (supabase.from("bookings") as any).insert({
    user_id: user.id,
    court_id: courtId,
    booking_date: date,
    start_time: time,
    end_time: "23:59:00", // MVP simplify
    total_price: price,
    deposit_amount: 0,
    deposit_method: "cash",
    payment_status: "pending",
    status: "confirmed",
    source: "manual",
    manual_client_name: clientName // Esta columna la crearemos con la migración 005
  })

  if (error) {
    console.error(error)
    throw new Error(error.message)
  }

  revalidatePath("/dashboard/schedule")
}
