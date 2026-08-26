/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/label-has-associated-control */
"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function createCourt(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data: venues } = await (supabase.from("venues") as any)
    .select("id")
    .eq("owner_id", user.id)
    .single()

  if (!venues) throw new Error("No se encontró complejo para este usuario")

  const name = formData.get("name") as string
  const type = formData.get("type") as string
  const surface = formData.get("surface") as string
  const is_covered = formData.get("is_covered") === "on"
  const has_lighting = formData.get("has_lighting") === "on"
  const slot_duration_minutes = parseInt(formData.get("slot_duration_minutes") as string) || 60

  const { error } = await (supabase.from("courts") as any).insert({
    venue_id: venues.id,
    name,
    type,
    surface,
    is_covered,
    has_lighting,
    slot_duration_minutes,
    is_active: true
  })

  if (error) {
    console.error(error)
    throw new Error(error.message)
  }

  revalidatePath("/dashboard/courts")
}

export async function toggleCourtStatus(courtId: string, isActive: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  // The RLS policy should ensure only the owner can update it
  const { error } = await (supabase.from("courts") as any)
    .update({ is_active: isActive })
    .eq("id", courtId)

  if (error) {
    console.error(error)
    throw new Error(error.message)
  }

  revalidatePath("/dashboard/courts")
}

export async function updatePricing(courtId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const price = parseFloat(formData.get("price") as string)

  // Remove existing rules
  await supabase.from("pricing_rules").delete().eq("court_id", courtId)

  // Insert a new general rule for all days (0-6) from 08:00 to 23:59
  const rules = []
  for (let i = 0; i <= 6; i++) {
    rules.push({
      court_id: courtId,
      day_of_week: i,
      start_time: "08:00",
      end_time: "23:59",
      price: price,
      is_promo_active: false
    })
  }

  const { error } = await (supabase.from("pricing_rules") as any).insert(rules)

  if (error) {
    console.error(error)
    throw new Error(error.message)
  }

  revalidatePath("/dashboard/courts")
}
