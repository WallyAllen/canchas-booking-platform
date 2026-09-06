import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Cubre la red de reintentos del outbox. Antes, un fallo de Resend o WhatsApp se
 * perdía en un console.error: el usuario pagaba y nunca recibía su confirmación.
 */

const state = vi.hoisted(() => ({
  entregaFalla: null as string | null,
  updates: [] as Array<Record<string, unknown>>,
  inserts: [] as Array<Record<string, unknown>>,
  insertFalla: false,
  entregasDirectas: 0
}))

vi.mock('@/lib/notifications/deliver', () => ({
  deliver: async () => {
    state.entregasDirectas++
    if (state.entregaFalla) throw new Error(state.entregaFalla)
  }
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (payload: Record<string, unknown>) => {
        state.inserts.push(payload)
        return {
          select: () => ({
            single: async () =>
              state.insertFalla
                ? { data: null, error: { message: 'sin conexión' } }
                : { data: { id: 'fila-1' }, error: null }
          })
        }
      },
      update: (payload: Record<string, unknown>) => {
        state.updates.push(payload)
        return { eq: async () => ({ error: null }) }
      }
    })
  })
}))

import { encolarYEnviar, intentarEnvio } from '@/lib/notifications/outbox'

describe('outbox de notificaciones', () => {
  beforeEach(() => {
    state.entregaFalla = null
    state.updates = []
    state.inserts = []
    state.insertFalla = false
    state.entregasDirectas = 0
  })

  it('encola antes de intentar enviar', async () => {
    // El orden importa: si el proceso muere en el medio, la fila ya está anotada.
    await encolarYEnviar('booking_confirmed', {})

    expect(state.inserts).toHaveLength(1)
    expect(state.inserts[0]).toMatchObject({ event: 'booking_confirmed' })
  })

  it('marca la fila como enviada cuando el envío sale bien', async () => {
    await encolarYEnviar('booking_confirmed', {})

    expect(state.updates.at(-1)).toMatchObject({ status: 'sent', attempts: 1 })
  })

  it('deja la fila pendiente y agenda otro intento si el envío falla', async () => {
    state.entregaFalla = 'Resend 503'

    await encolarYEnviar('booking_confirmed', {})

    const u = state.updates.at(-1) as Record<string, unknown>
    expect(u.status).toBe('pending')
    expect(u.attempts).toBe(1)
    expect(u.last_error).toContain('Resend 503')
    expect(new Date(u.next_attempt_at as string).getTime()).toBeGreaterThan(Date.now())
  })

  it('espacia cada vez más los reintentos', async () => {
    state.entregaFalla = 'caído'

    await intentarEnvio('fila-1', 'welcome', {}, 1)
    const primero = new Date((state.updates.at(-1) as Record<string, string>).next_attempt_at).getTime()

    await intentarEnvio('fila-1', 'welcome', {}, 3)
    const segundo = new Date((state.updates.at(-1) as Record<string, string>).next_attempt_at).getTime()

    expect(segundo).toBeGreaterThan(primero)
  })

  it('se rinde tras 5 intentos y la deja para revisión manual', async () => {
    // Seguir golpeando un proveedor caído no ayuda a nadie.
    state.entregaFalla = 'caído'

    await intentarEnvio('fila-1', 'welcome', {}, 4)

    expect(state.updates.at(-1)).toMatchObject({ status: 'failed', attempts: 5 })
  })

  it('intenta el envío igual si no se pudo ni encolar', async () => {
    state.insertFalla = true

    await encolarYEnviar('welcome', {})

    // Sin red de reintento, pero es peor no mandar nada.
    expect(state.entregasDirectas).toBe(1)
  })

  it('nunca lanza: un fallo de notificación no puede voltear la reserva', async () => {
    state.entregaFalla = 'todo mal'

    await expect(encolarYEnviar('booking_confirmed', {})).resolves.toBeUndefined()
  })
})
