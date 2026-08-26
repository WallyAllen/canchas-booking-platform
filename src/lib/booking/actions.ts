/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { createClient } from "@/lib/supabase/server"
import { calculateCancellationPolicy, createCredit, canReschedule } from "@/lib/credits/manager"

export async function cancelBooking(bookingId: string) {
  const supabase = await createClient()
  
  // 1. Get user and booking
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data: booking, error: getError } = await (supabase.from("bookings") as any)
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
  const { error: updateError } = await (supabase.from("bookings") as any)
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
  const { notify } = await import('@/lib/notifications')
  await notify('booking_cancelled', {
    booking,
    user: booking.profiles,
    venue: booking.courts?.venues,
    creditAmount: policy.creditAmount || 0
  })

  return { success: true, policy }
}

export async function rescheduleBooking(bookingId: string, newDate: string, newTime: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data: booking, error: getError } = await (supabase.from("bookings") as any)
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
  const { data: existingBookings } = await (supabase.from("bookings") as any)
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
  const { error: updateError } = await (supabase.from("bookings") as any)
    .update({ 
      booking_date: newDate,
      start_time: newTime
    })
    .eq("id", bookingId)

  if (updateError) throw new Error("Error al reprogramar la reserva")

  return { success: true }
}
