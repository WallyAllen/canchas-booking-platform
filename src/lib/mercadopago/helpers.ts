import crypto from 'crypto'

/**
 * Calcula el monto de la seña (mínimo 30%)
 */
export function calculateDeposit(totalPrice: number): number {
  return Math.ceil(totalPrice * 0.30)
}

/**
 * Verifica la firma del webhook de Mercado Pago para asegurar que proviene de ellos.
 * Basado en la documentación oficial de seguridad de Webhooks de MP.
 */
export function verifyWebhookSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string,
  secret: string
): boolean {
  if (!xSignature || !xRequestId || !dataId) return false
  
  try {
    // x-signature format: ts=12345678,v1=abcdefg...
    const parts = xSignature.split(',')
    let ts = ''
    let hash = ''

    parts.forEach(part => {
      const [key, value] = part.split('=')
      if (key === 'ts') ts = value
      if (key === 'v1') hash = value
    })

    if (!ts || !hash) return false

    // String to sign: id;request-id;ts
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts}`

    // Create HMAC SHA256
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(manifest)
    const digest = hmac.digest('hex')

    return digest === hash
  } catch (error) {
    console.error('Error verifying signature:', error)
    return false
  }
}
