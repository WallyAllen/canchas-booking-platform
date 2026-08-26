/* eslint-disable @typescript-eslint/no-explicit-any */
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
        headers: { 'User-Agent': 'El Potrero MVP' }
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
  const { data: venue } = await (supabase.from("venues") as any)
    .select("owner_id")
    .eq("id", venueId)
    .single()

  if (!venue || venue.owner_id !== user.id) {
    throw new Error("No autorizado")
  }

  const payload: any = { name, phone, description, address, city }
  if (latitude !== null && longitude !== null) {
    payload.latitude = latitude
    payload.longitude = longitude
  }

  const { error } = await (supabase.from("venues") as any)
    .update(payload)
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
  const deposit_percentage = parseInt(formData.get("deposit_percentage") as string) || 30

  // Validar permisos
  const { data: venue } = await (supabase.from("venues") as any)
    .select("owner_id")
    .eq("id", venueId)
    .single()

  if (!venue || venue.owner_id !== user.id) {
    throw new Error("No autorizado")
  }

  const { error } = await (supabase.from("venues") as any)
    .update({ require_deposit, deposit_percentage })
    .eq("id", venueId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/dashboard/venue")
}
