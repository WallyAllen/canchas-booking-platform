/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { sendMessage, markConversationAsRead } from "@/app/actions/chat"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Send, User, Check, CheckCheck, Paperclip } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"

interface Message {
  id: string
  sender_id: string
  content: string
  created_at: string
  image_url?: string | null
}

interface AdminChatThreadProps {
  conversation: (Record<string, unknown> & { id: string; user_id?: string; unread_user_count?: number; created_at?: string; profiles?: { avatar_url?: string; full_name?: string } }) | undefined
  onBack: () => void
}

export function AdminChatThread({ conversation, onBack }: AdminChatThreadProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [unreadUserCount, setUnreadUserCount] = useState(conversation?.unread_user_count || 0)
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
          setMessages(prev => [...prev, payload.new as Message])
          markConversationAsRead(conversation.id, 'venue')
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${conversation?.id}` },
        (payload: any) => {
          setUnreadUserCount(payload.new.unread_user_count)
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !conversation?.id) return
    
    setIsUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${conversation.id}/${Date.now()}.${fileExt}`
      
      const { error } = await supabase.storage
        .from('chat-images')
        .upload(fileName, file)
        
      if (error) throw error
      
      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName)
        
      await sendMessage(conversation.id, '🖼️ Imagen adjunta', publicUrl)
    } catch (err: any) {
      alert("Error al subir imagen: " + (err.message || "Desconocido"))
      console.error(err)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSend = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault()
    if (!inputValue || !inputValue.trim()) return
    
    if (!conversation?.id) {
      alert("Error: No se encontró la conversación activa.")
      return
    }
    
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
        <Avatar className="h-10 w-10">
          <AvatarImage src={conversation.profiles?.avatar_url || ''} />
          <AvatarFallback className="bg-muted">
            <User className="h-5 w-5 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
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
          messages.map((msg, index) => {
            const isMe = msg.sender_id !== conversation.user_id
            const isLastMessage = index === messages.length - 1
            const isRead = isMe && unreadUserCount === 0 && isLastMessage

            return (
              <div key={msg.id} className={`flex flex-col max-w-[75%] md:max-w-[60%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                <div className={`px-4 py-2 rounded-2xl ${isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}>
                  {msg.image_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={msg.image_url} alt="Adjunto" className="max-w-[200px] sm:max-w-[300px] rounded-md mb-2 object-cover" />
                  )}
                  <div className="break-words">{msg.content}</div>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1 px-1">
                  <span>{format(new Date(msg.created_at), "HH:mm")}</span>
                  {isMe && isLastMessage && (
                    isRead ? <CheckCheck className="h-3 w-3 text-blue-500" /> : <Check className="h-3 w-3" />
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
      
      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-border/50 shrink-0 flex gap-2 items-center bg-muted/10">
        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleImageUpload}
        />
        <Button 
          type="button" 
          variant="ghost" 
          size="icon" 
          className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        <Input
          name="message"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder={isUploading ? "Subiendo..." : "Escribe una respuesta..."}
          className="flex-1 bg-background"
          autoComplete="off"
          disabled={isUploading}
        />
        <button type="submit" disabled={isUploading || (!inputValue.trim() && !isUploading)} className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
