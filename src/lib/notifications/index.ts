import { encolarYEnviar } from './outbox'
import type { NotificationEvent, NotificationPayload } from './deliver'

export type { NotificationEvent, NotificationPayload }

/**
 * Dispatcher de notificaciones.
 *
 * Registra el envío en `notification_outbox` y lo intenta una vez. Si el intento
 * falla, la fila queda pendiente y /api/cron/notifications la reintenta con
 * backoff hasta 5 veces. Antes un fallo de Resend o WhatsApp se perdía en un
 * console.error y el usuario nunca recibía su confirmación.
 *
 * Nunca rechaza: un problema de notificación no puede tumbar la confirmación de
 * una reserva. Quien llame decide si esperarla (`await`) o dejarla en manos de la
 * plataforma (`waitUntil`).
 */
export async function notify(event: NotificationEvent, data: NotificationPayload) {
  try {
    await encolarYEnviar(event, data)
  } catch (error) {
    console.error(`[notify] error inesperado despachando ${event}:`, error)
  }
}
