import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export interface RateLimitResult {
  allowed: boolean
  /** Segundos hasta que se libere la ventana. 0 si todavía hay margen. */
  retryAfter: number
}

interface CheckOptions {
  /** Qué se está limitando, p.ej. 'create-preference'. */
  action: string
  /** Id de usuario si está autenticado; si no, la IP. */
  identity: string
  /** Intentos permitidos dentro de la ventana. */
  limit: number
  windowSeconds: number
}

/**
 * Consulta y consume una unidad del límite de tasa.
 *
 * El contador vive en Postgres (migración 034) y no en memoria porque la app
 * corre en funciones serverless: un contador por proceso deja de contar en
 * cuanto hay más de una instancia.
 *
 * **Falla abierto.** Si la base no responde, se permite la request. Es una
 * decisión deliberada: el limitador protege de abuso, no es parte del negocio, y
 * un limitador caído no debería impedir que la gente reserve. El trade-off es que
 * una caída de Postgres también desactiva la protección — pero en ese escenario
 * las rutas que nos importan ya no funcionan igual, porque todas escriben en la
 * misma base.
 */
export async function checkRateLimit({
  action,
  identity,
  limit,
  windowSeconds
}: CheckOptions): Promise<RateLimitResult> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: `${action}:${identity}`,
      p_limit: limit,
      p_window_seconds: windowSeconds
    })

    if (error) {
      console.error(`[rate-limit] fallo consultando el límite de ${action}:`, error)
      return { allowed: true, retryAfter: 0 }
    }

    // La función devuelve un SETOF de una sola fila.
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return { allowed: true, retryAfter: 0 }

    return { allowed: row.allowed, retryAfter: row.retry_after }
  } catch (err) {
    console.error(`[rate-limit] error inesperado en ${action}:`, err)
    return { allowed: true, retryAfter: 0 }
  }
}

/**
 * De dónde sale la identidad para limitar.
 *
 * Un usuario autenticado se limita por id: cambiar de IP no le sirve para
 * esquivarlo. Sin sesión queda la IP, que es peor —NAT agrupa gente distinta,
 * y un atacante puede rotarla— pero es lo único que hay.
 *
 * `x-forwarded-for` puede traer una cadena de proxies; el cliente real es el
 * primero. En Vercel el header lo escribe la plataforma, así que no es
 * falsificable desde afuera.
 */
/**
 * Respuesta 429 estándar para las rutas que aplican límite.
 *
 * `Retry-After` es parte del contrato de HTTP para un 429: sin él, un cliente
 * bien portado no sabe cuánto esperar y reintenta a ciegas.
 */
export function rateLimitedResponse(retryAfter: number) {
  return NextResponse.json(
    { error: 'Demasiadas solicitudes. Esperá un momento antes de reintentar.', retryAfter },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  )
}

export function identityFrom(request: Request, userId?: string | null): string {
  if (userId) return `user:${userId}`

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'desconocida'
  return `ip:${ip}`
}
