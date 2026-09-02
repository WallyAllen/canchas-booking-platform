import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { calculateCancellationPolicy, canReschedule } from "./manager"

describe("Credits & Cancellation Manager", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  
  afterEach(() => {
    vi.useRealTimers()
  })

  it("should not allow cancellation with less than 1 hour notice", () => {
    vi.setSystemTime(new Date("2024-10-10T11:00:00"))
    
    // Booking is at 11:30 (0.5 hours away)
    const booking = {
      booking_date: "2024-10-10",
      start_time: "11:30:00",
      total_price: 10000
    } as import("@/types/domain").Booking

    const policy = calculateCancellationPolicy(booking)
    expect(policy.canCancel).toBe(false)
    expect(policy.creditAmount).toBe(0)
  })

  it("should give full credit (deposit 30%) with more than 6 hours notice", () => {
    vi.setSystemTime(new Date("2024-10-10T08:00:00"))
    
    // Booking is at 15:00 (7 hours away)
    const booking = {
      booking_date: "2024-10-10",
      start_time: "15:00:00",
      total_price: 10000,
      deposit_amount: 3000
    } as import("@/types/domain").Booking

    const policy = calculateCancellationPolicy(booking)
    expect(policy.canCancel).toBe(true)
    expect(policy.refundType).toBe("credit")
    expect(policy.creditAmount).toBe(3000)
  })

  it("should forfeit deposit with less than 6 hours and more than 1 hour notice", () => {
    vi.setSystemTime(new Date("2024-10-10T12:00:00"))
    
    // Booking is at 15:00 (3 hours away)
    const booking = {
      booking_date: "2024-10-10",
      start_time: "15:00:00",
      total_price: 10000
    } as import("@/types/domain").Booking

    const policy = calculateCancellationPolicy(booking)
    expect(policy.canCancel).toBe(true)
    expect(policy.refundType).toBe("forfeit")
    expect(policy.creditAmount).toBe(0)
  })

  it("should allow reschedule with more than 2 hours notice", () => {
    vi.setSystemTime(new Date("2024-10-10T12:00:00"))
    
    // Booking is at 15:00 (3 hours away)
    const booking = {
      booking_date: "2024-10-10",
      start_time: "15:00:00",
      total_price: 10000
    } as import("@/types/domain").Booking

    const reschedule = canReschedule(booking)
    expect(reschedule.allowed).toBe(true)
  })

  it("should deny reschedule with less than 2 hours notice", () => {
    vi.setSystemTime(new Date("2024-10-10T13:30:00"))
    
    // Booking is at 15:00 (1.5 hours away)
    const booking = {
      booking_date: "2024-10-10",
      start_time: "15:00:00",
      total_price: 10000
    } as import("@/types/domain").Booking

    const reschedule = canReschedule(booking)
    expect(reschedule.allowed).toBe(false)
  })
})
