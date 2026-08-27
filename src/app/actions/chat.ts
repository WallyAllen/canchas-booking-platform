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
  const { data: conversation } = await supabase
    .from("conversations")
    .select("*, venues ( owner_id, name )")
    .eq("id", conversationId)
    .single()
    
  if (!conversation) {
    throw new Error("Conversación no encontrada")
  }
  
  // Insert the message
  const { error: insertError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      content: content
    })
    
  if (insertError) {
    throw new Error("Error al enviar mensaje")
  }
  
  // Check if we need to send an email (if user is sending to venue, and venue hasn't read)
  // Actually, the trigger increments unread_venue_count. 
  // If we want to send an email when unread_venue_count reaches 1, we check its CURRENT value before the trigger.
  // We can just query it. But it's easier to just do it via a simple logic:
  
  if (userId === conversation.user_id && conversation.unread_venue_count === 0) {
    // Send email to venue admin
    const ownerId = conversation.venues.owner_id
    
    // Get owner email
    const { data: owner } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", ownerId)
      .single()
      
    if (owner && owner.email) {
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
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("venue_id", venueId)
    .eq("user_id", userId)
    .single()
    
  if (existing) {
    return { conversationId: existing.id }
  }
  
  // Create new conversation
  const { data: newConv, error: insertError } = await supabase
    .from("conversations")
    .insert({
      venue_id: venueId,
      user_id: userId
    })
    .select("id")
    .single()
    
  if (insertError || !newConv) {
    throw new Error("Error al crear conversación")
  }
  
  return { conversationId: newConv.id }
}

export async function markConversationAsRead(conversationId: string, asRole: 'user' | 'venue') {
  const supabase = await createClient()
  
  if (asRole === 'user') {
    await supabase.from('conversations').update({ unread_user_count: 0 }).eq('id', conversationId)
  } else {
    await supabase.from('conversations').update({ unread_venue_count: 0 }).eq('id', conversationId)
  }
  
  return { success: true }
}
