import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
  rpcResult: { data: [{ allowed: true, remaining: 4, retry_after: 0 }], error: null } as {
    data: Array<{ allowed: boolean; remaining: number; retry_after: number }> | null
    error: { message: string } | null
  },
  rpcThrows: false,
  lastCall: null as { fn: string; args: Record<string, unknown> } | null
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (state.rpcThrows) throw new Error('conexión caída')
      state.lastCall = { fn, args }
      return state.rpcResult
    }
  })
}))

import { checkRateLimit, identityFrom, rateLimitedResponse } from '@/lib/rate-limit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.rpcThrows = false
    state.lastCall = null
    state.rpcResult = { data: [{ allowed: true, remaining: 4, retry_after: 0 }], error: null }
  })

  it('arma la clave como <accion>:<identidad> y pasa límite y ventana', async () => {
    await checkRateLimit({
      action: 'create-preference',
      identity: 'user:abc',
      limit: 5,
      windowSeconds: 300
    })

    expect(state.lastCall?.fn).toBe('check_rate_limit')
    expect(state.lastCall?.args).toEqual({
      p_key: 'create-preference:user:abc',
      p_limit: 5,
      p_window_seconds: 300
    })
  })

  it('bloquea y propaga el retryAfter cuando se excede', async () => {
    state.rpcResult = { data: [{ allowed: false, remaining: 0, retry_after: 143 }], error: null }

    const res = await checkRateLimit({ action: 'a', identity: 'i', limit: 1, windowSeconds: 60 })

    expect(res).toEqual({ allowed: false, retryAfter: 143 })
  })

  it('falla abierto si la base devuelve error', async () => {
    // Decisión explícita: el limitador protege de abuso, no es parte del
    // negocio. Un limitador caído no debe impedir que la gente reserve.
    state.rpcResult = { data: null, error: { message: 'timeout' } }

    const res = await checkRateLimit({ action: 'a', identity: 'i', limit: 1, windowSeconds: 60 })

    expect(res.allowed).toBe(true)
  })

  it('falla abierto ante una excepción inesperada', async () => {
    state.rpcThrows = true

    const res = await checkRateLimit({ action: 'a', identity: 'i', limit: 1, windowSeconds: 60 })

    expect(res.allowed).toBe(true)
  })

  it('falla abierto si la función no devuelve filas', async () => {
    state.rpcResult = { data: [], error: null }

    const res = await checkRateLimit({ action: 'a', identity: 'i', limit: 1, windowSeconds: 60 })

    expect(res.allowed).toBe(true)
  })
})

describe('identityFrom', () => {
  function req(headers: Record<string, string> = {}) {
    return new Request('https://reservaya.app/x', { headers })
  }

  it('prefiere el id de usuario: cambiar de IP no esquiva el límite', () => {
    expect(identityFrom(req({ 'x-forwarded-for': '1.2.3.4' }), 'u1')).toBe('user:u1')
  })

  it('usa la primera IP de la cadena de proxies', () => {
    // x-forwarded-for puede traer "cliente, proxy1, proxy2".
    expect(identityFrom(req({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }))).toBe('ip:9.9.9.9')
  })

  it('cae a x-real-ip y después a un valor fijo', () => {
    expect(identityFrom(req({ 'x-real-ip': '8.8.8.8' }))).toBe('ip:8.8.8.8')
    expect(identityFrom(req())).toBe('ip:desconocida')
  })
})

describe('rateLimitedResponse', () => {
  it('devuelve 429 con Retry-After, que es lo que un cliente necesita para reintentar bien', async () => {
    const res = rateLimitedResponse(90)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('90')
    expect(await res.json()).toMatchObject({ retryAfter: 90 })
  })
})
