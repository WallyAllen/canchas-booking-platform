import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { InboxClient } from "@/components/dashboard/inbox/InboxClient"

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Bandeja de entrada | Dashboard',
  description: 'Centro de mensajes con jugadores.',
}

export default async function InboxPage() {
  const supabase = await createClient()

  // 1. Check auth and get venue
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect("/login")
  }

  // Get user's venue (assuming 1 venue per admin for MVP)
  const { data: venue } = await supabase
    .from("venues")
    .select("id")
    .eq("owner_id", user.id)
    .single()

  if (!venue) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No tienes ninguna cancha registrada.</p>
      </div>
    )
  }

  // 2. Load conversations
  const { data: conversations } = await supabase
    .from("conversations")
    .select("*, profiles!user_id(full_name, avatar_url)")
    .eq("venue_id", venue.id)
    .order("last_message_at", { ascending: false, nullsFirst: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bandeja de entrada</h1>
        <p className="text-muted-foreground">
          Respondé rápidamente a los jugadores para asegurar más reservas.
        </p>
      </div>

      <InboxClient initialConversations={conversations || []} venueId={venue.id} />
    </div>
  )
}
