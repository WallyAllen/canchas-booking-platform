/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Resend } from 'resend'
import { 
  bookingConfirmationTemplate, 
  reminderTemplate, 
  cancellationTemplate, 
  welcomeTemplate 
} from './templates'

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key')
const FROM_EMAIL = 'ReservaYa <noreply@reservaya.com>'

export async function sendBookingConfirmation(booking: any, user: any, venue: any) {
  try {
    if (!user.email) return

    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: `¡Tu reserva en ${venue.name} está confirmada!`,
      html: bookingConfirmationTemplate(booking, user, venue)
    })
  } catch (error) {
    console.error('Error sending confirmation email:', error)
  }
}

export async function sendBookingReminder(booking: any, user: any, venue: any) {
  try {
    if (!user.email) return

    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: `Recordatorio: Tu turno en ${venue.name} es en 2 horas`,
      html: reminderTemplate(booking, user, venue)
    })
  } catch (error) {
    console.error('Error sending reminder email:', error)
  }
}

export async function sendBookingCancellation(booking: any, user: any, venue: any, creditAmount: number = 0) {
  try {
    if (!user.email) return

    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: `Cancelación de reserva en ${venue.name}`,
      html: cancellationTemplate(booking, user, venue, creditAmount)
    })
  } catch (error) {
    console.error('Error sending cancellation email:', error)
  }
}

export async function sendWelcomeEmail(user: any) {
  try {
    if (!user.email) return

    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: '¡Bienvenido a ReservaYa!',
      html: welcomeTemplate(user)
    })
  } catch (error) {
    console.error('Error sending welcome email:', error)
  }
}
