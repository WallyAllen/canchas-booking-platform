import { z } from 'zod'

// ─── Primitive Schemas ────────────────────────────────────────────────────────

export const UUIDSchema = z.string().uuid('ID inválido')
export const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
export const TimeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM)')
export const PositiveNumberSchema = z.number().positive('Debe ser un número positivo')
export const NonEmptyStringSchema = z
  .string()
  .min(1, 'Campo requerido')
  .max(1000, 'Texto demasiado largo')
export const PhoneSchema = z
  .string()
  .regex(/^\+?\d{8,15}$/, 'Número de teléfono inválido')
  .optional()

// ─── Business Domain Schemas ──────────────────────────────────────────────────

/** Validates the input for creating a new booking hold */
export const CreateBookingSchema = z.object({
  courtId: UUIDSchema,
  bookingDate: DateSchema,
  startTime: TimeSchema,
  endTime: TimeSchema,
  totalPrice: PositiveNumberSchema,
  depositAmount: z.number().min(0, 'El depósito no puede ser negativo'),
})
export type CreateBookingInput = z.infer<typeof CreateBookingSchema>

/** Validates the cancellation request from a user */
export const CancelBookingSchema = z.object({
  bookingId: UUIDSchema,
})
export type CancelBookingInput = z.infer<typeof CancelBookingSchema>

/** Validates a reschedule request */
export const RescheduleBookingSchema = z.object({
  bookingId: UUIDSchema,
  newDate: DateSchema,
  newStartTime: TimeSchema,
})
export type RescheduleBookingInput = z.infer<typeof RescheduleBookingSchema>

/** Validates a review submission */
export const SubmitReviewSchema = z.object({
  venueId: UUIDSchema,
  bookingId: UUIDSchema,
  rating: z.number().int().min(1).max(5, 'La valoración debe ser entre 1 y 5'),
  comment: z.string().min(10, 'El comentario debe tener al menos 10 caracteres').max(1000),
})
export type SubmitReviewInput = z.infer<typeof SubmitReviewSchema>

/** Validates a chat message */
export const SendMessageSchema = z.object({
  conversationId: UUIDSchema,
  content: NonEmptyStringSchema,
  imageUrl: z.string().url().optional(),
})
export type SendMessageInput = z.infer<typeof SendMessageSchema>

/** Validates venue profile update */
export const UpdateVenueProfileSchema = z.object({
  venue_id: UUIDSchema,
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  description: z.string().max(1000).optional(),
  phone: PhoneSchema,
  address: z.string().min(5).max(200).optional(),
  city: z.string().min(2).max(100).optional(),
})
export type UpdateVenueProfileInput = z.infer<typeof UpdateVenueProfileSchema>
