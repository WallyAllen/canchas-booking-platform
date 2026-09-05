import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Cubre las ramas de decisión del webhook de Mercado Pago cuando llega un pago
 * aprobado y la reserva ya no está en el estado que el webhook esperaba.
 *
 * El caso que motiva estos tests: el cron cancela la reserva a los 15 minutos
 * (migración 031) y el webhook llega después. Antes ese camino tiraba 500 y MP
 * reintentaba hasta rendirse, dejando plata cobrada sin reserva ni rastro.
 */

const mocks = vi.hoisted(() => ({
  paymentData: {
    id: 987654321,
    status: 'approved',
    external_reference: 'booking-uuid-1',
    transaction_amount: 4500,
    payer: { email: 'jugador@example.com' }
  } as Record<string, unknown>,
  currentBooking: null as Record<string, unknown> | null,
  updateResult: { data: null, error: null } as {
    data: Record<string, unknown> | null
    error: { code?: string; message?: string } | null
  },
  updateSpy: vi.fn(),
  notifySpy: vi.fn(),
  upsertSpy: vi.fn(),
  upsertError: null as { message: string } | null
}))

vi.mock('mercadopago', () => ({
  MercadoPagoConfig: class {},
  Payment: class {
    async get() {
      return mocks.paymentData
    }
  }
}))

vi.mock('@/lib/mercadopago/helpers', () => ({
  verifyWebhookSignature: () => true
}))

vi.mock('@/lib/credits/manager', () => ({
  consumeLockedCredits: vi.fn(async () => undefined)
}))

vi.mock('@/lib/notifications', () => ({
  notify: (...args: unknown[]) => {
    mocks.notifySpy(...args)
    return Promise.resolve()
  }
}))

vi.mock('@vercel/functions', () => ({
  waitUntil: (p: Promise<unknown>) => p
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: mocks.currentBooking, error: null })
        })
      }),
      update: (payload: Record<string, unknown>) => {
        mocks.updateSpy(payload)
        return {
          eq: () => ({
            select: () => ({
              single: async () => mocks.updateResult
            })
          })
        }
      },
      upsert: async (payload: Record<string, unknown>, opts: Record<string, unknown>) => {
        mocks.upsertSpy(table, payload, opts)
        return { error: mocks.upsertError }
      }
    })
  })
}))

// vi.mock se hoistea por encima de los imports, así que este import estático ya
// recibe las versiones falsas. (Un `await import()` acá rompería `tsc`: el
// tsconfig del proyecto no habilita top-level await.)
import { POST } from '@/app/api/webhooks/mercadopago/route'

function webhookRequest() {
  return new Request('https://reservaya.app/api/webhooks/mercadopago?topic=payment&data.id=987654321', {
    method: 'POST',
    headers: {
      'x-signature': 'ts=1,v1=deadbeef',
      'x-request-id': 'req-1'
    }
  })
}

/** Mañana, para que el turno nunca esté vencido por el paso del tiempo real. */
function futureDate() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

describe('webhook de Mercado Pago: pago aprobado sobre reserva no vigente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.MP_WEBHOOK_SECRET = 'secreto-de-prueba'
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'APP_USR-token-productivo'
    mocks.currentBooking = null
    mocks.updateResult = { data: null, error: null }
    mocks.upsertError = null
  })

  it('no escribe nada y corta los reintentos si la reserva no existe', async () => {
    mocks.currentBooking = null

    const res = await POST(webhookRequest())

    // 200 y no 500: un 5xx solo haría que MP reintente y esconda el problema.
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ reconcile: 'reserva_inexistente' })
    expect(mocks.updateSpy).not.toHaveBeenCalled()
  })

  it('encola el pago huérfano para reconciliación, de forma idempotente', async () => {
    mocks.currentBooking = null

    await POST(webhookRequest())

    expect(mocks.upsertSpy).toHaveBeenCalledWith(
      'payment_reconciliations',
      expect.objectContaining({
        mp_payment_id: '987654321',
        booking_id: 'booking-uuid-1',
        reason: 'reserva_inexistente',
        amount: 4500,
        payer_email: 'jugador@example.com'
      }),
      // Sin esto, cada reintento de MP agregaría una fila más a la cola.
      expect.objectContaining({ onConflict: 'mp_payment_id', ignoreDuplicates: true })
    )
  })

  it('sigue devolviendo 200 aunque falle el encolado', async () => {
    mocks.currentBooking = null
    mocks.upsertError = { message: 'tabla inaccesible' }

    const res = await POST(webhookRequest())

    // Perder la fila de la cola no debe convertirse en un 500 que haga
    // reintentar a MP; el console.error queda como rastro de respaldo.
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ reconcile: 'reserva_inexistente' })
  })

  it('es idempotente si la reserva ya figura pagada', async () => {
    mocks.currentBooking = {
      id: 'booking-uuid-1',
      status: 'confirmed',
      payment_status: 'paid',
      cancelled_reason: null,
      booking_date: futureDate(),
      start_time: '20:00:00'
    }

    const res = await POST(webhookRequest())

    expect(res.status).toBe(200)
    expect(mocks.updateSpy).not.toHaveBeenCalled()
  })

  it('no resucita una reserva que canceló una persona', async () => {
    mocks.currentBooking = {
      id: 'booking-uuid-1',
      status: 'cancelled',
      payment_status: 'pending',
      cancelled_reason: 'user_request',
      booking_date: futureDate(),
      start_time: '20:00:00'
    }

    const res = await POST(webhookRequest())

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ reconcile: 'cancelada_a_proposito' })
    expect(mocks.updateSpy).not.toHaveBeenCalled()
  })

  it('no confirma un turno que ya pasó', async () => {
    mocks.currentBooking = {
      id: 'booking-uuid-1',
      status: 'cancelled',
      payment_status: 'pending',
      cancelled_reason: 'payment_timeout',
      booking_date: '2020-01-01',
      start_time: '20:00:00'
    }

    const res = await POST(webhookRequest())

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ reconcile: 'turno_ya_vencido' })
    expect(mocks.updateSpy).not.toHaveBeenCalled()
  })

  it('resucita la reserva que el cron canceló por vencimiento y guarda el payment id', async () => {
    mocks.currentBooking = {
      id: 'booking-uuid-1',
      status: 'cancelled',
      payment_status: 'pending',
      cancelled_reason: 'payment_timeout',
      booking_date: futureDate(),
      start_time: '20:00:00'
    }
    mocks.updateResult = {
      data: { id: 'booking-uuid-1', profiles: { id: 'user-1' }, courts: { venues: { id: 'venue-1' } } },
      error: null
    }

    const res = await POST(webhookRequest())

    expect(res.status).toBe(200)
    expect(mocks.updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_status: 'paid',
        status: 'confirmed',
        mp_payment_id: '987654321',
        cancelled_at: null,
        cancelled_reason: null
      })
    )
    expect(mocks.notifySpy).toHaveBeenCalled()
  })

  it('marca para reembolso si otro usuario ya tomó el turno (23505)', async () => {
    mocks.currentBooking = {
      id: 'booking-uuid-1',
      status: 'cancelled',
      payment_status: 'pending',
      cancelled_reason: 'payment_timeout',
      booking_date: futureDate(),
      start_time: '20:00:00'
    }
    // El índice parcial bookings_no_double_booking_idx (migración 008) rechaza
    // reactivar un turno que ya tiene otra reserva activa.
    mocks.updateResult = { data: null, error: { code: '23505', message: 'duplicate key' } }

    const res = await POST(webhookRequest())

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ reconcile: 'turno_reasignado' })
    expect(mocks.notifySpy).not.toHaveBeenCalled()
  })
})
