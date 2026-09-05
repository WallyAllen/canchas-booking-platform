import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Fija que abandonar el checkout CANCELE la reserva, no que la borre.
 *
 * El bug original: `bookings` tiene RLS sin policy `FOR DELETE`, así que el
 * `.delete()` filtraba a 0 filas sin devolver error y la acción respondía
 * `{ success: true }` sin haber hecho nada.
 */

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  updateSpy: vi.fn(),
  filters: [] as Array<[string, unknown]>,
  updateResult: { data: [{ id: 'booking-1' }], error: null } as {
    data: Array<{ id: string }> | null
    error: { message: string } | null
  },
  deleteSpy: vi.fn(),
  unlockSpy: vi.fn(),
  unlockError: null as { message: string } | null
}))

/** Builder encadenable: `.eq()` acumula filtros y `.select()` cierra el update. */
function makeUpdateChain() {
  const chain = {
    eq: (col: string, value: unknown) => {
      mocks.filters.push([col, value])
      return chain
    },
    select: async () => mocks.updateResult
  }
  return chain
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
    from: () => ({
      update: (payload: Record<string, unknown>) => {
        mocks.updateSpy(payload)
        return makeUpdateChain()
      },
      delete: () => {
        mocks.deleteSpy()
        return { eq: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }) }
      }
    })
  }),
  createAdminClient: () => ({
    from: () => ({
      update: (payload: Record<string, unknown>) => ({
        eq: async (col: string, value: unknown) => {
          mocks.unlockSpy(payload, col, value)
          return { error: mocks.unlockError }
        }
      })
    })
  })
}))

import { cancelPendingBooking } from '@/app/actions/booking'

describe('cancelPendingBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'user-1' }
    mocks.filters = []
    mocks.updateResult = { data: [{ id: 'booking-1' }], error: null }
    mocks.unlockError = null
  })

  it('cancela en vez de borrar', async () => {
    const res = await cancelPendingBooking('booking-1')

    expect(res).toEqual({ success: true })
    // Borrar reintroduciría el pago huérfano que resolvió la migración 031.
    expect(mocks.deleteSpy).not.toHaveBeenCalled()
    expect(mocks.updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled', cancelled_reason: 'user_abandoned' })
    )
  })

  it("no marca 'payment_timeout': un pago tardío no debe resucitar lo que el usuario abandonó", async () => {
    await cancelPendingBooking('booking-1')

    const payload = mocks.updateSpy.mock.calls[0][0] as Record<string, unknown>
    expect(payload.cancelled_reason).not.toBe('payment_timeout')
  })

  it('acota el update a la reserva propia y todavía pendiente', async () => {
    await cancelPendingBooking('booking-1')

    expect(mocks.filters).toEqual(
      expect.arrayContaining([
        ['id', 'booking-1'],
        ['user_id', 'user-1'],
        ['status', 'pending'],
        ['payment_status', 'pending']
      ])
    )
  })

  it('informa el fallo cuando no afectó ninguna fila', async () => {
    // Este es el bug original: 0 filas no es un error para PostgREST, así que
    // sin mirar el resultado la acción mentía diciendo success.
    mocks.updateResult = { data: [], error: null }

    const res = await cancelPendingBooking('booking-1')

    expect(res.success).toBe(false)
    expect(mocks.unlockSpy).not.toHaveBeenCalled()
  })

  it('desbloquea los créditos atados a la reserva', async () => {
    // El ON DELETE SET NULL de la migración 019 ya no se dispara al cancelar.
    await cancelPendingBooking('booking-1')

    expect(mocks.unlockSpy).toHaveBeenCalledWith(
      { locked_for_booking_id: null },
      'locked_for_booking_id',
      'booking-1'
    )
  })

  it('igual da la cancelación por buena si falla el desbloqueo de créditos', async () => {
    // El turno liberado es lo urgente; el barrido de la 033 recupera el crédito.
    mocks.unlockError = { message: 'credits no disponible' }

    const res = await cancelPendingBooking('booking-1')

    expect(res).toEqual({ success: true })
  })

  it('rechaza a quien no está autenticado', async () => {
    mocks.user = null

    const res = await cancelPendingBooking('booking-1')

    expect(res.success).toBe(false)
    expect(mocks.updateSpy).not.toHaveBeenCalled()
  })
})
