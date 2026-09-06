import { createClient } from "@/lib/supabase/server"
import { calculateCancellationPolicy, createCredit, canReschedule } from "@/lib/credits/manager"

export async function cancelBooking(bookingId: string) {
  const supabase = await createClient()

  // 1. Get user and booking
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data: booking, error: getError } = await supabase.from("bookings")
    .select("*, profiles(*), courts(*, venues(*))")
    .eq("id", bookingId)
    .eq("user_id", user.id)
    .single()

  if (getError || !booking) throw new Error("Reserva no encontrada")
  if (booking.status === 'cancelled') throw new Error("La reserva ya está cancelada")

  // 2. Check cancellation policy
  const policy = calculateCancellationPolicy(booking)
  if (!policy.canCancel) {
    throw new Error(policy.reason)
  }

  // 3. Cancelar la reserva
  const { error: updateError } = await supabase.from("bookings")
    .update({ 
      status: 'cancelled',
      cancelled_at: new Date().toISOString() 
    })
    .eq("id", bookingId)

  if (updateError) throw new Error("Error al cancelar la reserva")

  // 4. Si corresponde crédito, lo creamos
  if (policy.refundType === 'credit' && policy.creditAmount > 0) {
    await createCredit(user.id, booking.id, booking.courts.venues.id, policy.creditAmount)
  }

  // 5. Notificar
  //
  // Con `waitUntil` y no con `await`: desde que notify() dejó de esconderse en
  // un setTimeout, esperarla dejaría al usuario mirando el spinner mientras
  // responden Resend y WhatsApp, y una caída de esos servicios haría colgar la
  // cancelación. waitUntil mantiene viva la función serverless hasta que el
  // envío termine, sin retrasar la respuesta.
  const { notify } = await import('@/lib/notifications')
  const { waitUntil } = await import('@vercel/functions')
  waitUntil(
    notify('booking_cancelled', {
      booking,
      user: booking.profiles,
      venue: booking.courts?.venues,
      creditAmount: policy.creditAmount || 0
    })
  )

  return { success: true, policy }
}

export async function rescheduleBooking(bookingId: string, newDate: string, newTime: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data: booking, error: getError } = await supabase.from("bookings")
    .select("*")
    .eq("id", bookingId)
    .eq("user_id", user.id)
    .single()

  if (getError || !booking) throw new Error("Reserva no encontrada")

  const policy = canReschedule(booking)
  if (!policy.allowed) {
    throw new Error(policy.reason)
  }

  // Verificar disponibilidad del nuevo slot
  const { data: existingBookings } = await supabase.from("bookings")
    .select("id")
    .eq("court_id", booking.court_id)
    .eq("booking_date", newDate)
    .eq("start_time", newTime)
    .neq("status", "cancelled")
    .neq("id", bookingId) // excluímos la reserva actual

  if (existingBookings && existingBookings.length > 0) {
    throw new Error("El nuevo horario no está disponible")
  }

  // Actualizar la reserva
  const { error: updateError } = await supabase.from("bookings")
    .update({ 
      booking_date: newDate,
      start_time: newTime
    })
    .eq("id", bookingId)

  if (updateError) throw new Error("Error al reprogramar la reserva")

  return { success: true }
}
