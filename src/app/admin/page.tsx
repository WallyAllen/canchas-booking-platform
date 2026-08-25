/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Building, Calendar, DollarSign } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch all counts
  const { count: usersCount } = await (supabase.from("profiles") as any).select("*", { count: 'exact', head: true })
  const { count: venuesCount } = await (supabase.from("venues") as any).select("*", { count: 'exact', head: true })
  
  const { data: bookings } = await (supabase.from("bookings") as any)
    .select("*, profiles(full_name), courts(name, venues(name))")
    .order("created_at", { ascending: false })

  const bookingsList = bookings || []
  const totalRevenue = bookingsList
    .filter((b: any) => b.status === 'confirmed' || b.payment_status === 'paid')
    .reduce((acc: number, curr: any) => acc + (curr.total_price * 0.3), 0)

  const recentBookings = bookingsList.slice(0, 10)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Global</h1>
        <p className="text-muted-foreground">Métricas en tiempo real de toda la plataforma ReservaYa.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Totales</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usersCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Complejos Activos</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{venuesCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reservas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookingsList.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volumen Señas</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${Math.ceil(totalRevenue).toLocaleString('es-AR')}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle>Últimas 10 Reservas Globales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Complejo</th>
                    <th className="px-4 py-3">Cancha</th>
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {recentBookings.map((b: any) => (
                    <tr key={b.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">{b.id.substring(0, 8)}</td>
                      <td className="px-4 py-3">{new Date(`${b.booking_date}T${b.start_time}`).toLocaleString('es-AR')}</td>
                      <td className="px-4 py-3 font-medium">{b.courts?.venues?.name}</td>
                      <td className="px-4 py-3">{b.courts?.name}</td>
                      <td className="px-4 py-3">{b.profiles?.full_name || 'Sin Nombre'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold
                          ${b.status === 'cancelled' ? 'bg-red-100 text-red-800' : 
                            b.status === 'confirmed' ? 'bg-green-100 text-green-800' : 
                            'bg-yellow-100 text-yellow-800'}`}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
