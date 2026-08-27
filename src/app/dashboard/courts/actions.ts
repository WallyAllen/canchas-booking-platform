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

export async function saveOffers(courtId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const offersJson = formData.get("offers") as string
  const basePriceStr = formData.get("basePrice") as string
  
  if (!offersJson || !basePriceStr) throw new Error("Datos inválidos")
    
  const offers = JSON.parse(offersJson)
  const basePrice = parseFloat(basePriceStr)

  // Clear existing promo rules
  // Wait, if we just delete everything and recreate, it's easier to manage for MVP.
  // We'll delete ALL rules for the court and recreate the base rules + promo rules.
  await supabase.from("pricing_rules").delete().eq("court_id", courtId)
  
  const rules = []
  
  // Create base rules for each day (0-6)
  // We'll just create a full day base rule. If a promo overlaps, our app logic (or a more complex query)
  // would need to handle it. For MVP, we insert both base rules and promo rules.
  // When fetching availability, we'd pick the promo rule if it applies.
  for (let i = 0; i <= 6; i++) {
    rules.push({
      court_id: courtId,
      day_of_week: i,
      start_time: "00:00",
      end_time: "23:59",
      price: basePrice,
      is_promo_active: false
    })
  }
  
  // Add promo rules
  for (const offer of offers) {
    const promoPrice = basePrice * (1 - (offer.discount_percentage / 100))
    rules.push({
      court_id: courtId,
      day_of_week: parseInt(offer.day_of_week),
      start_time: offer.start_time,
      end_time: offer.end_time,
      price: basePrice,
      promo_price: promoPrice,
      is_promo_active: true
    })
  }

  const { error } = await (supabase.from("pricing_rules") as any).insert(rules)

  if (error) {
    console.error(error)
    throw new Error(error.message)
  }

  revalidatePath("/dashboard/courts")
}
