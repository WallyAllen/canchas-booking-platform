/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// WhatsApp API Integration using Meta Cloud API
// In production, requires WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const API_URL = `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`

export async function sendWhatsAppBookingConfirmation(phone: string, booking: any, venue: any) {
  if (!phone || !WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.log('Skipping WhatsApp confirmation (missing phone or env vars)')
    return
  }

  try {
    const cleanPhone = phone.replace(/\D/g, '')
    
    // Asumimos que existe un template aprobado llamado "booking_confirmed"
    const body = {
      messaging_product: "whatsapp",
      to: cleanPhone,
      type: "template",
      template: {
        name: "booking_confirmed",
        language: { code: "es_AR" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: venue.name },
              { type: "text", text: new Date(`${booking.booking_date}T12:00:00`).toLocaleDateString('es-AR') },
              { type: "text", text: booking.start_time.substring(0, 5) },
              { type: "text", text: venue.address }
            ]
          }
        ]
      }
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      console.error('Error in WhatsApp API:', await response.text())
    }
  } catch (error) {
    console.error('Error sending WhatsApp confirmation:', error)
  }
}

export async function sendWhatsAppReminder(phone: string, booking: any, venue: any) {
  if (!phone || !WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.log('Skipping WhatsApp reminder (missing phone or env vars)')
    return
  }

  try {
    const cleanPhone = phone.replace(/\D/g, '')
    
    // Asumimos que existe un template aprobado llamado "booking_reminder"
    const body = {
      messaging_product: "whatsapp",
      to: cleanPhone,
      type: "template",
      template: {
        name: "booking_reminder",
        language: { code: "es_AR" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: venue.name },
              { type: "text", text: booking.start_time.substring(0, 5) },
              { type: "text", text: venue.address }
            ]
          }
        ]
      }
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      console.error('Error in WhatsApp API:', await response.text())
    }
  } catch (error) {
    console.error('Error sending WhatsApp reminder:', error)
  }
}
