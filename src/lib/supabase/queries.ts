import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { 
  BookingWithDetails, 
  CourtWithVenue, 
  ConversationWithVenue, 
  MessageWithSender,
  ReviewWithDetails 
} from '@/types/domain'

// Courts
export async function getCourtWithVenue(supabase: SupabaseClient<Database>, courtId: string) {
  const { data, error } = await supabase
    .from('courts')
    .select('*, venues(*)')
    .eq('id', courtId)
    .single()

  if (error) throw error
  return data as CourtWithVenue
}

export async function getVenueCourts(supabase: SupabaseClient<Database>, venueId: string) {
  const { data, error } = await supabase
    .from('courts')
    .select('*')
    .eq('venue_id', venueId)

  if (error) throw error
  return data as CourtWithVenue[]
}

// Bookings
export async function getBookingWithDetails(supabase: SupabaseClient<Database>, bookingId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, profiles(*), courts(*, venues(*))')
    .eq('id', bookingId)
    .single()

  if (error) throw error
  return data as BookingWithDetails
}

export async function getUserBookings(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, courts(*, venues(*))')
    .eq('user_id', userId)
    .order('booking_date', { ascending: false })

  if (error) throw error
  return data as BookingWithDetails[]
}

// Chat
export async function getConversationWithVenue(supabase: SupabaseClient<Database>, conversationId: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*, venues(owner_id, name)')
    .eq('id', conversationId)
    .single()
    
  if (error) throw error
  return data as ConversationWithVenue
}

export async function getConversationMessages(supabase: SupabaseClient<Database>, conversationId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*, profiles(id, full_name, role)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data as MessageWithSender[]
}

// Reviews
export async function getVenueReviews(supabase: SupabaseClient<Database>, venueId: string) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, profiles(id, full_name, avatar_url)')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as ReviewWithDetails[]
}

export async function getUserReviews(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, venues(id, name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as ReviewWithDetails[]
}
