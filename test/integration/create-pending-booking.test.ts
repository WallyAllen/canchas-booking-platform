import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Cubre el bug reportado: reintentar una reserva propia devolvía "Ese turno ya
 * fue reservado" sobre un turno que había tomado uno mismo, y como una reserva
 * por transferencia vive 3 horas antes de que la levante el cron, el usuario
 * quedaba encerrado todo ese rato.
 */

const state = vi.hoisted(() => ({
  court: { venue_id: 'venue-1', venues: { require_deposit: true, deposit_percentage: 30 } } as unknown,
  rules: [{ price: 10000, promo_price: null, is_promo_active: false }] as unknown[],
  insertResult: { data: { id: 'booking-nueva' }, error: null } as { data: unknown; error: { code?: string } | null },
  existing: null as unknown,
  lockedCredits: [] as Array<{ amount: number }>,
  creditosDisponibles: 0,
  applyCreditsLlamado: 0
}))

function chain(result: unknown) {
  const o: Record<string, unknown> = {}
  for (const m of ['eq', 'lte', 'gte', 'neq', 'is', 'gt', 'order', 'limit', 'select']) o[m] = () => o
  o.single = async () => result
  o.maybeSingle = async () => result
  o.then = (res: (v: unknown) => void) => res(result)
  return o
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (tabla: string) => ({
      select: () =>
        tabla === 'courts'
          ? chain({ data: state.court, error: null })
          : chain({ data: state.rules, error: null })
    })
  }),
  createAdminClient: () => ({
    from: (tabla: string) => ({
      insert: () => chain(state.insertResult),
      select: () =>
        tabla === 'credits'
          ? chain({ data: state.lockedCredits, error: null })
          : chain({ data: state.existing, error: null })
    })
  })
}))

vi.mock('@/lib/credits/manager', () => ({
  getAvailableCredits: async () => state.creditosDisponibles,
  applyCredits: async () => {
    state.applyCreditsLlamado++
    return 0
  }
}))

import { createPendingBooking, BookingError } from '@/lib/booking/create-pending-booking'

const params = {
  courtId: 'court-1',
  date: '2026-09-10',
  time: '20:00',
  userId: 'user-1',
  depositMethod: 'transfer' as const
}

describe('createPendingBooking', () => {
  beforeEach(() => {
    state.court = { venue_id: 'venue-1', venues: { require_deposit: true, deposit_percentage: 30 } }
    state.rules = [{ price: 10000, promo_price: null, is_promo_active: false }]
    state.insertResult = { data: { id: 'booking-nueva' }, error: null }
    state.existing = null
    state.lockedCredits = []
    state.creditosDisponibles = 0
    state.applyCreditsLlamado = 0
  })

  it('crea la reserva y calcula la seña según el complejo', async () => {
    const r = await createPendingBooking(params)

    expect(r.bookingId).toBe('booking-nueva')
    expect(r.price).toBe(10000)
    expect(r.depositAmount).toBe(3000) // 30%
    expect(r.amountToPay).toBe(3000)
  })

  it('se niega a inventar un precio si no hay tarifa para ese horario', async () => {
    // Antes caía en `price = 15000` mientras las tarjetas mostraban "$0".
    state.rules = []

    await expect(createPendingBooking(params)).rejects.toThrow(/no tiene tarifa configurada/)
  })

  it('reutiliza la reserva propia pendiente en vez de decir que el turno está tomado', async () => {
    state.insertResult = { data: null, error: { code: '23505' } }
    state.existing = {
      id: 'booking-previa',
      user_id: 'user-1',
      status: 'pending',
      payment_status: 'pending'
    }

    const r = await createPendingBooking(params)

    expect(r.bookingId).toBe('booking-previa')
  })

  it('reutiliza también si ya reportó la transferencia', async () => {
    state.insertResult = { data: null, error: { code: '23505' } }
    state.existing = {
      id: 'booking-previa',
      user_id: 'user-1',
      status: 'pending',
      payment_status: 'awaiting_verification'
    }

    const r = await createPendingBooking(params)

    expect(r.bookingId).toBe('booking-previa')
  })

  it('no vuelve a aplicar créditos sobre la reserva reutilizada', async () => {
    // Aplicarlos de nuevo bloquearía créditos de más: se leen los ya bloqueados.
    state.creditosDisponibles = 5000
    state.insertResult = { data: null, error: { code: '23505' } }
    state.existing = { id: 'booking-previa', user_id: 'user-1', status: 'pending', payment_status: 'pending' }
    state.lockedCredits = [{ amount: 2000 }]

    const r = await createPendingBooking(params)

    expect(state.applyCreditsLlamado).toBe(0)
    expect(r.creditsApplied).toBe(2000)
    expect(r.amountToPay).toBe(1000) // seña 3000 - 2000 ya bloqueados
  })

  it('sí falla si el turno lo tiene otro usuario', async () => {
    state.insertResult = { data: null, error: { code: '23505' } }
    state.existing = { id: 'ajena', user_id: 'otro-user', status: 'pending', payment_status: 'pending' }

    await expect(createPendingBooking(params)).rejects.toThrow(/Ese turno ya fue reservado/)
  })

  it('sí falla si la reserva propia ya está confirmada', async () => {
    state.insertResult = { data: null, error: { code: '23505' } }
    state.existing = { id: 'propia', user_id: 'user-1', status: 'confirmed', payment_status: 'paid' }

    await expect(createPendingBooking(params)).rejects.toThrow(BookingError)
  })
})
