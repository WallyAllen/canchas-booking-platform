"use server"

import { createClient } from "@/lib/supabase/server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendMessage(conversationId: string, content: string) {
  const supabase = await createClient()
  
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error("No autenticado")
  
  const userId = userData.user.id
  
  // Verify conversation access
  const { data: conversationData } = await supabase
    .from("conversations")
    .select("*, venues ( owner_id, name )")
    .eq("id", conversationId)
    .single()
    
  // @ts-ignore
  const conversation = conversationData as any
    
  if (!conversation) {
    throw new Error("Conversación no encontrada")
  }
  
  // Insert the message
  const { error: insertError } = await (supabase.from("messages") as any)
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      content: content
    })
    
  if (insertError) {
    throw new Error("Error al enviar mensaje: " + insertError.message)
  }
  
  if (userId === conversation.user_id && conversation.unread_venue_count === 0) {
    // Send email to venue admin
    const ownerId = conversation.venues?.owner_id
    if (!ownerId) return { success: true }
    
    // Get owner email
    const { data: ownerData } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", ownerId)
      .single()
      
    const owner = ownerData as any
      
    if (owner && owner.email && process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: 'ReservaYa <mensajes@reservaya.com>',
          to: owner.email,
          subject: `¡Nueva consulta en ${conversation.venues.name}!`,
          html: `<p>Tienes un nuevo mensaje de un jugador.</p>
                 <p><strong>Mensaje:</strong> "${content}"</p>
                 <br/>
                 <p>Responde rápido para asegurar tu reserva desde el panel de ReservaYa.</p>`
        })
      } catch (e) {
        console.error("Error sending email", e)
      }
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
  const { data: existingData } = await (supabase.from("conversations") as any)
    .select("id")
    .eq("venue_id", venueId)
    .eq("user_id", userId)
    .single()
    
  if (existingData) {
    return { conversationId: existingData.id }
  }
  
  // Create new conversation
  const { data: newConvData, error: insertError } = await (supabase.from("conversations") as any)
    .insert({
      venue_id: venueId,
      user_id: userId
    })
    .select()
    .single()
    
  const newConv = newConvData as any
    
  if (insertError || !newConv) {
    throw new Error("Error al crear conversación: " + (insertError?.message || ''))
  }
  
  return { conversationId: newConv.id }
}

export async function markConversationAsRead(conversationId: string, asRole: 'user' | 'venue') {
  const supabase = await createClient()
  
  if (asRole === 'user') {
    await (supabase.from('conversations') as any).update({ unread_user_count: 0 }).eq('id', conversationId)
  } else {
    await (supabase.from('conversations') as any).update({ unread_venue_count: 0 }).eq('id', conversationId)
  }
  
  return { success: true }
}
