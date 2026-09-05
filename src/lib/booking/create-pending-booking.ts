import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getAvailableCredits, applyCredits } from '@/lib/credits/manager'
import type { PricingRule } from '@/types/domain'

export type DepositMethod = 'mercadopago' | 'transfer'

export interface PendingBooking {
  bookingId: string
  venueId: string
  /** Precio total del turno. */
  price: number
  /** Seña calculada según la configuración del complejo. */
  depositAmount: number
  /** Lo que queda por pagar después de aplicar créditos disponibles. */
  amountToPay: number
  creditsApplied: number
}

export class BookingError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'BookingError'
  }
}

/**
 * Crea una reserva en estado `pending` y bloquea los créditos que apliquen.
 *
 * Es el único lugar donde se calcula el precio y la seña para una reserva nueva
 * de la plataforma: tanto el flujo de Mercado Pago como el de transferencia
 * pasan por acá, para que no vuelvan a divergir.
 *
 * El caller decide qué hacer después según `amountToPay` y el método elegido.
 */
export async function createPendingBooking(params: {
  courtId: string
  date: string
  time: string
  userId: string
  depositMethod: DepositMethod
}): Promise<PendingBooking> {
  const { courtId, date, time, userId, depositMethod } = params

  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const { data: court } = await supabase.from('courts')
    .select('venue_id, venues(require_deposit, deposit_percentage)')
    .eq('id', courtId)
    .single()

  if (!court) {
    throw new BookingError('Cancha no encontrada', 404)
  }

  // Precio según pricing_rules para ese día y horario.
  const bookingDate = new Date(`${date}T${time}`)
  const dayOfWeek = bookingDate.getDay()

  const { data: rules } = await supabase.from('pricing_rules')
    .select('*')
    .eq('court_id', courtId)
    .eq('day_of_week', dayOfWeek)
    .lte('start_time', `${time}:00`)
    .gte('end_time', `${time}:00`)

  let price = 15000
  if (rules && rules.length > 0) {
    const rule = rules[0] as PricingRule
    price = rule.is_promo_active && rule.promo_price ? rule.promo_price : rule.price
  }

  // @ts-expect-error fix inference
  const venueId = court.venue_id as string
  // @ts-expect-error fix inference
  const requireDeposit = (court.venues?.require_deposit ?? true) as boolean
  // @ts-expect-error fix inference
  const depositPercentage = (court.venues?.deposit_percentage ?? 30) as number

  const depositAmount = requireDeposit ? Math.ceil((price * depositPercentage) / 100) : 0

  const credits = await getAvailableCredits(userId, venueId)
  const creditsApplied = depositAmount > 0 ? Math.min(credits, depositAmount) : 0
  const amountToPay = Math.max(0, depositAmount - creditsApplied)

  const { data: booking, error: insertError } = await adminSupabase.from('bookings')
    .insert({
      user_id: userId,
      court_id: courtId,
      booking_date: date,
      start_time: `${time}:00`,
      end_time: '23:59:00',
      total_price: price,
      deposit_amount: depositAmount,
      deposit_method: depositMethod,
      payment_status: 'pending',
      status: 'pending'
    })
    .select()
    .single()

  if (insertError || !booking) {
    // El índice único (court_id, booking_date, start_time) es la defensa real
    // contra doble reserva; si saltó, el turno se tomó mientras tanto.
    if (insertError?.code === '23505') {
      throw new BookingError('Ese turno ya fue reservado', 409)
    }
    console.error('Error creando reserva pendiente:', insertError)
    throw new BookingError('Error creando reserva temporal', 500)
  }

  if (creditsApplied > 0) {
    await applyCredits(userId, booking.id, venueId, creditsApplied)
  }

  return {
    bookingId: booking.id,
    venueId,
    price,
    depositAmount,
    amountToPay,
    creditsApplied
  }
}
