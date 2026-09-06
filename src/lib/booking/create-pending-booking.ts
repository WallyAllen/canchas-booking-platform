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

  // Sin regla de precio para ese día y horario no se inventa un monto. El
  // fallback anterior era `price = 15000`, y como las tarjetas muestran "$0"
  // cuando no hay tarifas, el usuario veía gratis y se le cobraba $15.000 de un
  // valor que no configuró nadie. Preferimos no vender el turno.
  if (!rules || rules.length === 0) {
    throw new BookingError(
      'Este turno todavía no tiene tarifa configurada. Escribile al complejo para coordinarlo.',
      409
    )
  }

  const rule = rules[0] as PricingRule
  const price = rule.is_promo_active && rule.promo_price ? rule.promo_price : rule.price

  const venueId = court.venue_id as string
  const requireDeposit = court.venues?.require_deposit ?? true
  const depositPercentage = court.venues?.deposit_percentage ?? 30

  const depositAmount = requireDeposit ? Math.ceil((price * depositPercentage) / 100) : 0

  const credits = await getAvailableCredits(userId, venueId)
  const intendedCredits = depositAmount > 0 ? Math.min(credits, depositAmount) : 0

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
    // El índice único parcial (court_id, booking_date, start_time) es la defensa
    // real contra doble reserva. Pero que haya saltado no significa que el turno
    // lo tenga otro: lo más común es que sea una reserva pendiente del MISMO
    // usuario, de un intento anterior que no llegó a pagarse.
    //
    // Eso pasaba, por ejemplo, si volvía atrás desde la pantalla de transferencia
    // y reintentaba. Y era una trampa sin salida: la reserva pendiente por
    // transferencia vive 3 horas antes de que la levante el cron (migración 029),
    // así que el usuario quedaba sin poder reservar su propio turno durante todo
    // ese rato, viendo "Ese turno ya fue reservado" sobre algo que había
    // reservado él.
    //
    // Si el turno lo tiene su propia reserva pendiente, se reutiliza en vez de
    // fallar: es exactamente la reserva que estaba tratando de crear.
    if (insertError?.code === '23505') {
      const { data: existing } = await adminSupabase.from('bookings')
        .select('id, user_id, status, payment_status')
        .eq('court_id', courtId)
        .eq('booking_date', date)
        .eq('start_time', `${time}:00`)
        .neq('status', 'cancelled')
        .maybeSingle()

      const esPropiaYPendiente =
        existing?.user_id === userId &&
        existing?.status === 'pending' &&
        (existing?.payment_status === 'pending' || existing?.payment_status === 'awaiting_verification')

      if (existing && esPropiaYPendiente) {
        // Los créditos ya quedaron bloqueados contra esta reserva en el intento
        // anterior. Se leen en vez de volver a aplicarlos, porque aplicarlos de
        // nuevo bloquearía créditos de más.
        const { data: locked } = await adminSupabase.from('credits')
          .select('amount')
          .eq('locked_for_booking_id', existing.id)

        const yaBloqueado = (locked ?? []).reduce((acc, c) => acc + Number(c.amount), 0)

        return {
          bookingId: existing.id,
          venueId,
          price,
          depositAmount,
          amountToPay: Math.max(0, depositAmount - yaBloqueado),
          creditsApplied: yaBloqueado
        }
      }

      throw new BookingError('Ese turno ya fue reservado', 409)
    }
    console.error('Error creando reserva pendiente:', insertError)
    throw new BookingError('Error creando reserva temporal', 500)
  }

  // El monto a cobrar sale de lo que applyCredits logró bloquear DE VERDAD, no
  // de lo que había disponible al consultar. Entre las dos cosas puede perderse
  // una carrera: si otra reserva concurrente se llevó el mismo crédito, esta
  // tiene que cobrar la diferencia. Antes el retorno se descartaba y el usuario
  // se llevaba el descuento igual.
  let creditsApplied = 0
  if (intendedCredits > 0) {
    const notApplied = await applyCredits(userId, booking.id, venueId, intendedCredits)
    creditsApplied = Math.max(0, intendedCredits - notApplied)
  }

  const amountToPay = Math.max(0, depositAmount - creditsApplied)

  return {
    bookingId: booking.id,
    venueId,
    price,
    depositAmount,
    amountToPay,
    creditsApplied
  }
}
