/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import { AdminMessageList } from './admin-message-list'
import { AdminInputBar } from './admin-input-bar'

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { sendMessage, markConversationAsRead } from "@/app/actions/chat"
import { Button } from "@/components/ui/button"

interface Message {
  id: string
  sender_id: string
  content: string
  created_at: string
  image_url?: string | null
}

interface AdminChatThreadProps {
  conversation: (Record<string, unknown> & { id: string; user_id?: string; unread_user_count?: number; created_at?: string; profiles?: { avatar_url?: string; full_name?: string } }) | undefined
  venueId: string
  _onBack: () => void
}

export function AdminChatThread({ conversation, venueId, _onBack }: AdminChatThreadProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [_isLoading, setIsLoading] = useState(true)
  const [_isUploading, setIsUploading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [_unreadUserCount, setUnreadUserCount] = useState(conversation?.unread_user_count || 0)
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const [isOtherTyping, setIsOtherTyping] = useState(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const [_latestBooking, setLatestBooking] = useState<{
    id: string,
    booking_date: string,
    start_time: string,
    courts: { name: string } | { name: string }[] | null
  } | null>(null)

  useEffect(() => {
    if (!conversation?.user_id) return
    
    const fetchBooking = async () => {
      const { data } = await supabase
        .from('bookings')
        .select('id, booking_date, start_time, courts!inner(name, venue_id)')
        .eq('user_id', conversation.user_id!)
        .eq('courts.venue_id', venueId)
        .eq('status', 'confirmed')
        .order('booking_date', { ascending: false })
        .limit(1)
        .single()
        
      if (data) {
        // @ts-expect-error fix inference
        setLatestBooking(data as unknown)
      }
    }
    
    fetchBooking()
  }, [conversation?.user_id, venueId, supabase])

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
      .channel(`chat_${conversation.id}`, {
        config: { broadcast: { ack: false } }
      })
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message])
          markConversationAsRead(conversation.id, 'venue')
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${conversation?.id}` },
        (payload: unknown) => {
          // @ts-expect-error fix inference
          setUnreadUserCount(payload.new.unread_user_count)
        }
      )
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.senderType === 'user') {
          setIsOtherTyping(payload.payload.isTyping)
        }
      })
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
  }, [messages, isOtherTyping])

  const _handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    
    if (!conversation?.id) return
    
    supabase.channel(`chat_${conversation.id}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { isTyping: true, senderType: 'venue' }
    })
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    
    typingTimeoutRef.current = setTimeout(() => {
      supabase.channel(`chat_${conversation.id}`).send({
        type: 'broadcast',
        event: 'typing',
        payload: { isTyping: false, senderType: 'venue' }
      })
    }, 2000)
  }

  const _handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    } catch (err: unknown) {
      // @ts-expect-error fix inference
      alert("Error al subir imagen: " + (err.message || "Desconocido"))
      console.error(err)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const _handleSend = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault()
    if (!inputValue || !inputValue.trim() || isSending) return
    
    if (!conversation?.id) {
      alert("Error: No se encontró la conversación activa.")
      return
    }
    
    setIsSending(true)
    const text = inputValue.trim()
    try {
      await sendMessage(conversation.id, text)
      setInputValue("")
    } catch (err: unknown) {
      // @ts-expect-error fix inference
      alert("Error al enviar: " + (err.message || "Desconocido"))
      console.error(err)
    } finally {
      setIsSending(false)
    }
  }

  if (!conversation) return null

  return (
    <div className="flex flex-col h-full bg-muted/10 rounded-2xl border overflow-hidden">
      <div className="p-4 border-b bg-background flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-semibold text-sm">
              {(conversation?.venues as unknown as { name: string })?.name || 'Cargando...'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {conversation?.status === 'open' ? 'Conversación activa' : 'Conversación cerrada'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {conversation?.status === 'open' && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {}}
            >
              Cerrar Chat
            </Button>
          )}
        </div>
      </div>
      {/* @ts-expect-error fix inference */}
      <AdminMessageList messages={messages} />
      <AdminInputBar 
        onSendMessage={async (_msg) => {}}
        disabled={conversation?.status !== 'open'}
      />
    </div>
  )
}
