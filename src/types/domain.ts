import { Database } from './database'

export type Profile = Database['public']['Tables']['profiles']['Row']
type VenueRow = Database['public']['Tables']['venues']['Row']
export interface Venue extends VenueRow {
  require_deposit?: boolean
  deposit_percentage?: number
}
export type Court = Database['public']['Tables']['courts']['Row']
export type Booking = Database['public']['Tables']['bookings']['Row']
export type PricingRule = Database['public']['Tables']['pricing_rules']['Row']
export type Review = Database['public']['Tables']['reviews']['Row']
export type Credit = Database['public']['Tables']['credits']['Row']
export type Conversation = Database['public']['Tables']['conversations']['Row']
export type Message = Database['public']['Tables']['messages']['Row']

export interface CourtWithVenue extends Court {
  venues: Venue
}

export interface BookingWithDetails extends Booking {
  profiles: Profile
  courts: CourtWithVenue
}

export interface ConversationWithVenue extends Conversation {
  venues: {
    owner_id: string
    name: string
  }
}

export interface MessageWithSender extends Message {
  profiles: {
    id: string
    full_name: string | null
    role: string
  }
}

export interface ReviewWithDetails extends Review {
  profiles: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
  venues?: {
    id: string
    name: string
  }
}
