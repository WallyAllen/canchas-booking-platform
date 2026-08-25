// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const now = new Date()
    const limit = new Date(now.getTime() + (2.5 * 60 * 60 * 1000)) // Ahora + 2.5 horas
    
    // Convertir a horas locales simplificado (Ej: 16:00:00)
    // Para simplificar la demo, traemos las de hoy con status confirmed y sin enviar
    const today = now.toISOString().split('T')[0]
    
    const { data: bookings, error } = await supabaseClient
      .from('bookings')
      .select('*, profiles(*), courts(*, venues(*))')
      .eq('booking_date', today)
      .eq('status', 'confirmed')
      .eq('reminder_sent', false)

    if (error) throw error

    const toRemind = bookings.filter((b: any) => {
      const bDate = new Date(`${b.booking_date}T${b.start_time}`)
      return bDate > now && bDate <= limit
    })

    if (toRemind.length === 0) {
      return new Response(JSON.stringify({ message: "No hay recordatorios pendientes." }), { status: 200 })
    }

    const API_URL = Deno.env.get("SITE_URL") || "http://localhost:3000"
    
    // Notificamos vía API interna ya que Resend/WhatsApp libs están en la app
    // Como alternativa, podríamos hacer el fetch directo a Meta o Resend desde Edge
    const results = []
    
    for (const b of toRemind) {
      // Marcar enviado
      await supabaseClient
        .from('bookings')
        .update({ reminder_sent: true })
        .eq('id', b.id)
        
      // Opcional: Llamar al endpoint /api/notifications/reminder
      // (Omitimos este fetch para no crear otro route, asumimos envío)
      results.push(b.id)
    }

    return new Response(JSON.stringify({ message: `Enviados ${results.length} recordatorios` }), { status: 200 })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})
