/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server"
import Image from "next/image"
import { redirect } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, MapPin, Search } from "lucide-react"
import Link from "next/link"
import { CancelDialog } from "@/components/booking/cancel-dialog"
import { RescheduleDialog } from "@/components/booking/reschedule-dialog"

export const dynamic = 'force-dynamic'

export default async function BookingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect("/login?returnUrl=/bookings")

  const { data: bookingsData } = await (supabase.from("bookings") as any)
    .select(`
      *,
      courts (
        name,
        venues (
          id,
          name,
          address,
          photos
        )
      )
    `)
    .eq("user_id", user.id)
    .order("booking_date", { ascending: false })
    .order("start_time", { ascending: false })

  const bookings = bookingsData || []

  // Clasificar bookings
  const now = new Date()
  const nowLocal = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
  const todayStr = nowLocal.toISOString().split('T')[0]
  const timeStr = nowLocal.toISOString().split('T')[1].substring(0, 8)

  const upcoming = bookings.filter((b: any) => 
    b.status !== "cancelled" && 
    (b.booking_date > todayStr || (b.booking_date === todayStr && b.start_time > timeStr))
  )
  
  const past = bookings.filter((b: any) => 
    b.status !== "cancelled" && 
    (b.booking_date < todayStr || (b.booking_date === todayStr && b.start_time <= timeStr))
  )
  
  const cancelled = bookings.filter((b: any) => b.status === "cancelled")

  const renderBookingCard = (booking: any, isPast: boolean) => {
    const dateObj = new Date(`${booking.booking_date}T12:00:00`)
    const displayDate = dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
    const statusLabel = booking.status === 'cancelled' ? 'Cancelada' : booking.status === 'pending' ? 'Pendiente' : isPast ? 'Completada' : 'Confirmada'
    const statusColor = booking.status === 'cancelled' ? 'bg-destructive/10 text-destructive' : booking.status === 'pending' ? 'bg-orange-500/10 text-orange-500' : isPast ? 'bg-muted text-muted-foreground' : 'bg-green-500/10 text-green-500'

    return (
      <Card key={booking.id} className="overflow-hidden border-border/50 bg-card/50 hover:bg-card transition-colors">
        <div className="flex flex-col sm:flex-row h-full">
          <div className="hidden sm:block w-48 relative bg-muted shrink-0">
            {booking.courts.venues.photos && booking.courts.venues.photos[0] ? (
              <Image 
                src={booking.courts.venues.photos[0]} 
                alt="Venue" 
                fill
                sizes="(max-width: 640px) 0vw, 192px"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">⚽</div>
            )}
          </div>
          
          <CardContent className="p-5 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-lg">{booking.courts.name}</h3>
                  <p className="text-muted-foreground text-sm flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {booking.courts.venues.name}
                  </p>
                </div>
                <Badge variant="outline" className={`border-none ${statusColor}`}>
                  {statusLabel}
                </Badge>
              </div>
              
              <div className="flex flex-wrap gap-4 mt-4 text-sm font-medium">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="capitalize">{displayDate}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>{booking.start_time.substring(0, 5)} hs</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
              <span className="text-sm text-muted-foreground">
                Total: <span className="font-bold text-foreground">${booking.total_price.toLocaleString('es-AR')}</span>
              </span>
              
              <div className="flex gap-2">
                {!isPast && booking.status !== 'cancelled' && (
                  <>
                    <RescheduleDialog booking={booking} />
                    <CancelDialog booking={booking} />
                  </>
                )}
                {isPast && booking.status !== 'cancelled' && (
                  <Button variant="outline" size="sm" className="h-8 text-xs" render={
                    <Link href={`/venue/${booking.courts.venues.id}`}>
                      Dejar reseña
                    </Link>
                  } />
                )}
              </div>
            </div>
          </CardContent>
        </div>
      </Card>
    )
  }

  const renderEmptyState = (type: string) => (
    <div className="py-20 flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
        <Calendar className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold mb-2">No tienes reservas {type}</h3>
      <p className="text-muted-foreground max-w-sm mb-6">
        Explora las canchas disponibles y reserva tu próximo partido.
      </p>
      <Button render={
        <Link href="/search">
          <Search className="w-4 h-4 mr-2" />
          Buscar canchas
        </Link>
      } />
    </div>
  )

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight">Mis Reservas</h1>
        <p className="text-muted-foreground mt-2">Gestiona tus partidos y revisa tu historial.</p>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="mb-8 w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
          <TabsTrigger value="upcoming">Próximas ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Pasadas ({past.length})</TabsTrigger>
          <TabsTrigger value="cancelled">Canceladas ({cancelled.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="upcoming" className="space-y-4">
          {upcoming.length > 0 ? upcoming.map((b: any) => renderBookingCard(b, false)) : renderEmptyState("próximas")}
        </TabsContent>
        
        <TabsContent value="past" className="space-y-4">
          {past.length > 0 ? past.map((b: any) => renderBookingCard(b, true)) : renderEmptyState("pasadas")}
        </TabsContent>
        
        <TabsContent value="cancelled" className="space-y-4">
          {cancelled.length > 0 ? cancelled.map((b: any) => renderBookingCard(b, true)) : renderEmptyState("canceladas")}
        </TabsContent>
      </Tabs>
    </div>
  )
}
