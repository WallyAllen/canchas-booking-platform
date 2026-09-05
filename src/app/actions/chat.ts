"use server"

import { createClient } from "@/lib/supabase/server"
import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function sendMessage(conversationId: string, content: string, imageUrl?: string) {
  const supabase = await createClient()
  
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error("No autenticado")
  
  const userId = userData.user.id
  
  // Verify conversation access
  const res = await supabase
    .from("conversations")
    .select("*, venues ( owner_id, name )")
    .eq("id", conversationId)
    .single()
    
  interface ConversationType {
    id: string
    venue_id: string
    user_id: string
    status: 'open' | 'closed' | 'archived'
    unread_user_count: number
    unread_venue_count: number
    last_message_at: string | null
    created_at: string
    updated_at: string
    venues: { owner_id: string, name: string } | null
  }

  const conversation: ConversationType | null = res.data as unknown as ConversationType | null
    
  if (!conversation) {
    throw new Error("Conversación no encontrada")
  }
  
  // Insert the message
  const { error: insertError } = await (supabase.from("messages") as unknown as { 
    insert: (data: unknown) => Promise<{ error: Error | null }>
  }).insert({
      conversation_id: conversationId,
      sender_id: userId,
      content: content,
      image_url: imageUrl || null
    })
    
  if (insertError) {
    throw new Error("Error al enviar mensaje: " + insertError.message)
  }
  
  const ownerId = conversation.venues?.owner_id
  const venueName = conversation.venues?.name
  
  if (userId === conversation.user_id && conversation.unread_venue_count === 0) {
    // Send email to venue admin
    if (!ownerId) return { success: true }
    
    // Get owner email
    const ownerRes = await supabase
      .from("profiles")
      .select("email")
      .eq("id", ownerId)
      .single()
      
    const owner: { email: string } | null = ownerRes.data as unknown as { email: string } | null
      
    if (owner && owner.email && process.env.RESEND_API_KEY) {
      const { waitUntil } = await import('@vercel/functions')
      waitUntil(
        resend!.emails.send({
          from: 'ReservaYa <mensajes@reservaya.com>',
          to: owner.email,
          subject: `¡Nueva consulta en ${venueName}!`,
          html: `<p>Tienes un nuevo mensaje de un jugador.</p>
                 <p><strong>Mensaje:</strong> "${content}"</p>
                 <br/>
                 <p>Responde rápido para asegurar tu reserva desde el panel de ReservaYa.</p>`
        }).catch(e => console.error("Error sending email", e))
      )
    }
  }
  
  return { success: true }
}

export async function startConversation(venueId: string) {
  const supabase = await createClient()
  
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error("No autenticado")
  
  const userId = userData.user.id
  
  // Check if conversation already exists
  const existingRes = await supabase
    .from("conversations")
    .select("id")
    .eq("venue_id", venueId)
    .eq("user_id", userId)
    .single()
    
  const existingData: { id: string } | null = existingRes.data as unknown as { id: string } | null

  if (existingData) {
    return { conversationId: existingData.id }
  }
  
  // Create new conversation
  const newConvRes = await (supabase.from("conversations") as unknown as {
    insert: (data: unknown) => { select: (s: string) => { single: () => Promise<{ data: unknown, error: Error | null }> } }
  }).insert({
      venue_id: venueId,
      user_id: userId
    })
    .select("id")
    .single()
    
  const newConv: { id: string } | null = newConvRes.data as unknown as { id: string } | null
    
  if (newConvRes.error || !newConv) {
    throw new Error("Error al crear conversación: " + (newConvRes.error?.message || ''))
  }
  
  return { conversationId: newConv.id }
}

export async function markConversationAsRead(conversationId: string, asRole: 'user' | 'venue') {
  const supabase = await createClient()
  
  // Need to bypass never for conversations table update if relationships are missing
  if (asRole === 'user') {
    await (supabase.from('conversations') as unknown as { update: (data: unknown) => { eq: (k: string, v: string) => Promise<void> } }).update({ unread_user_count: 0 }).eq('id', conversationId)
  } else {
    await (supabase.from('conversations') as unknown as { update: (data: unknown) => { eq: (k: string, v: string) => Promise<void> } }).update({ unread_venue_count: 0 }).eq('id', conversationId)
  }
  
  return { success: true }
}
