import { createAdminClient } from '@/lib/supabase/server'

interface BookingParaAviso {
  user_id: string
  booking_date: string
  start_time: string
  courts?: { venues?: { id: string; name: string; owner_id: string } | null } | null
}

function formatearTurno(fecha: string, hora: string) {
  const d = new Date(`${fecha}T${hora}`)
  if (Number.isNaN(d.getTime())) return `${fecha} ${hora.slice(0, 5)}`
  return d.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Deja un mensaje del complejo en el chat que ya comparte con el usuario.
 *
 * Es la vía de aviso para el flujo de transferencia, y a propósito no usa mail.
 * El usuario sube el comprobante por este mismo chat, así que es donde está
 * mirando; y no depende de configurar un proveedor de correo ni de verificar un
 * dominio, que era trabajo de infraestructura para algo que se resuelve con una
 * fila en una tabla que ya existe.
 *
 * Nunca lanza: avisar es importante, pero no puede voltear la confirmación de un
 * pago que ya se registró.
 */
export async function avisarPorChat(booking: BookingParaAviso, mensaje: string) {
  try {
    const venue = booking.courts?.venues
    if (!venue) {
      console.error('[chat] no se pudo avisar: la reserva no trae complejo')
      return
    }

    const supabase = createAdminClient()

    // UNIQUE (venue_id, user_id): si ya conversaron, se reutiliza el hilo.
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .upsert(
        { venue_id: venue.id, user_id: booking.user_id },
        { onConflict: 'venue_id,user_id' }
      )
      .select('id, unread_user_count')
      .single()

    if (convError || !conv) {
      console.error('[chat] no se pudo abrir la conversación:', convError)
      return
    }

    const fila = conv as unknown as { id: string; unread_user_count: number }

    // El mensaje se manda como el complejo: para el usuario es quien le confirma.
    const { error: msgError } = await supabase.from('messages').insert({
      conversation_id: fila.id,
      sender_id: venue.owner_id,
      content: mensaje
    })

    if (msgError) {
      console.error('[chat] no se pudo insertar el mensaje:', msgError)
      return
    }

    await supabase
      .from('conversations')
      .update({
        unread_user_count: (fila.unread_user_count ?? 0) + 1,
        last_message_at: new Date().toISOString()
      })
      .eq('id', fila.id)
  } catch (error) {
    console.error('[chat] error inesperado avisando por chat:', error)
  }
}

export function mensajeReservaConfirmada(booking: BookingParaAviso) {
  const venue = booking.courts?.venues
  return (
    `✅ Confirmamos tu reserva en ${venue?.name ?? 'el complejo'} para el ` +
    `${formatearTurno(booking.booking_date, booking.start_time)}. ` +
    `Recibimos la transferencia. ¡Te esperamos!`
  )
}

export function mensajeTransferenciaRechazada(booking: BookingParaAviso) {
  return (
    `No pudimos validar la transferencia de tu reserva para el ` +
    `${formatearTurno(booking.booking_date, booking.start_time)}, así que quedó cancelada. ` +
    `Si ya pagaste, respondé por acá con el comprobante y lo revisamos.`
  )
}
