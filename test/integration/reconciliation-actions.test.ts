import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * `admin/layout.tsx` bloquea el render de /admin a quien no sea platform_admin,
 * pero una Server Action es un endpoint POST independiente: el layout no la
 * cubre. Estos tests fijan que el chequeo de rol viva dentro de la acción.
 */

const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  role: null as string | null,
  updateSpy: vi.fn(),
  eqSpy: vi.fn(),
  updateError: null as { message: string } | null
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mocks.user } })
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: mocks.role === null ? null : { role: mocks.role } })
        })
      }),
      update: (payload: Record<string, unknown>) => {
        mocks.updateSpy(payload)
        return {
          eq: async (_col: string, value: string) => {
            mocks.eqSpy(value)
            return { error: mocks.updateError }
          }
        }
      }
    })
  })
}))

import { resolveReconciliation } from '@/app/admin/reconciliation/actions'

function form(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('resolveReconciliation: control de acceso', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'admin-1' }
    mocks.role = 'platform_admin'
    mocks.updateError = null
  })

  it('rechaza a quien no está autenticado', async () => {
    mocks.user = null

    await expect(
      resolveReconciliation(form({ id: 'rec-1', status: 'refunded' }))
    ).rejects.toThrow('No autenticado')

    expect(mocks.updateSpy).not.toHaveBeenCalled()
  })

  it('rechaza a un player', async () => {
    mocks.user = { id: 'player-1' }
    mocks.role = 'player'

    await expect(
      resolveReconciliation(form({ id: 'rec-1', status: 'refunded' }))
    ).rejects.toThrow('No autorizado')

    expect(mocks.updateSpy).not.toHaveBeenCalled()
  })

  it('rechaza a un venue_admin: la cola es solo de plataforma', async () => {
    mocks.user = { id: 'dueño-1' }
    mocks.role = 'venue_admin'

    await expect(
      resolveReconciliation(form({ id: 'rec-1', status: 'refunded' }))
    ).rejects.toThrow('No autorizado')

    expect(mocks.updateSpy).not.toHaveBeenCalled()
  })

  it('rechaza un status fuera de los dos permitidos', async () => {
    // 'pending' reabriría la entrada y borraría el rastro de quién la resolvió.
    await expect(
      resolveReconciliation(form({ id: 'rec-1', status: 'pending' }))
    ).rejects.toThrow('Estado inválido')

    expect(mocks.updateSpy).not.toHaveBeenCalled()
  })

  it('rechaza si falta el id', async () => {
    await expect(
      resolveReconciliation(form({ status: 'refunded' }))
    ).rejects.toThrow('Falta el id')

    expect(mocks.updateSpy).not.toHaveBeenCalled()
  })

  it('deja que el platform_admin cierre la entrada y registra quién fue', async () => {
    mocks.user = { id: 'admin-1' }
    mocks.role = 'platform_admin'

    await resolveReconciliation(
      form({ id: 'rec-1', status: 'refunded', notes: '  reembolso #4412  ' })
    )

    expect(mocks.updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'refunded',
        resolved_by: 'admin-1',
        notes: 'reembolso #4412'
      })
    )
    expect(mocks.eqSpy).toHaveBeenCalledWith('rec-1')
  })

  it('guarda null cuando la nota viene vacía', async () => {
    await resolveReconciliation(form({ id: 'rec-1', status: 'dismissed', notes: '   ' }))

    expect(mocks.updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'dismissed', notes: null })
    )
  })
})
