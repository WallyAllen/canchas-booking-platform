/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { VenuePhotosForm } from "@/components/dashboard/venue/VenuePhotosForm"
import { VenueProfileForm, VenueLocationForm, VenuePaymentSettingsForm } from "@/components/dashboard/venue/VenueForms"

export const dynamic = 'force-dynamic'

export default async function VenueProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: venues } = await (supabase.from("venues") as any)
    .select("*")
    .eq("owner_id", user.id)

  const venue = venues?.[0]
  if (!venue) redirect("/dashboard")

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Perfil del Complejo</h1>
        <p className="text-muted-foreground">Configura la información pública de tu predio deportivo.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información General</CardTitle>
          <CardDescription>Datos básicos que verán los jugadores al buscar canchas.</CardDescription>
        </CardHeader>
        <VenueProfileForm venue={venue} />
      </Card>

      <VenuePhotosForm venueId={venue.id} initialPhotos={venue.photos || []} />

      <Card>
        <CardHeader>
          <CardTitle>Ubicación y Mapa</CardTitle>
          <CardDescription>Dirección exacta para que los jugadores puedan llegar.</CardDescription>
        </CardHeader>
        <VenueLocationForm venue={venue} />
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Pagos y Señas</CardTitle>
          <CardDescription>Configura cómo los jugadores abonan sus reservas.</CardDescription>
        </CardHeader>
        <VenuePaymentSettingsForm venue={venue} />
      </Card>
    </div>
  )
}
