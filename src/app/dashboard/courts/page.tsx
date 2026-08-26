/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin } from "lucide-react"
import { CourtFormModal } from "@/components/dashboard/courts/CourtFormModal"
import { PricingModal } from "@/components/dashboard/courts/PricingModal"

export const dynamic = 'force-dynamic'

export default async function CourtsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: venues } = await (supabase.from("venues") as any)
    .select("id")
    .eq("owner_id", user.id)

  const venue = venues?.[0]
  if (!venue) redirect("/dashboard")

  const { data: courts } = await (supabase.from("courts") as any)
    .select("*")
    .eq("venue_id", venue.id)
    .order("created_at", { ascending: true })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mis Canchas</h1>
          <p className="text-muted-foreground">Administra las canchas, superficies y reglas de precios.</p>
        </div>
        <CourtFormModal />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {courts && courts.length > 0 ? courts.map((court: any) => (
          <Card key={court.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl">{court.name}</CardTitle>
                <Badge variant={court.is_active ? "default" : "secondary"}>
                  {court.is_active ? "Activa" : "Inactiva"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Tipo</div>
                  <div className="font-medium capitalize">{court.court_type}</div>
                  
                  <div className="text-muted-foreground">Superficie</div>
                  <div className="font-medium capitalize">{court.surface}</div>
                  
                  <div className="text-muted-foreground">Techada</div>
                  <div className="font-medium">{court.is_indoor ? "Sí" : "No"}</div>
                  
                  <div className="text-muted-foreground">Turno base</div>
                  <div className="font-medium">{court.slot_duration_minutes} min</div>
                </div>

                <div className="pt-4 border-t grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="w-full">
                    Editar
                  </Button>
                  <PricingModal courtId={court.id} />
                </div>
              </div>
            </CardContent>
          </Card>
        )) : (
          <div className="col-span-full py-12 text-center bg-muted/20 border rounded-xl border-dashed">
            <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-medium mb-1">No tienes canchas creadas</h3>
            <p className="text-muted-foreground mb-4">Crea tu primera cancha para empezar a recibir reservas.</p>
            <CourtFormModal />
          </div>
        )}
      </div>
    </div>
  )
}
