/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Calendar, Clock, MapPin,ChevronRight } from "lucide-react"
import Link from "next/link"

export const dynamic = 'force-dynamic'

export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: { booking_id?: string; payment_id?: string; status?: string }
}) {
  const { booking_id } = searchParams
  
  if (!booking_id) {
    redirect("/search")
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: booking, error } = await (supabase.from("bookings") as any)
    .select(`
      *,
      courts (
        name,
        venues (
          name,
          address
        )
      )
    `)
    .eq("id", booking_id)
    .eq("user_id", user.id)
    .single()

  if (error || !booking) {
    return (
      <div className="container py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">Error al cargar la reserva</h2>
        <Link href="/bookings" className="text-primary hover:underline">Ver mis reservas</Link>
      </div>
    )
  }

  const dateObj = new Date(`${booking.booking_date}T12:00:00`)
  const displayDate = dateObj.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  const deposit = Math.ceil(booking.total_price * 0.3)

  return (
    <div className="container max-w-2xl mx-auto px-4 py-12 md:py-20">
      <Card className="border-border/50 bg-card overflow-hidden">
        <div className="bg-green-500/10 p-8 text-center border-b border-green-500/20">
          <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-green-500 mb-2">¡Reserva Confirmada!</h1>
          <p className="text-muted-foreground">Tu pago ha sido procesado exitosamente y la cancha ya es tuya.</p>
        </div>
        
        <CardContent className="p-6 md:p-8 space-y-6">
          <div className="space-y-4 bg-muted/20 p-6 rounded-xl border border-border/50">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-lg">{booking.courts.name}</p>
                <p className="text-muted-foreground">{booking.courts.venues.name} - {booking.courts.venues.address}</p>
              </div>
            </div>
            <div className="h-px bg-border/50 w-full" />
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary shrink-0" />
              <p className="capitalize font-medium">{displayDate}</p>
            </div>
            <div className="h-px bg-border/50 w-full" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-primary shrink-0" />
                <p className="font-medium">{booking.start_time.substring(0, 5)} hs</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-sm px-2">
            <span className="text-muted-foreground">Seña abonada:</span>
            <span className="font-bold text-primary">${deposit.toLocaleString('es-AR')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <Button variant="outline" className="w-full" render={
              <Link href="/bookings">
                Ver mis reservas
              </Link>
            } />
            <Button className="w-full" render={
              <a href={`https://wa.me/?text=¡Tengo%20cancha!%20Jugamos%20el%20${displayDate}%20a%20las%20${booking.start_time.substring(0,5)}%20hs%20en%20${booking.courts.venues.name}.`} target="_blank" rel="noopener noreferrer">
                Invitar amigos <ChevronRight className="w-4 h-4 ml-1" />
              </a>
            } />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
