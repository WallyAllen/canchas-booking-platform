/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export const dynamic = 'force-dynamic'

export default async function AdminVenuesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: venues } = await (supabase.from("venues") as any)
    .select("*, profiles!venues_owner_id_fkey(full_name, email)")
    .order("created_at", { ascending: false })

  const venuesList = venues || []

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Complejos (Venues)</h1>
          <p className="text-muted-foreground">Gestión de todos los predios registrados en la plataforma.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium">Complejo</th>
                  <th className="px-6 py-4 font-medium">Ubicación</th>
                  <th className="px-6 py-4 font-medium">Propietario</th>
                  <th className="px-6 py-4 font-medium">Estado</th>
                  <th className="px-6 py-4 font-medium">Rating</th>
                  <th className="px-6 py-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {venuesList.map((venue: any) => (
                  <tr key={venue.id} className="hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <div className="font-bold">{venue.name}</div>
                      <div className="text-xs text-muted-foreground">ID: {venue.id.substring(0,8)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{venue.city}</div>
                      <div className="text-xs text-muted-foreground">{venue.address}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{venue.profiles?.full_name || 'Desconocido'}</div>
                      <div className="text-xs text-muted-foreground">{venue.profiles?.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={venue.is_active ? "default" : "secondary"}>
                        {venue.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      {venue.avg_rating ? `${venue.avg_rating} ⭐` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm">Suspender</Button>
                      <Button variant="outline" size="sm" className="ml-2">Ver Detalle</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
