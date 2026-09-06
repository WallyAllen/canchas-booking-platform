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
import type { Booking, Profile, Venue } from '@/types/domain'

export type NotificationEvent =
  | 'booking_confirmed'
  | 'booking_reminder'
  | 'booking_cancelled'
  | 'welcome'

export interface NotificationPayload {
  user?: Profile & { email?: string; phone?: string | null }
  booking?: Booking
  venue?: Venue
  creditAmount?: number
}

/** Junta los rechazos de un allSettled en un solo Error legible. */
function lanzarSiAlgoFalló(resultados: PromiseSettledResult<unknown>[], canales: string[]) {
  const fallidos = resultados
    .map((r, i) => (r.status === 'rejected' ? `${canales[i]}: ${r.reason}` : null))
    .filter(Boolean)

  if (fallidos.length > 0) {
    throw new Error(fallidos.join(' | '))
  }
}

/**
 * Hace el envío real. **Lanza** si algún canal falla.
 *
 * Es lo contrario de lo que hacía `notify()`, que se tragaba todo con un
 * try/catch y un `Promise.allSettled` sin mirar los resultados: así el fallo era
 * invisible y no había nada que reintentar. Acá el error tiene que propagarse
 * para que el outbox lo registre y agende otro intento; quien no quiera que un
 * fallo de notificación lo afecte, que use `notify()`.
 */
export async function deliver(event: NotificationEvent, data: NotificationPayload) {
  switch (event) {
    case 'welcome':
      if (!data.user) throw new Error('welcome sin user')
      await sendWelcomeEmail(data.user)
      return

    case 'booking_confirmed': {
      if (!data.booking || !data.user || !data.venue) throw new Error('booking_confirmed incompleto')
      const r = await Promise.allSettled([
        sendBookingConfirmation(data.booking, data.user, data.venue),
        sendWhatsAppBookingConfirmation(data.user.phone ?? '', data.booking, data.venue)
      ])
      lanzarSiAlgoFalló(r, ['email', 'whatsapp'])
      return
    }

    case 'booking_reminder': {
      if (!data.booking || !data.user || !data.venue) throw new Error('booking_reminder incompleto')
      const r = await Promise.allSettled([
        sendBookingReminder(data.booking, data.user, data.venue),
        sendWhatsAppReminder(data.user.phone ?? '', data.booking, data.venue)
      ])
      lanzarSiAlgoFalló(r, ['email', 'whatsapp'])
      return
    }

    case 'booking_cancelled':
      if (!data.booking || !data.user || !data.venue) throw new Error('booking_cancelled incompleto')
      await sendBookingCancellation(data.booking, data.user, data.venue, data.creditAmount)
      return
  }
}
