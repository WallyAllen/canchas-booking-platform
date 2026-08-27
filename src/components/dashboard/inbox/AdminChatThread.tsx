/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { sendMessage, markConversationAsRead } from "@/app/actions/chat"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Send, User } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import Image from "next/image"

interface AdminChatThreadProps {
  conversation: (Record<string, unknown> & { id: string; user_id?: string; created_at?: string; profiles?: { avatar_url?: string; full_name?: string } }) | undefined
  onBack: () => void
}

export function AdminChatThread({ conversation, onBack }: AdminChatThreadProps) {
  const [messages, setMessages] = useState<Array<{ id: string; sender_id: string; content: string; created_at: string }>>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!conversation?.id) return
    
    let isMounted = true
    setIsLoading(true)

    const loadMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
      
      if (isMounted) {
        if (data) setMessages(data)
        setIsLoading(false)
        await markConversationAsRead(conversation.id, 'venue')
      }
    }
    
    loadMessages()

    const channel = supabase
      .channel(`admin_chat_${conversation.id}`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as { id: string; sender_id: string; content: string; created_at: string }]) // Will let it be for payload.new cast to the right type if needed
          markConversationAsRead(conversation.id, 'venue')
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [conversation?.id, supabase])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault()
    if (!inputValue || !inputValue.trim() || !conversation?.id) return
    
    const text = inputValue.trim()
    try {
      await sendMessage(conversation.id, text)
      setInputValue("")
    } catch (err: any) {
      alert("Error al enviar: " + (err.message || "Desconocido"))
      console.error(err)
    }
  }

  if (!conversation) return null

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-3 border-b border-border/50 flex items-center gap-3 shrink-0 bg-muted/10">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0 relative overflow-hidden">
          {conversation.profiles?.avatar_url ? (
             <Image src={conversation.profiles.avatar_url} alt="" fill className="object-cover" />
          ) : (
             <User className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div>
          <h3 className="font-semibold">{conversation.profiles?.full_name || 'Jugador Anónimo'}</h3>
          <p className="text-xs text-muted-foreground">
            Iniciada el {format(new Date(conversation.created_at || new Date().toISOString()), "d 'de' MMMM", { locale: es })}
          </p>
        </div>
      </div>
      
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Cargando mensajes...
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-2">
            <p className="text-sm">No hay mensajes todavía.</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.sender_id !== conversation.user_id
            return (
              <div key={msg.id} className={`flex flex-col max-w-[75%] md:max-w-[60%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                <div className={`px-4 py-2 rounded-2xl ${isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm'}`}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 px-1">
                  {format(new Date(msg.created_at), "HH:mm")}
                </span>
              </div>
            )
          })
        )}
      </div>
      
      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-border/50 shrink-0 flex gap-2 items-center bg-muted/10">
        <Input
          name="message"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder="Escribe una respuesta..."
          className="flex-1 bg-background"
          autoComplete="off"
        />
        <Button type="submit" onClick={handleSend} size="icon" className="h-10 w-10 shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
