/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { Calendar as CalendarIcon, CheckCircle, Clock, TrendingUp, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export const dynamic = 'force-dynamic'

export default async function DashboardOverview() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Obtener el venue del usuario
  const { data: venues } = await (supabase.from("venues") as any)
    .select("*, courts(*)")
    .eq("owner_id", user.id)

  const venue = venues && venues.length > 0 ? venues[0] : null

  if (!venue) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">No tienes ningún complejo registrado</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Para comenzar a gestionar tus canchas y recibir reservas, primero debes registrar tu complejo deportivo.
        </p>
        <Button render={
          <Link href="/dashboard/venue/new">
            Crear mi primer complejo
          </Link>
        } />
      </div>
    )
  }

  // Fetch reservas para métricas
  const { data: bookingsData } = await (supabase.from("bookings") as any)
    .select("*, courts!inner(venue_id)")
    .eq("courts.venue_id", venue.id)
    .order("created_at", { ascending: false })

  const bookings = bookingsData || []

  // Calcular métricas MVP (mockeadas con los datos)
  const today = new Date().toISOString().split('T')[0]
  const todayBookings = bookings.filter((b: any) => b.booking_date === today && b.status !== 'cancelled')
  
  const revenue = bookings
    .filter((b: any) => b.status === 'confirmed' || b.payment_status === 'paid')
    .reduce((acc: number, curr: any) => acc + (curr.total_price || 0), 0)

  // Últimas 5 reservas
  const recentBookings = bookings.slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hola, {venue.name} 👋</h1>
        <p className="text-muted-foreground">Aquí está el resumen de tu complejo al día de hoy.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Reservas de Hoy"
          value={todayBookings.length.toString()}
          icon={CalendarIcon}
          description="Partidos programados para hoy"
        />
        <MetricCard
          title="Total Reservas"
          value={bookings.length.toString()}
          icon={CheckCircle}
          description="Reservas históricas"
        />
        <MetricCard
          title="Ingresos Estimados"
          value={`$${revenue.toLocaleString('es-AR')}`}
          icon={TrendingUp}
          description="Total generado en reservas"
        />
        <MetricCard
          title="Canchas Activas"
          value={venue.courts?.filter((c: any) => c.is_active).length.toString() || "0"}
          icon={Clock}
          description="Habilitadas para reservas online"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Últimas Reservas</CardTitle>
          </CardHeader>
          <CardContent>
            {recentBookings.length > 0 ? (
              <div className="space-y-4">
                {recentBookings.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium text-sm">Reserva #{b.id.substring(0, 6).toUpperCase()}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(`${b.booking_date}T${b.start_time}`).toLocaleString('es-AR', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                        })} hs
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">${b.total_price.toLocaleString('es-AR')}</p>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold
                        ${b.status === 'cancelled' ? 'bg-red-100 text-red-800' : 
                          b.status === 'confirmed' ? 'bg-green-100 text-green-800' : 
                          'bg-yellow-100 text-yellow-800'}`}>
                        {b.status || 'Pendiente'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Aún no hay reservas registradas.</p>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Accesos Rápidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" render={<Link href="/dashboard/schedule">🗓 Ver Calendario</Link>} />
            <Button variant="outline" className="w-full justify-start" render={<Link href="/dashboard/courts">🏟 Gestionar Canchas</Link>} />
            <Button variant="outline" className="w-full justify-start" render={<Link href="/dashboard/bookings">📋 Ver Todas las Reservas</Link>} />
            <Button variant="outline" className="w-full justify-start" render={<Link href="/dashboard/venue">⚙️ Configurar Perfil</Link>} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
