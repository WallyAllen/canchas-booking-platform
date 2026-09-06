import { createAdminClient } from '@/lib/supabase/server'
import { deliver, type NotificationEvent, type NotificationPayload } from './deliver'

/** Después de esto se deja de reintentar y queda para revisión manual. */
const MAX_INTENTOS = 5

/** Backoff exponencial en minutos: 1, 4, 9, 16… */
function proximoIntento(intentos: number) {
  const minutos = Math.min(60, intentos * intentos)
  return new Date(Date.now() + minutos * 60_000).toISOString()
}

/**
 * Registra el envío y lo intenta una vez.
 *
 * La fila se escribe ANTES de intentar despachar: si el proceso muere en el
 * medio —cosa habitual en serverless, donde la instancia se congela apenas
 * responde— el mensaje ya está anotado y el cron lo va a reintentar. El orden
 * inverso perdería exactamente los casos que esto viene a resolver.
 */
export async function encolarYEnviar(event: NotificationEvent, payload: NotificationPayload) {
  const supabase = createAdminClient()

  const { data: fila, error: insertError } = await supabase
    .from('notification_outbox')
    .insert({ event, payload })
    .select('id')
    .single()

  if (insertError || !fila) {
    // Si no se pudo ni encolar, se intenta el envío igual: es peor no mandar
    // nada. Queda sin red de reintento, y por eso se loguea fuerte.
    console.error('[outbox] no se pudo encolar la notificación:', insertError)
    await deliver(event, payload).catch((err) =>
      console.error('[outbox] y el envío directo también falló:', err)
    )
    return
  }

  await intentarEnvio(fila.id, event, payload, 0)
}

/**
 * Un intento de envío, con el resultado asentado en la fila.
 *
 * Nunca lanza: un fallo de notificación no puede tumbar la confirmación de una
 * reserva ni el drenaje del resto de la cola.
 */
export async function intentarEnvio(
  id: string,
  event: NotificationEvent,
  payload: NotificationPayload,
  intentosPrevios: number
) {
  const supabase = createAdminClient()
  const intentos = intentosPrevios + 1

  try {
    await deliver(event, payload)
    await supabase
      .from('notification_outbox')
      .update({ status: 'sent', attempts: intentos, sent_at: new Date().toISOString(), last_error: null })
      .eq('id', id)
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err)
    // Agotados los intentos se marca 'failed' y se deja de reintentar: seguir
    // golpeando un proveedor caído no ayuda, y la fila queda para revisar.
    const agotado = intentos >= MAX_INTENTOS

    await supabase
      .from('notification_outbox')
      .update({
        status: agotado ? 'failed' : 'pending',
        attempts: intentos,
        last_error: mensaje.slice(0, 500),
        next_attempt_at: agotado ? new Date().toISOString() : proximoIntento(intentos)
      })
      .eq('id', id)

    console.error(
      `[outbox] envío ${event} falló (intento ${intentos}/${MAX_INTENTOS})` +
      `${agotado ? ' — se abandona, requiere revisión manual' : ''}: ${mensaje}`
    )
  }
}
