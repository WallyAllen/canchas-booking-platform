import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * El aviso de que la transferencia fue verificada va por el chat que el usuario
 * y el complejo ya comparten — es donde el usuario subió el comprobante, y no
 * necesita proveedor de mail ni dominio verificado para funcionar.
 */

const state = vi.hoisted(() => ({
  conv: { id: 'conv-1', unread_user_count: 2 } as unknown,
  convError: null as { message: string } | null,
  msgError: null as { message: string } | null,
  upserts: [] as Array<Record<string, unknown>>,
  mensajes: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>
}))

function chain(result: unknown) {
  const o: Record<string, unknown> = {}
  for (const m of ['eq', 'select']) o[m] = () => o
  o.single = async () => result
  o.then = (res: (v: unknown) => void) => res(result)
  return o
}

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (tabla: string) => ({
      upsert: (payload: Record<string, unknown>) => {
        state.upserts.push(payload)
        return chain({ data: state.conv, error: state.convError })
      },
      insert: async (payload: Record<string, unknown>) => {
        state.mensajes.push(payload)
        return { error: state.msgError }
      },
      update: (payload: Record<string, unknown>) => {
        state.updates.push({ tabla, ...payload })
        return chain({ error: null })
      }
    })
  })
}))

import { avisarPorChat, mensajeReservaConfirmada, mensajeTransferenciaRechazada } from '@/lib/notifications/in-app'

const booking = {
  user_id: 'user-1',
  booking_date: '2026-09-10',
  start_time: '20:00:00',
  courts: { venues: { id: 'venue-1', name: 'La Redonda', owner_id: 'owner-1' } }
}

describe('aviso por chat de la transferencia', () => {
  beforeEach(() => {
    state.conv = { id: 'conv-1', unread_user_count: 2 }
    state.convError = null
    state.msgError = null
    state.upserts = []
    state.mensajes = []
    state.updates = []
  })

  it('reutiliza el hilo existente entre el usuario y el complejo', async () => {
    await avisarPorChat(booking, 'hola')

    expect(state.upserts[0]).toMatchObject({ venue_id: 'venue-1', user_id: 'user-1' })
  })

  it('manda el mensaje como el complejo, no como el sistema', async () => {
    await avisarPorChat(booking, 'tu reserva está confirmada')

    expect(state.mensajes[0]).toMatchObject({
      conversation_id: 'conv-1',
      sender_id: 'owner-1',
      content: 'tu reserva está confirmada'
    })
  })

  it('incrementa el no-leído del usuario para que le aparezca la notificación', async () => {
    await avisarPorChat(booking, 'hola')

    expect(state.updates[0]).toMatchObject({ unread_user_count: 3 })
  })

  it('no lanza si falla el chat: el pago ya se registró', async () => {
    // Avisar importa, pero no puede voltear una confirmación de pago hecha.
    state.msgError = { message: 'sin conexión' }

    await expect(avisarPorChat(booking, 'hola')).resolves.toBeUndefined()
  })

  it('no explota si la reserva viene sin complejo', async () => {
    await expect(avisarPorChat({ ...booking, courts: null }, 'hola')).resolves.toBeUndefined()
    expect(state.mensajes).toHaveLength(0)
  })

  it('los mensajes nombran el complejo y el turno', () => {
    expect(mensajeReservaConfirmada(booking)).toContain('La Redonda')
    expect(mensajeReservaConfirmada(booking)).toMatch(/confirmamos/i)
    expect(mensajeTransferenciaRechazada(booking)).toMatch(/cancelada/i)
  })
})
