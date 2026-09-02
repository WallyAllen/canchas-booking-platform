/** Timezone for Argentina (used for all date/time formatting). */
export const TZ = 'America/Argentina/Buenos_Aires'

/**
 * Returns today's date in YYYY-MM-DD format using Argentina timezone.
 */
export function todayArgentina(): string {
  return new Date()
    .toLocaleDateString('es-AR', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .split('/')
    .reverse()
    .join('-')
}

/**
 * Formats a booking date string (YYYY-MM-DD) as a human-readable Spanish label.
 * @example formatBookingDate('2024-03-15') → 'Viernes, 15 de marzo'
 */
export function formatBookingDate(dateStr: string): string {
  // Parse as UTC midnight and adjust to Argentina timezone
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Formats a time string HH:MM to a 12-hour display with AM/PM.
 * @example formatTime('14:00') → '2:00 PM'
 */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 || 12
  return `${h}:${String(minutes).padStart(2, '0')} ${period}`
}

/**
 * Checks if a given date string (YYYY-MM-DD) is in the past relative to Argentina timezone.
 */
export function isPastDate(dateStr: string): boolean {
  const today = todayArgentina()
  return dateStr < today
}

/**
 * Returns the number of hours between a booking datetime and now.
 * Used for cancellation window checks.
 *
 * `startTime` may arrive as `HH:MM` or `HH:MM:SS` (Postgres `TIME` columns
 * round-trip through PostgREST as `HH:MM:SS`) — normalize to `HH:MM` before
 * building the ISO string, or the trailing `:00` doubles up into an invalid
 * date and every caller silently receives `NaN`.
 */
export function hoursUntilBooking(bookingDate: string, startTime: string): number {
  const time = startTime.length > 5 ? startTime.slice(0, 5) : startTime
  const bookingDateTime = new Date(`${bookingDate}T${time}:00-03:00`)
  if (Number.isNaN(bookingDateTime.getTime())) {
    throw new Error(`hoursUntilBooking: fecha/hora inválida (bookingDate="${bookingDate}", startTime="${startTime}")`)
  }
  const now = new Date()
  return (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)
}
