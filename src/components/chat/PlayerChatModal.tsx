/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { MessageCircle, Send, CheckCheck, Check, Paperclip, ImageIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { startConversation, sendMessage, markConversationAsRead } from "@/app/actions/chat"
import { format } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface PlayerChatModalProps {
  venueId: string
  venueName: string
}

interface Message {
  id: string
  sender_id: string
  content: string
  created_at: string
  image_url?: string | null
}

export function PlayerChatModal({ venueId, venueName }: PlayerChatModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Get user on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [supabase.auth])

  // Handle open
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
  }

  const hasFetched = useRef(false)

  // Initialize conversation when modal is open and user is loaded
  useEffect(() => {
    if (isOpen && userId && !conversationId && !hasFetched.current) {
      hasFetched.current = true;
      let isMounted = true;
      const initChat = async () => {
        setIsLoading(true)
        try {
          const { conversationId: cid } = await startConversation(venueId)
          if (isMounted) setConversationId(cid)
        } catch (e) {
          console.error(e)
        } finally {
          if (isMounted) setIsLoading(false)
        }
      }
      initChat()
      return () => { isMounted = false }
    }
    
    // Reset fetch state when modal closes
    if (!isOpen) {
      hasFetched.current = false;
    }
  }, [isOpen, userId, conversationId, venueId])

  const [unreadVenueCount, setUnreadVenueCount] = useState(0)

  // Load messages and subscribe when conversation is active
  useEffect(() => {
    if (!conversationId || !isOpen) return

    const loadMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
      
      if (data) setMessages(data)
      
      // Load conversation unread count
      const { data: conv } = await (supabase
        .from("conversations") as any)
        .select("unread_venue_count")
        .eq("id", conversationId)
        .single()
      
      if (conv) setUnreadVenueCount(conv.unread_venue_count)
      
      // Mark as read
      await markConversationAsRead(conversationId, 'user')
    }
    
    loadMessages()

    const channel = supabase
      .channel(`chat_${conversationId}`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message])
          // If modal is open, mark as read
          if (isOpen) {
             markConversationAsRead(conversationId, 'user')
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${conversationId}` },
        (payload: any) => {
          setUnreadVenueCount(payload.new.unread_venue_count)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, isOpen, supabase])

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !conversationId) return
    
    setIsUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${conversationId}/${Date.now()}.${fileExt}`
      
      const { data, error } = await supabase.storage
        .from('chat-images')
        .upload(fileName, file)
        
      if (error) throw error
      
      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName)
        
      await sendMessage(conversationId, '🖼️ Imagen adjunta', publicUrl)
    } catch (e: any) {
      alert("Error al subir imagen: " + (e.message || "Desconocido"))
      console.error(e)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSend = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault()
    if (!inputValue || !inputValue.trim()) return
    
    if (!conversationId) {
      alert("La conversación aún no está inicializada. Por favor, recarga o vuelve a abrir el chat.")
      return
    }
    
    const text = inputValue.trim()
    try {
      await sendMessage(conversationId, text)
      setInputValue("") // clear only on success
    } catch (e: any) {
      alert("Error al enviar: " + (e.message || "Desconocido"))
      console.error(e)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="lg" className="w-full gap-2 font-semibold" />}>
        <MessageCircle className="h-5 w-5" />
        Consultar a la cancha
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md h-[80vh] sm:h-[600px] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-border/50 bg-muted/20 shrink-0">
          <DialogTitle className="flex items-center gap-3 text-lg">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary">{venueName.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            Chat con {venueName}
          </DialogTitle>
        </DialogHeader>
        
        {!userId ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center text-muted-foreground">
            Inicia sesión para enviar mensajes a la cancha.
          </div>
        ) : isLoading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Cargando chat...
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-2">
                  <MessageCircle className="h-12 w-12" />
                  <p>Iniciá la conversación</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.sender_id === userId
                  const isLastMessage = index === messages.length - 1
                  const isRead = isMe && unreadVenueCount === 0 && isLastMessage
                  
                  return (
                    <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'} max-w-[85%]`}>
                      {!isMe && (
                        <Avatar className="h-6 w-6 shrink-0 mb-1">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                            {venueName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      
                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={`px-4 py-2 rounded-2xl ${isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}>
                          {msg.image_url && (
                            <img src={msg.image_url} alt="Adjunto" className="max-w-[200px] sm:max-w-[250px] rounded-md mb-2 object-cover" />
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
                    </div>
                  )
                })
              )}
            </div>
            
            <form onSubmit={handleSend} className="p-3 border-t border-border/50 bg-muted/10 shrink-0 flex gap-2 items-center">
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
                placeholder={isUploading ? "Subiendo imagen..." : "Escribe un mensaje..."}
                className="flex-1 bg-background"
                autoComplete="off"
                disabled={isUploading}
              />
              <button type="submit" disabled={isUploading || (!inputValue.trim() && !isUploading)} className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
