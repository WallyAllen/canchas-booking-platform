"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { ConversationList } from "./ConversationList"
import { AdminChatThread } from "./AdminChatThread"
import { MessageCircle } from "lucide-react"

interface InboxClientProps {
  initialConversations: Array<Record<string, unknown> & { id: string; profiles?: { avatar_url?: string; full_name?: string }; last_message_at?: string; status?: string; unread_venue_count: number; created_at?: string }>
  venueId: string
}

export function InboxClient({ initialConversations, venueId }: InboxClientProps) {
  const [conversations, setConversations] = useState(initialConversations)
  const [activeId, setActiveId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    // Subscribe to conversations changes (like new unread messages)
    const channel = supabase
      .channel('admin_conversations')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `venue_id=eq.${venueId}` },
        (payload) => {
          setConversations(prev => {
            const index = prev.findIndex(c => c.id === payload.new.id)
            if (index === -1) {
              // Might need to fetch full conversation if it's new, but INSERT handles that
              return prev
            }
            const updated = [...prev]
            updated[index] = { ...updated[index], ...payload.new }
            return updated.sort((a, b) => new Date(b.last_message_at || b.created_at || 0).getTime() - new Date(a.last_message_at || a.created_at || 0).getTime())
          })
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations', filter: `venue_id=eq.${venueId}` },
        async (payload) => {
          // Fetch full user info for new conversation
          const { data } = await supabase
            .from("conversations")
            .select("*, profiles!user_id(full_name, avatar_url)")
            .eq("id", payload.new.id)
            .single()
            
          if (data) {
            setConversations(prev => [data as typeof initialConversations[0], ...prev])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [venueId, supabase])

  return (
    <div className="flex h-[calc(100vh-140px)] border border-border/50 rounded-xl overflow-hidden bg-card">
      <div className={`w-full md:w-80 border-r border-border/50 flex flex-col ${activeId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-border/50 bg-muted/20 shrink-0">
          <h2 className="font-semibold">Mensajes</h2>
        </div>
        <ConversationList 
          conversations={conversations} 
          activeId={activeId} 
          onSelect={setActiveId} 
        />
      </div>
      <div className={`flex-1 flex-col ${!activeId ? 'hidden md:flex' : 'flex'}`}>
        {activeId ? (
          <AdminChatThread 
            conversation={conversations.find(c => c.id === activeId)} 
            venueId={venueId}
            onBack={() => setActiveId(null)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-4">
            <MessageCircle className="h-16 w-16" />
            <p>Selecciona una conversación para responder</p>
          </div>
        )}
      </div>
    </div>
  )
}
