/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
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

export async function notify(event: EventType, data: any) {
  // Dispatcher centralizado que no bloquea la ejecución principal
  
  // Ejecutamos de forma asíncrona pero sin hacer await para que no bloquee el frontend o los webhooks
  setTimeout(async () => {
    try {
      switch (event) {
        case 'welcome':
          await sendWelcomeEmail(data.user)
          break
          
        case 'booking_confirmed':
          await Promise.allSettled([
            sendBookingConfirmation(data.booking, data.user, data.venue),
            sendWhatsAppBookingConfirmation(data.user.phone, data.booking, data.venue)
          ])
          break
          
        case 'booking_reminder':
          await Promise.allSettled([
            sendBookingReminder(data.booking, data.user, data.venue),
            sendWhatsAppReminder(data.user.phone, data.booking, data.venue)
          ])
          break
          
        case 'booking_cancelled':
          // Solo mandamos mail para cancelaciones
          await sendBookingCancellation(data.booking, data.user, data.venue, data.creditAmount)
          break
      }
    } catch (error) {
      console.error(`Error in notification dispatcher for event ${event}:`, error)
    }
  }, 0)
}
