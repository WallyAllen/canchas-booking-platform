import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * El outbox solo sirve si el fallo llega hasta él.
 *
 * El SDK de Resend no lanza ante un error de la API: devuelve `{ data, error }`.
 * Nadie miraba ese campo, y encima cada función tenía un try/catch propio que se
 * tragaba lo que sí lanzaba. Resultado: un envío rechazado se registraba como
 * enviado y nunca se reintentaba.
 */

const state = vi.hoisted(() => ({
  respuesta: { data: { id: 'msg-1' }, error: null } as { data: unknown; error: { message: string } | null },
  enviados: 0
}))

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async () => {
        state.enviados++
        return state.respuesta
      }
    }
  }
}))

import { sendBookingConfirmation } from '@/lib/notifications/email'

const booking = { id: 'b1', booking_date: '2026-09-10', start_time: '20:00:00' } as never
const venue = { name: 'La Redonda' } as never

describe('propagación de errores de email', () => {
  beforeEach(() => {
    state.enviados = 0
    state.respuesta = { data: { id: 'msg-1' }, error: null }
  })

  it('lanza cuando Resend rechaza el envío', async () => {
    state.respuesta = { data: null, error: { message: 'API key is invalid' } }

    await expect(
      sendBookingConfirmation(booking, { email: 'a@b.com' } as never, venue)
    ).rejects.toThrow(/API key is invalid/)
  })

  it('no lanza cuando el envío sale bien', async () => {
    await expect(
      sendBookingConfirmation(booking, { email: 'a@b.com' } as never, venue)
    ).resolves.toBeUndefined()
  })

  it('no intenta enviar si el usuario no tiene email', async () => {
    await sendBookingConfirmation(booking, { email: null } as never, venue)

    expect(state.enviados).toBe(0)
  })
})
