import { describe, expect, it } from "vitest"
import { bookingConfirmationTemplate, cancellationTemplate } from "./templates"

describe("Email Templates", () => {
  it("renders booking confirmation correctly", () => {
    const booking = { booking_date: "2024-10-10", start_time: "15:00:00" } as import("@/types/domain").Booking
    const user = { full_name: "Joaquin" } as import("@/types/domain").Profile
    const venue = { name: "ReservaYa 5" } as import("@/types/domain").Venue

    const html = bookingConfirmationTemplate(booking, user, venue)
    
    expect(html).toContain("Hola Joaquin")
    expect(html).toContain("ReservaYa 5")
    expect(html).toContain("10/10/2024")
    expect(html).toContain("15:00 hs")
  })

  it("renders cancellation correctly with credit", () => {
    const booking = { booking_date: "2024-10-10", start_time: "15:00:00" } as import("@/types/domain").Booking
    const user = { full_name: "Pedro" } as import("@/types/domain").Profile
    const venue = { name: "La Cancha" } as import("@/types/domain").Venue

    const html = cancellationTemplate(booking, user, venue, 1500)
    
    expect(html).toContain("Hola Pedro")
    expect(html).toContain("$1.500")
    expect(html).toContain("La Cancha")
  })
})
