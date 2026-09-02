"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { User, MessageCircle } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface ConversationListProps {
  conversations: Array<Record<string, unknown> & { id: string; profiles?: { avatar_url?: string; full_name?: string }; last_message_at?: string; status?: string; unread_venue_count: number }>
  activeId: string | null
  onSelect: (id: string) => void
}

export function ConversationList({ conversations, activeId, onSelect }: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground opacity-70">
        <MessageCircle className="h-8 w-8 mb-2" />
        <p className="text-sm">No tienes mensajes todavía.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          className={`w-full text-left p-4 border-b border-border/50 transition-colors flex gap-3 items-center
            ${activeId === conv.id ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-muted/30 border-l-4 border-l-transparent'}`}
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={conv.profiles?.avatar_url || ''} />
            <AvatarFallback className="bg-muted">
              <User className="h-5 w-5 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline mb-1">
              <span className="font-semibold text-sm truncate pr-2">
                {conv.profiles?.full_name || 'Jugador Anónimo'}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {conv.last_message_at ? format(new Date(conv.last_message_at), "d MMM, HH:mm", { locale: es }) : ''}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground truncate">
                {conv.status === 'open' ? 'Conversación activa' : 'Cerrada'}
              </span>
              {conv.unread_venue_count > 0 && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                  {conv.unread_venue_count}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
