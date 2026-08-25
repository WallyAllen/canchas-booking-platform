/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BookingWizard } from "@/components/booking/BookingWizard"

export const dynamic = 'force-dynamic'

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: { courtId: string }
  searchParams: { date?: string; time?: string }
}) {
  const supabase = await createClient()

  // 1. Check Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const returnUrl = encodeURIComponent(`/booking/${params.courtId}?date=${searchParams.date}&time=${searchParams.time}`)
    redirect(`/login?returnUrl=${returnUrl}`)
  }

  const { date, time } = searchParams
  if (!date || !time) {
    redirect("/search")
  }

  // 2. Obtener info de la cancha y el complejo
  const { data: court, error: courtError } = await (supabase.from("courts") as any)
    .select("*, venues(*)")
    .eq("id", params.courtId)
    .single()

  if (courtError || !court) {
    return (
      <div className="container py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">Cancha no encontrada</h2>
        <a href="/search" className="text-primary hover:underline">Volver a buscar</a>
      </div>
    )
  }

  // 3. Obtener el precio para ese día y horario usando pricing_rules
  const bookingDate = new Date(`${date}T${time}`)
  const dayOfWeek = bookingDate.getDay() // 0 = Domingo, 1 = Lunes...
  const timeStr = time.substring(0, 5) // HH:MM

  const { data: rules } = await (supabase.from("pricing_rules") as any)
    .select("*")
    .eq("court_id", court.id)
    .eq("day_of_week", dayOfWeek)
    .lte("start_time", `${timeStr}:00`)
    .gte("end_time", `${timeStr}:00`)

  let price = 0
  let isPromo = false

  if (rules && rules.length > 0) {
    // Tomar la regla que encaje
    const rule = rules[0]
    if (rule.is_promo_active && rule.promo_price) {
      price = rule.promo_price
      isPromo = true
    } else {
      price = rule.price
    }
  }

  // Si no hay precio configurado, fallback para MVP
  if (price === 0) price = 15000

  // 4. Verificar disponibilidad (que no exista un booking pagado/confirmado/pendiente para ese slot)
  const { data: existingBookings } = await (supabase.from("bookings") as any)
    .select("id")
    .eq("court_id", court.id)
    .eq("booking_date", date)
    .eq("start_time", time)
    .neq("status", "cancelled")
    
  const isAvailable = !existingBookings || existingBookings.length === 0

  if (!isAvailable) {
    return (
      <div className="container max-w-2xl mx-auto py-20 text-center">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8">
          <span className="text-4xl mb-4 block">😔</span>
          <h2 className="text-2xl font-bold mb-2">Turno Ocupado</h2>
          <p className="text-muted-foreground mb-6">Alguien más reservó este turno hace unos instantes.</p>
          <a href={`/venue/${court.venue_id}`} className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
            Ver otros horarios
          </a>
        </div>
      </div>
    )
  }

  // 5. Generar un Booking temporal (Pending) para poder crear la preferencia de pago
  const { data: booking, error: insertError } = await (supabase.from("bookings") as any)
    .insert({
      user_id: user.id,
      court_id: court.id,
      booking_date: date,
      start_time: time,
      end_time: "23:59:00", // En MVP es de 1h pero simplificamos
      total_price: price,
      payment_status: "pending",
      booking_status: "pending"
    })
    .select()
    .single()

  if (insertError) {
    console.error("Error creating temporary booking:", insertError)
    return <div>Error al iniciar reserva.</div>
  }

  const bookingData = {
    id: booking.id,
    courtName: court.name,
    venueName: court.venues.name,
    date,
    time: timeStr,
    price,
    isPromo
  }

  return (
    <div className="container max-w-3xl mx-auto px-4 py-8 md:py-12">
      <BookingWizard booking={bookingData} />
    </div>
  )
}
