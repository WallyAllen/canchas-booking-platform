/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookingActions } from "@/components/dashboard/bookings/BookingActions"

export const dynamic = 'force-dynamic'

export default async function VenueBookingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: venues } = await (supabase.from("venues") as any)
    .select("*, courts(id)")
    .eq("owner_id", user.id)

  const venue = venues?.[0]
  if (!venue) redirect("/dashboard")

  const courtIds = venue.courts.map((c: any) => c.id)

  const { data: bookingsData } = await (supabase.from("bookings") as any)
    .select("*, courts(name), profiles(full_name, email, phone)")
    .in("court_id", courtIds)
    .order("booking_date", { ascending: false })
    .order("start_time", { ascending: false })

  const bookings = bookingsData || []

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reservas</h1>
          <p className="text-muted-foreground">Listado general de todas las reservas de tu complejo.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium">Fecha y Hora</th>
                  <th className="px-6 py-4 font-medium">Cancha</th>
                  <th className="px-6 py-4 font-medium">Cliente</th>
                  <th className="px-6 py-4 font-medium">Estado</th>
                  <th className="px-6 py-4 font-medium">Monto</th>
                  <th className="px-6 py-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {bookings.length > 0 ? bookings.map((booking: any) => (
                  <tr key={booking.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium">{new Date(`${booking.booking_date}T12:00:00`).toLocaleDateString('es-AR')}</div>
                      <div className="text-muted-foreground">{booking.start_time.substring(0, 5)} hs</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {booking.courts?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium">{booking.profiles?.full_name || 'Sin Nombre'}</div>
                      <div className="text-xs text-muted-foreground">{booking.profiles?.phone || 'Sin teléfono'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="outline" className={
                        booking.status === 'cancelled' ? 'border-red-200 text-red-700 bg-red-50' : 
                        booking.status === 'confirmed' ? 'border-green-200 text-green-700 bg-green-50' : 
                        'border-blue-200 text-blue-700 bg-blue-50'
                      }>
                        {booking.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium">${booking.total_price.toLocaleString('es-AR')}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {booking.payment_status}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-muted-foreground">
                      <BookingActions bookingId={booking.id} status={booking.status} paymentStatus={booking.payment_status} />
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                      No hay reservas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
