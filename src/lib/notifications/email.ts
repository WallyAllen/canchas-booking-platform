import { Resend } from 'resend'
import { Booking, Profile, Venue } from '@/types/domain'
import { 
  bookingConfirmationTemplate, 
  reminderTemplate, 
  cancellationTemplate, 
  welcomeTemplate 
} from './templates'

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key')

/**
 * Envía y **lanza** si Resend rechaza.
 *
 * Dos motivos por los que hacía falta envolverlo. Primero, el SDK de Resend no
 * lanza ante un error de la API: devuelve `{ data, error }`, y nadie miraba ese
 * campo — un envío rechazado (clave inválida, dominio sin verificar, rate limit)
 * pasaba por exitoso. Segundo, cada función tenía su propio try/catch que se
 * tragaba lo que sí lanzaba.
 *
 * Con el outbox (migración 035) eso dejó de ser aceptable: si el fallo no se
 * propaga, la fila se marca 'sent' y el reintento nunca ocurre. El mecanismo de
 * reintentos entero depende de que este error salga a la superficie.
 */
async function enviar(payload: Parameters<typeof resend.emails.send>[0]) {
  const { error } = await resend.emails.send(payload)
  if (error) {
    throw new Error(`Resend rechazó el envío: ${error.message ?? JSON.stringify(error)}`)
  }
}
const FROM_EMAIL = 'El Potrero <noreply@elpotrero.ar>'

export async function sendBookingConfirmation(booking: Booking, user: Profile, venue: Venue) {
  if (!user.email) return

  await enviar({
    from: FROM_EMAIL,
    to: user.email,
    subject: `¡Tu reserva en ${venue.name} está confirmada!`,
    html: bookingConfirmationTemplate(booking, user, venue)
  })
}

export async function sendBookingReminder(booking: Booking, user: Profile, venue: Venue) {
  if (!user.email) return

  await enviar({
    from: FROM_EMAIL,
    to: user.email,
    subject: `Recordatorio: Tu turno en ${venue.name} es en 2 horas`,
    html: reminderTemplate(booking, user, venue)
  })
}

export async function sendBookingCancellation(booking: Booking, user: Profile, venue: Venue, creditAmount: number = 0) {
  if (!user.email) return

  await enviar({
    from: FROM_EMAIL,
    to: user.email,
    subject: `Cancelación de reserva en ${venue.name}`,
    html: cancellationTemplate(booking, user, venue, creditAmount)
  })
}

export async function sendWelcomeEmail(user: Profile) {
  if (!user.email) return

  await enviar({
    from: FROM_EMAIL,
    to: user.email,
    subject: '¡Bienvenido a El Potrero!',
    html: welcomeTemplate(user)
  })
}
