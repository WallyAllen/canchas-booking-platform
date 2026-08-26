import { MercadoPagoConfig, Preference } from 'mercadopago'

// Initialize MercadoPago Client
const client = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || 'TEST-dummy-token',
  options: { timeout: 5000, idempotencyKey: 'abc' }
})

export interface CreatePreferenceParams {
  title: string
  price: number
  bookingId: string
  courtId: string
}

export async function createPaymentPreference({ title, price, bookingId, courtId }: CreatePreferenceParams) {
  const preference = new Preference(client)

  // Webhook URL has to be absolute, assuming PROD_URL exists or using localhost for development
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (!process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN.startsWith('TEST-')) {
    console.log("Mocking Mercado Pago payment due to missing or TEST- token")
    return {
      id: "mock_preference_id_" + bookingId,
      init_point: `/mock-payment?booking_id=${bookingId}&court_id=${courtId}&price=${price}`,
      sandbox_init_point: `/mock-payment?booking_id=${bookingId}&court_id=${courtId}&price=${price}`
    }
  }

  try {
    const result = await preference.create({
      body: {
        items: [
          {
            id: bookingId,
            title: title,
            quantity: 1,
            unit_price: Number(price.toFixed(2)),
            currency_id: 'ARS',
          }
        ],
        back_urls: {
          success: `${baseUrl}/booking/${courtId}/success?booking_id=${bookingId}`,
          failure: `${baseUrl}/booking/${courtId}?error=payment_failed`,
          pending: `${baseUrl}/booking/${courtId}?error=payment_pending`
        },
        auto_return: 'approved',
        notification_url: `${baseUrl}/api/webhooks/mercadopago`,
        external_reference: bookingId,
        payment_methods: {
          excluded_payment_types: [
            { id: 'ticket' } // Excluimos pagos en efectivo (Rapipago/PagoFácil) porque la seña debe ser instantánea
          ],
          installments: 1
        }
      }
    })

    return {
      id: result.id,
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point
    }
  } catch (error) {
    console.error('Error creating MercadoPago preference:', error)
    throw new Error('Error al inicializar el pago.')
  }
}
