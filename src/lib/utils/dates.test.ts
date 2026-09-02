/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  todayArgentina,
  formatBookingDate,
  formatTime,
  isPastDate,
  hoursUntilBooking,
  TZ,
} from '@/lib/utils/dates'

describe('dates utils', () => {
  describe('TZ', () => {
    it('exports the Argentina timezone constant', () => {
      expect(TZ).toBe('America/Argentina/Buenos_Aires')
    })
  })

  describe('formatBookingDate', () => {
    it('formats a date string to a human-readable Spanish date', () => {
      const result = formatBookingDate('2024-03-15')
      expect(result).toMatch(/marzo/i)
      expect(result).toMatch(/2024/)
      expect(result).toContain('15')
    })
  })

  describe('formatTime', () => {
    it('formats afternoon time with PM', () => {
      expect(formatTime('14:00')).toContain('PM')
    })

    it('formats morning time with AM', () => {
      expect(formatTime('09:30')).toContain('AM')
      expect(formatTime('09:30')).toContain('9:30')
    })

    it('formats midnight correctly', () => {
      expect(formatTime('00:00')).toContain('12:00')
      expect(formatTime('00:00')).toContain('AM')
    })

    it('formats noon correctly', () => {
      expect(formatTime('12:00')).toContain('12:00')
      expect(formatTime('12:00')).toContain('PM')
    })
  })

  describe('isPastDate', () => {
    it('returns true for past dates', () => {
      expect(isPastDate('2020-01-01')).toBe(true)
    })

    it('returns false for future dates', () => {
      expect(isPastDate('2099-12-31')).toBe(false)
    })
  })

  describe('hoursUntilBooking', () => {
    it('returns negative hours for past bookings', () => {
      const hours = hoursUntilBooking('2020-01-01', '09:00')
      expect(hours).toBeLessThan(0)
    })

    it('returns positive hours for future bookings', () => {
      const hours = hoursUntilBooking('2099-12-31', '23:00')
      expect(hours).toBeGreaterThan(0)
    })
  })
})
