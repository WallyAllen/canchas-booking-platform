import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Cubre los dos agujeros de plata que tenía `applyCredits`:
 *
 * 1. Usaba el cliente del usuario para hacer UPDATE sobre `credits`, permiso que
 *    la migración 015 dejó solo para admins. El bloqueo filtraba a 0 filas sin
 *    error, así que no se bloqueaba nada mientras el descuento sí se aplicaba.
 * 2. Un crédito mayor que la seña se consumía entero y la diferencia se perdía.
 */

interface CreditRow {
  id: string
  user_id: string
  venue_id: string
  booking_id: string
  amount: number
  expires_at: string
}

const state = vi.hoisted(() => ({
  credits: [] as unknown[],
  /** Resultado de cada intento de bloqueo, en orden. */
  lockResults: [] as Array<Array<{ id: string; amount: number }>>,
  insertError: null as { message: string } | null,
  inserts: [] as Array<Record<string, unknown>>,
  shrinks: [] as Array<Record<string, unknown>>,
  usedAdminClient: false
}))

/** Encadenable y awaitable: sirve para `.eq().is().gt().order()` y para `.select()`. */
function chain(result: unknown) {
  const obj: Record<string, unknown> = {}
  for (const method of ['eq', 'is', 'gt', 'order', 'select', 'limit']) {
    obj[method] = () => obj
  }
  obj.then = (resolve: (v: unknown) => void) => resolve(result)
  return obj
}

function fakeClient() {
  return {
    from: () => ({
      select: () => chain({ data: state.credits, error: null }),
      update: (payload: Record<string, unknown>) => {
        if ('locked_for_booking_id' in payload) {
          const next = state.lockResults.shift() ?? []
          return chain({ data: next, error: null })
        }
        // El otro UPDATE es el que achica el crédito partido.
        state.shrinks.push(payload)
        return chain({ error: null })
      },
      insert: (payload: Record<string, unknown>) => {
        state.inserts.push(payload)
        return Promise.resolve({ error: state.insertError })
      }
    })
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => fakeClient(),
  createAdminClient: () => {
    state.usedAdminClient = true
    return fakeClient()
  }
}))

import { applyCredits } from '@/lib/credits/manager'

function credit(id: string, amount: number): CreditRow {
  return {
    id,
    user_id: 'user-1',
    venue_id: 'venue-1',
    booking_id: 'booking-origen',
    amount,
    expires_at: '2030-01-01T00:00:00Z'
  }
}

describe('applyCredits', () => {
  beforeEach(() => {
    state.credits = []
    state.lockResults = []
    state.insertError = null
    state.inserts = []
    state.shrinks = []
    state.usedAdminClient = false
  })

  it('usa el admin client: con el del usuario la RLS de la migración 015 bloquea el UPDATE', async () => {
    state.credits = [credit('c1', 3000)]
    state.lockResults = [[{ id: 'c1', amount: 3000 }]]

    await applyCredits('user-1', 'booking-1', 'venue-1', 3000)

    expect(state.usedAdminClient).toBe(true)
  })

  it('consume el crédito entero cuando no supera lo que hay que cubrir', async () => {
    state.credits = [credit('c1', 3000)]
    state.lockResults = [[{ id: 'c1', amount: 3000 }]]

    const notApplied = await applyCredits('user-1', 'booking-1', 'venue-1', 3000)

    expect(notApplied).toBe(0)
    expect(state.inserts).toHaveLength(0)
    expect(state.shrinks).toHaveLength(0)
  })

  it('parte el crédito y devuelve el excedente en vez de quemarlo', async () => {
    // El caso del reporte: crédito de $5000 contra una seña de $3000.
    state.credits = [credit('c1', 5000)]
    state.lockResults = [[{ id: 'c1', amount: 5000 }]]

    const notApplied = await applyCredits('user-1', 'booking-1', 'venue-1', 3000)

    expect(notApplied).toBe(0)
    expect(state.inserts).toHaveLength(1)
    expect(state.inserts[0]).toMatchObject({
      amount: 2000,
      status: 'available',
      venue_id: 'venue-1',
      expires_at: '2030-01-01T00:00:00Z'
    })
    // Y el original queda reducido a lo que realmente cubre.
    expect(state.shrinks[0]).toMatchObject({ amount: 3000 })
  })

  it('parte solo el último crédito cuando hace falta más de uno', async () => {
    state.credits = [credit('c1', 2000), credit('c2', 2000)]
    state.lockResults = [
      [{ id: 'c1', amount: 2000 }],
      [{ id: 'c2', amount: 2000 }]
    ]

    const notApplied = await applyCredits('user-1', 'booking-1', 'venue-1', 3000)

    expect(notApplied).toBe(0)
    expect(state.inserts).toHaveLength(1)
    expect(state.inserts[0]).toMatchObject({ amount: 1000 })
    expect(state.shrinks[0]).toMatchObject({ amount: 1000 })
  })

  it('informa lo que no pudo aplicar si otra reserva ganó la carrera', async () => {
    // El UPDATE condicional devuelve 0 filas: otro request bloqueó el crédito.
    // Ese faltante es lo que create-pending-booking tiene que cobrar igual.
    state.credits = [credit('c1', 3000)]
    state.lockResults = [[]]

    const notApplied = await applyCredits('user-1', 'booking-1', 'venue-1', 3000)

    expect(notApplied).toBe(3000)
    expect(state.inserts).toHaveLength(0)
  })

  it('no achica el crédito si falló emitir el excedente', async () => {
    // Achicar sin haber emitido el excedente sería justamente perder la plata
    // que este arreglo viene a proteger. Se prefiere dejarlo entero.
    state.credits = [credit('c1', 5000)]
    state.lockResults = [[{ id: 'c1', amount: 5000 }]]
    state.insertError = { message: 'sin conexión' }

    const notApplied = await applyCredits('user-1', 'booking-1', 'venue-1', 3000)

    expect(notApplied).toBe(0)
    expect(state.shrinks).toHaveLength(0)
  })
})
