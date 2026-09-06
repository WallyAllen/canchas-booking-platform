
import {
  sendBookingConfirmation,
  sendBookingReminder,
  sendBookingCancellation,
  sendWelcomeEmail
} from './email'
import {
  sendWhatsAppBookingConfirmation,
  sendWhatsAppReminder
} from './whatsapp'

type EventType = 'booking_confirmed' | 'booking_reminder' | 'booking_cancelled' | 'welcome'

/**
 * Dispatcher centralizado de notificaciones.
 *
 * Antes el cuerpo corría dentro de un `setTimeout(..., 0)` y la función retornaba
 * de inmediato. En serverless eso no es "no bloqueante": es no ejecutarse. Una
 * vez enviada la respuesta HTTP, la plataforma puede congelar o terminar la
 * instancia, y el callback pendiente nunca corre. Peor todavía, el webhook de
 * Mercado Pago lo envolvía en `waitUntil(notify(...))` justamente para evitar
 * eso — pero recibía una promesa ya resuelta, así que no mantenía nada vivo.
 *
 * Ahora el trabajo ocurre en la promesa que se devuelve, y `waitUntil` cumple su
 * función. La promesa **nunca rechaza**: un fallo de Resend o de WhatsApp no
 * puede tumbar la confirmación de una reserva. Quien la llame decide si esperarla
 * (`await`) o delegarla a la plataforma (`waitUntil`).
 */
export async function notify(
  event: EventType,
  data: {
    user?: import("@/types/domain").Profile & { email?: string; phone?: string | null };
    booking?: import("@/types/domain").Booking;
    venue?: import("@/types/domain").Venue;
    creditAmount?: number;
  }
) {
  try {
    switch (event) {
      case 'welcome':
        await sendWelcomeEmail(data.user!)
        break

      case 'booking_confirmed':
        await Promise.allSettled([
          sendBookingConfirmation(data.booking!, data.user!, data.venue!),
          sendWhatsAppBookingConfirmation(data.user!.phone!, data.booking!, data.venue!)
        ])
        break

      case 'booking_reminder':
        await Promise.allSettled([
          sendBookingReminder(data.booking!, data.user!, data.venue!),
          sendWhatsAppReminder(data.user!.phone!, data.booking!, data.venue!)
        ])
        break

      case 'booking_cancelled':
        // Solo mandamos mail para cancelaciones
        await sendBookingCancellation(data.booking!, data.user!, data.venue!, data.creditAmount)
        break
    }
  } catch (error) {
    console.error(`Error in notification dispatcher for event ${event}:`, error)
  }
}
