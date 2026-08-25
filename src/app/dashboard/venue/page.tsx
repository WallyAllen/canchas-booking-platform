/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

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
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Nombre del Complejo</label>
              <input type="text" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={venue.name} readOnly />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Teléfono de Contacto</label>
              <input type="text" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={venue.phone || ''} readOnly />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Descripción</label>
            <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={venue.description || ''} readOnly />
          </div>
          
          <div className="pt-4">
            <Button disabled>Guardar Cambios (Próximamente)</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ubicación y Mapa</CardTitle>
          <CardDescription>Dirección exacta para que los jugadores puedan llegar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Dirección</label>
              <input type="text" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={venue.address} readOnly />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Ciudad</label>
              <input type="text" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={venue.city} readOnly />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
