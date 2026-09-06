import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { intentarEnvio } from '@/lib/notifications/outbox'
import type { NotificationEvent, NotificationPayload } from '@/lib/notifications/deliver'

/** Tope por corrida: mantiene la función lejos del límite de tiempo de Vercel. */
const LOTE = 25

interface FilaOutbox {
  id: string
  event: NotificationEvent
  payload: NotificationPayload
  attempts: number
}

/**
 * Reintenta las notificaciones que quedaron pendientes.
 *
 * La dispara Vercel Cron (ver vercel.json). No la puede agendar pg_cron, que
 * corre SQL dentro de Postgres y no tiene forma de llamar a Resend ni a WhatsApp.
 */
export async function GET(request: Request) {
  // Vercel Cron manda `Authorization: Bearer $CRON_SECRET`. Sin el secreto
  // configurado se falla cerrado en producción: este endpoint dispara envíos a
  // usuarios reales y dejarlo abierto lo convierte en un cañón de spam.
  const secret = process.env.CRON_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('CRON_SECRET no está configurada — se rechaza el drenaje del outbox.')
      return NextResponse.json({ error: 'Cron no configurado' }, { status: 500 })
    }
  } else if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('notification_outbox')
    .select('id, event, payload, attempts')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(LOTE)

  if (error) {
    console.error('[cron/notifications] no se pudo leer el outbox:', error)
    return NextResponse.json({ error: 'Error leyendo la cola' }, { status: 500 })
  }

  const filas = (data ?? []) as unknown as FilaOutbox[]

  // En serie y no en paralelo: si el proveedor está caído o limitando, mandarle
  // 25 requests simultáneas empeora las cosas.
  for (const fila of filas) {
    await intentarEnvio(fila.id, fila.event, fila.payload, fila.attempts)
  }

  return NextResponse.json({ procesadas: filas.length })
}
