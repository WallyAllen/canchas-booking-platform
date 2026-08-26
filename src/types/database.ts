export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          phone: string | null
          avatar_url: string | null
          role: 'player' | 'venue_admin' | 'platform_admin'
          credit_balance: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          role?: 'player' | 'venue_admin' | 'platform_admin'
          credit_balance?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          role?: 'player' | 'venue_admin' | 'platform_admin'
          credit_balance?: number
          created_at?: string
          updated_at?: string
        }
      }
      venues: {
        Row: {
          id: string
          owner_id: string
          name: string
          description: string | null
          address: string
          city: string
          latitude: number | null
          longitude: number | null
          phone: string | null
          amenities: string[] | null
          photos: string[] | null
          opening_hours: Json | null
          is_active: boolean
          avg_rating: number
          review_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          description?: string | null
          address: string
          city?: string
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          amenities?: string[] | null
          photos?: string[] | null
          opening_hours?: Json | null
          is_active?: boolean
          avg_rating?: number
          review_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          description?: string | null
          address?: string
          city?: string
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          amenities?: string[] | null
          photos?: string[] | null
          opening_hours?: Json | null
          is_active?: boolean
          avg_rating?: number
          review_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      courts: {
        Row: {
          id: string
          venue_id: string
          name: string
          type: 'F5' | 'F7' | 'F8' | 'F11'
          surface: 'sintetico' | 'natural' | 'hormigon'
          has_lighting: boolean
          is_covered: boolean
          slot_duration_minutes: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          name: string
          type: 'F5' | 'F7' | 'F8' | 'F11'
          surface: 'sintetico' | 'natural' | 'hormigon'
          has_lighting?: boolean
          is_covered?: boolean
          slot_duration_minutes?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          venue_id?: string
          name?: string
          type?: 'F5' | 'F7' | 'F8' | 'F11'
          surface?: 'sintetico' | 'natural' | 'hormigon'
          has_lighting?: boolean
          is_covered?: boolean
          slot_duration_minutes?: number
          is_active?: boolean
          created_at?: string
        }
      }
      pricing_rules: {
        Row: {
          id: string
          court_id: string
          day_of_week: number
          start_time: string
          end_time: string
          price: number
          promo_price: number | null
          is_promo_active: boolean
        }
        Insert: {
          id?: string
          court_id: string
          day_of_week: number
          start_time: string
          end_time: string
          price: number
          promo_price?: number | null
          is_promo_active?: boolean
        }
        Update: {
          id?: string
          court_id?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
          price?: number
          promo_price?: number | null
          is_promo_active?: boolean
        }
      }
      bookings: {
        Row: {
          id: string
          user_id: string
          court_id: string
          booking_date: string
          start_time: string
          end_time: string
          total_price: number
          deposit_amount: number
          deposit_method: 'mercadopago' | 'transfer' | 'cash'
          payment_status: 'pending' | 'paid' | 'refunded' | 'credited'
          status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
          source: 'platform' | 'manual'
          mp_payment_id: string | null
          created_at: string
          cancelled_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          court_id: string
          booking_date: string
          start_time: string
          end_time: string
          total_price: number
          deposit_amount: number
          deposit_method?: 'mercadopago' | 'transfer' | 'cash'
          payment_status?: 'pending' | 'paid' | 'refunded' | 'credited'
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
          source?: 'platform' | 'manual'
          mp_payment_id?: string | null
          created_at?: string
          cancelled_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          court_id?: string
          booking_date?: string
          start_time?: string
          end_time?: string
          total_price?: number
          deposit_amount?: number
          deposit_method?: 'mercadopago' | 'transfer' | 'cash'
          payment_status?: 'pending' | 'paid' | 'refunded' | 'credited'
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
          source?: 'platform' | 'manual'
          mp_payment_id?: string | null
          created_at?: string
          cancelled_at?: string | null
        }
      }
      reviews: {
        Row: {
          id: string
          user_id: string
          venue_id: string
          booking_id: string
          rating: number
          comment: string | null
          venue_response: string | null
          created_at: string
          response_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          venue_id: string
          booking_id: string
          rating: number
          comment?: string | null
          venue_response?: string | null
          created_at?: string
          response_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          venue_id?: string
          booking_id?: string
          rating?: number
          comment?: string | null
          venue_response?: string | null
          created_at?: string
          response_at?: string | null
        }
      }
      credits: {
        Row: {
          id: string
          user_id: string
          booking_id: string
          amount: number
          status: 'available' | 'used' | 'expired'
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          booking_id: string
          amount: number
          status?: 'available' | 'used' | 'expired'
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          booking_id?: string
          amount?: number
          status?: 'available' | 'used' | 'expired'
          expires_at?: string
          created_at?: string
        }
      }
    }
  }
}
