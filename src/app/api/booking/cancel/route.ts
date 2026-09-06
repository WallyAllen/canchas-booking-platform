import { NextResponse } from 'next/server'
import { cancelBooking } from '@/lib/booking/actions'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, identityFrom, rateLimitedResponse } from '@/lib/rate-limit'
import { CancelBookingSchema } from '@/lib/utils/validators'

export async function POST(request: Request) {
  try {
    // Cancelar devuelve créditos al usuario, así que un bucle acá es una forma
    // de generar movimientos contables en masa. El límite es más holgado que el
    // de creación porque cancelar es legítimo y ocasional.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const limit = await checkRateLimit({
      action: 'cancel-booking',
      identity: identityFrom(request, user?.id),
      limit: 10,
      windowSeconds: 300
    })
    if (!limit.allowed) return rateLimitedResponse(limit.retryAfter)

    const parsed = CancelBookingSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Parámetros inválidos' },
        { status: 400 }
      )
    }
    const { bookingId } = parsed.data

    const result = await cancelBooking(bookingId)

    return NextResponse.json(result)
  } catch (error: unknown) {
    // `cancelBooking` lanza Error con mensajes pensados para el usuario ("La
    // reserva ya está cancelada", el motivo de la política de cancelación) y ya
    // convierte los errores de Postgres en textos genéricos. Por eso se devuelve
    // el mensaje. Cualquier cosa que no sea un Error es un imprevisto y no tiene
    // por qué viajar al cliente.
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Error inesperado cancelando la reserva:', error)
    return NextResponse.json({ error: 'No se pudo cancelar la reserva.' }, { status: 500 })
  }
}
