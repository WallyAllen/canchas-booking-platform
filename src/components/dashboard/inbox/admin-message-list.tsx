import { useEffect, useRef } from "react"
import { format } from "date-fns"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ChatImage } from "@/components/chat/chat-image"

interface Message {
  id: string
  content: string
  created_at: string
  sender_type: 'user' | 'venue' | 'system'
  image_url?: string | null
  profiles?: {
    full_name: string
    avatar_url?: string
  }
}

interface AdminMessageListProps {
  messages: Message[]
}

export function AdminMessageList({ messages }: AdminMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
          <p>No hay mensajes en esta conversación.</p>
          <p className="text-sm">Escribe el primer mensaje para empezar.</p>
        </div>
      ) : (
        messages.map((msg) => {
          const isVenue = msg.sender_type === 'venue'
          const isSystem = msg.sender_type === 'system'
          
          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-4">
                <span className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                  {msg.content}
                </span>
              </div>
            )
          }

          return (
            <div 
              key={msg.id} 
              className={`flex items-end gap-2 ${isVenue ? 'justify-end' : 'justify-start'}`}
            >
              {!isVenue && (
                <Avatar className="w-6 h-6 mb-1">
                  <AvatarImage src={msg.profiles?.avatar_url} />
                  <AvatarFallback className="text-[10px]">
                    {msg.profiles?.full_name?.substring(0, 2).toUpperCase() || 'US'}
                  </AvatarFallback>
                </Avatar>
              )}
              
              <div className={`flex flex-col ${isVenue ? 'items-end' : 'items-start'} max-w-[75%]`}>
                <div 
                  className={`px-3 py-2 rounded-2xl text-sm ${
                    isVenue 
                      ? 'bg-primary text-primary-foreground rounded-br-sm' 
                      : 'bg-muted rounded-bl-sm'
                  }`}
                >
                  {msg.image_url && <ChatImage source={msg.image_url} />}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 px-1">
                  {format(new Date(msg.created_at), "HH:mm")}
                </span>
              </div>
            </div>
          )
        })
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}
