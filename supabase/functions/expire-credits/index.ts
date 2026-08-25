// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const now = new Date().toISOString()

    const { data, error } = await supabaseClient
      .from("credits")
      .update({ status: 'expired' })
      .eq('status', 'available')
      .lt('expires_at', now)
      .select()

    if (error) throw error

    return new Response(
      JSON.stringify({ 
        message: "Créditos expirados actualizados", 
        count: data?.length || 0 
      }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }
})
