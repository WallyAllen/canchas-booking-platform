import { describe, it, expect } from 'vitest'
import { formatPrice, calculateDeposit, formatDepositLabel } from '@/lib/utils/currency'

describe('currency utils', () => {
  describe('formatPrice', () => {
    it('formats integer ARS amounts correctly', () => {
      const result = formatPrice(1500)
      expect(result).toContain('1.500')
    })

    it('formats zero correctly', () => {
      const result = formatPrice(0)
      expect(result).toContain('0')
    })

    it('formats large amounts correctly', () => {
      const result = formatPrice(10000)
      expect(result).toContain('10.000')
    })
  })

  describe('calculateDeposit', () => {
    it('calculates 30% deposit correctly', () => {
      expect(calculateDeposit(1000, 30)).toBe(300)
    })

    it('rounds up fractional deposits', () => {
      expect(calculateDeposit(1000, 33)).toBe(330) // 333 → 330? Actually Math.ceil(330) = 330
      expect(calculateDeposit(1001, 30)).toBe(301) // Math.ceil(300.3) = 301
    })

    it('calculates 50% deposit correctly', () => {
      expect(calculateDeposit(2000, 50)).toBe(1000)
    })

    it('returns 0 for 0% deposit', () => {
      expect(calculateDeposit(1000, 0)).toBe(0)
    })
  })

  describe('formatDepositLabel', () => {
    it('formats deposit with percentage', () => {
      const result = formatDepositLabel(300, 30)
      expect(result).toContain('300')
      expect(result).toContain('30%')
    })
  })
})
