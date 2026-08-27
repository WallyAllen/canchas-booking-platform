import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { BookingsClient } from "@/components/dashboard/bookings/BookingsClient"

export const dynamic = 'force-dynamic'

export default async function VenueBookingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: venues } = await (supabase.from("venues") as any)
    .select("*, courts(id, name)")
    .eq("owner_id", user.id)

  const venue = venues?.[0]
  if (!venue) redirect("/dashboard")

  const courtIds = venue.courts.map((c: any) => c.id)

  const { data: bookingsData } = await (supabase.from("bookings") as any)
    .select("*, courts(name), profiles(full_name, email, phone)")
    .in("court_id", courtIds)

  const bookings = bookingsData || []

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reservas</h1>
          <p className="text-muted-foreground">Gestión de reservas y horarios de tu complejo.</p>
        </div>
      </div>

      <BookingsClient initialBookings={bookings} courts={venue.courts} />
    </div>
  )
}
