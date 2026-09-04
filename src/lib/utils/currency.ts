/**
 * Formatea un precio en ARS.
 * @example formatPrice(1500) → '$1.500'
 */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(amount)
}

/**
 * Calcula el monto de seña (depósito) dado el precio total y el porcentaje.
 * Siempre redondea hacia arriba.
 */
export function calculateDeposit(totalPrice: number, depositPercentage: number): number {
  return Math.ceil((totalPrice * depositPercentage) / 100)
}

/**
 * Formatea el monto de la seña con su porcentaje.
 * @example formatDepositLabel(450, 30) → '$450 (30%)'
 */
export function formatDepositLabel(depositAmount: number, depositPercentage: number): string {
  return `${formatPrice(depositAmount)} (${depositPercentage}%)`
}
