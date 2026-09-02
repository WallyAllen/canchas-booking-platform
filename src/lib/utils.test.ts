import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('utils', () => {
  describe('cn', () => {
    it('should merge tailwind classes correctly', () => {
      expect(cn('text-black', 'text-white')).toBe('text-white')
      expect(cn('p-4', { 'm-4': true, 'm-2': false })).toBe('p-4 m-4')
    })
  })
})
