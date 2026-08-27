"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { MessageCircle, Send } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { startConversation, sendMessage, markConversationAsRead } from "@/app/actions/chat"
import { useFormStatus } from "react-dom"
import { format } from "date-fns"

interface PlayerChatModalProps {
  venueId: string
  venueName: string
}

interface Message {
  id: string
  sender_id: string
  content: string
  created_at: string
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="icon" disabled={pending} className="h-10 w-10 shrink-0">
      <Send className="h-4 w-4" />
    </Button>
  )
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
  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open)
    if (open && userId && !conversationId) {
      setIsLoading(true)
      try {
        const { conversationId: cid } = await startConversation(venueId)
        setConversationId(cid)
      } catch (e) {
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    }
  }

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

  const handleSend = async (formData: FormData) => {
    const text = formData.get("message") as string
    if (!text || !text.trim() || !conversationId) return
    
    setInputValue("") // optimistically clear
    try {
      await sendMessage(conversationId, text.trim())
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full gap-2 font-semibold">
          <MessageCircle className="h-5 w-5" />
          Consultar a la cancha
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md h-[80vh] sm:h-[600px] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-border/50 bg-muted/20 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
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
                messages.map(msg => {
                  const isMe = msg.sender_id === userId
                  return (
                    <div key={msg.id} className={`flex flex-col max-w-[80%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
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
            
            <form action={handleSend} className="p-3 border-t border-border/50 bg-muted/10 shrink-0 flex gap-2 items-center">
              <Input
                name="message"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-background"
                autoComplete="off"
              />
              <SubmitButton />
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
