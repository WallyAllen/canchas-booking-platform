/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card,} from "@/components/ui/card"

import { ScheduleNavigation } from "@/components/dashboard/schedule/ScheduleNavigation"
import { ManualBookingModal } from "@/components/dashboard/schedule/ManualBookingModal"

export const dynamic = 'force-dynamic'

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: { date?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: venues } = await (supabase.from("venues") as any)
    .select("*, courts(*)")
    .eq("owner_id", user.id)

  const venue = venues?.[0]
  if (!venue) redirect("/dashboard")

  const todayStr = new Date().toISOString().split('T')[0]
  const currentDate = searchParams.date || todayStr

  // Fetch bookings for that date
  const { data: bookingsData } = await (supabase.from("bookings") as any)
    .select("*, courts(name), profiles(full_name)")
    .in("court_id", venue.courts.map((c: any) => c.id))
    .eq("booking_date", currentDate)

  const bookings = bookingsData || []
  
  // Horarios para mostrar (MVP: 16:00 a 23:00)
  const hours = [16, 17, 18, 19, 20, 21, 22, 23]

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendario</h1>
          <p className="text-muted-foreground">Gestiona la grilla horaria de tus canchas.</p>
        </div>
        <div className="flex items-center gap-2">
          <ScheduleNavigation currentDate={currentDate} />
          <ManualBookingModal courts={venue.courts} currentDate={currentDate} />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Header / Horas */}
            <div className="grid grid-cols-[150px_1fr] bg-muted/50 border-b">
              <div className="p-4 font-medium flex items-center justify-center border-r">
                Cancha
              </div>
              <div className="grid" style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}>
                {hours.map(hour => (
                  <div key={hour} className="p-4 font-medium text-sm text-center border-r last:border-r-0">
                    {hour}:00
                  </div>
                ))}
              </div>
            </div>

            {/* Filas / Canchas */}
            <div className="divide-y">
              {venue.courts.map((court: any) => {
                const courtBookings = bookings.filter((b: any) => b.court_id === court.id)
                
                return (
                  <div key={court.id} className="grid grid-cols-[150px_1fr] bg-card">
                    <div className="p-4 font-medium border-r flex flex-col justify-center">
                      <span className="truncate">{court.name}</span>
                      <span className="text-xs text-muted-foreground capitalize">{court.court_type}</span>
                    </div>
                    <div className="grid relative" style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}>
                      {/* Celdas de fondo */}
                      {hours.map(hour => (
                        <div key={hour} className="h-full min-h-[80px] border-r last:border-r-0 border-dashed hover:bg-muted/30 transition-colors cursor-pointer" />
                      ))}
                      
                      {/* Bloques de reservas */}
                      {courtBookings.map((booking: any) => {
                        const startHour = parseInt(booking.start_time.split(':')[0])
                        const index = hours.indexOf(startHour)
                        if (index === -1) return null // Fuera de horario

                        const statusColor = booking.status === 'cancelled' ? 'bg-red-100 text-red-800 border-red-200' :
                          booking.payment_status === 'paid' ? 'bg-green-100 text-green-800 border-green-200' :
                          'bg-blue-100 text-blue-800 border-blue-200'

                        return (
                          <div 
                            key={booking.id}
                            className={`absolute top-2 bottom-2 rounded-md border p-2 text-xs overflow-hidden cursor-pointer shadow-xs ${statusColor}`}
                            style={{ 
                              left: `calc(${(index / hours.length) * 100}% + 4px)`, 
                              width: `calc(${(1 / hours.length) * 100}% - 8px)`
                            }}
                          >
                            <div className="font-bold truncate">{booking.manual_client_name || booking.profiles?.full_name || 'Sin Nombre'}</div>
                            <div className="truncate">{booking.start_time.substring(0, 5)} hs</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
