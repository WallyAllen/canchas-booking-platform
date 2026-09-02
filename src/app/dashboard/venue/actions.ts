/* eslint-disable jsx-a11y/label-has-associated-control */
"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateVenueProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const venueId = formData.get("venue_id") as string
  const name = formData.get("name") as string
  const phone = formData.get("phone") as string
  const description = formData.get("description") as string
  const address = formData.get("address") as string
  const city = formData.get("city") as string
  const manualLat = formData.get("latitude") as string
  const manualLng = formData.get("longitude") as string

  // Geocoding simple con Nominatim
  let latitude = manualLat ? parseFloat(manualLat) : null
  let longitude = manualLng ? parseFloat(manualLng) : null
  
  if (address && city && latitude === null && longitude === null) {
    try {
      const q = encodeURIComponent(`${address}, ${city}, Argentina`)
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}`, {
        headers: { 'User-Agent': 'ReservaYa MVP' }
      })
      const data = await res.json()
      if (data && data.length > 0) {
        latitude = parseFloat(data[0].lat)
        longitude = parseFloat(data[0].lon)
      }
    } catch (e) {
      console.error("Geocoding failed", e)
    }
  }

  // Validar permisos
  const { data: venue } = await supabase.from("venues")
    .select("owner_id")
    .eq("id", venueId)
    .single()

  // @ts-expect-error fix inference
  if (!venue || venue.owner_id !== user.id) {
    throw new Error("No autorizado")
  }

  const payload: Record<string, string | null> = { name, phone, description, address, city }
  if (latitude !== null && longitude !== null) {
    // @ts-expect-error fix inference
    payload.latitude = latitude
    // @ts-expect-error fix inference
    payload.longitude = longitude
  }

  const { error } = await supabase.from("venues")
    .update(payload as never)
    .eq("id", venueId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/dashboard/venue")
}

export async function updateVenuePaymentSettings(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const venueId = formData.get("venue_id") as string
  const require_deposit = formData.get("require_deposit") === "on"
  // AGENTS.md: "Seña (deposit): 30% minimum of total price, always paid
  // digitally". Clamp al rango [30, 100] — nunca hubo piso antes de esto.
  const rawDepositPercentage = parseInt(formData.get("deposit_percentage") as string) || 30
  const deposit_percentage = Math.min(100, Math.max(30, rawDepositPercentage))

  // Validar permisos
  const { data: venue } = await supabase.from("venues")
    .select("owner_id")
    .eq("id", venueId)
    .single()

  // @ts-expect-error fix inference
  if (!venue || venue.owner_id !== user.id) {
    throw new Error("No autorizado")
  }

  const { error } = await supabase.from("venues")
    .update({ require_deposit, deposit_percentage } as never)
    .eq("id", venueId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/dashboard/venue")
}
