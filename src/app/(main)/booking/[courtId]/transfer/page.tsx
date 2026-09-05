export const dynamic = 'force-dynamic'

import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TransferInstructions } from "@/components/booking/transfer-instructions"

export default async function TransferPage({
  params,
  searchParams,
}: {
  params: { courtId: string }
  searchParams: { booking_id?: string }
}) {
  const bookingId = searchParams.booking_id
  if (!bookingId) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/booking/${params.courtId}/transfer?booking_id=${bookingId}`)

  const selection = "id, user_id, booking_date, start_time, deposit_amount, payment_status, status, deposit_method, courts(name, venue_id, venues(name))" as const

  const { data: booking } = await supabase
    .from("bookings")
    .select<typeof selection, {
      id: string
      user_id: string
      booking_date: string
      start_time: string
      deposit_amount: number | null
      payment_status: string
      status: string
      deposit_method: string | null
      courts: { name: string; venue_id: string; venues: { name: string } | null } | null
    }>(selection)
    .eq("id", bookingId)
    .single()

  if (!booking || booking.user_id !== user.id) notFound()

  const venueId = booking.courts?.venue_id
  if (!venueId) notFound()

  const venueName = booking.courts?.venues?.name ?? "el complejo"
  const courtName = booking.courts?.name ?? ""

  // La policy de 027 solo devuelve fila si el usuario tiene una reserva viva
  // por transferencia en este complejo — que es exactamente el caso acá.
  const { data: paymentDetails } = await supabase
    .from("venue_payment_details")
    .select("alias, cbu, holder_name, bank_name")
    .eq("venue_id", venueId)
    .maybeSingle()

  return (
    <TransferInstructions
      bookingId={booking.id}
      venueId={venueId}
      venueName={venueName}
      courtName={courtName}
      bookingDate={booking.booking_date}
      startTime={booking.start_time}
      depositAmount={Number(booking.deposit_amount ?? 0)}
      paymentStatus={booking.payment_status}
      paymentDetails={paymentDetails ?? null}
    />
  )
}
