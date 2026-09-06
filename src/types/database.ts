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
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "venues_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "courts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "pricing_rules_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          }
        ]
      }
      venue_payment_details: {
        Row: {
          venue_id: string
          alias: string | null
          cbu: string | null
          holder_name: string | null
          bank_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          venue_id: string
          alias?: string | null
          cbu?: string | null
          holder_name?: string | null
          bank_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          venue_id?: string
          alias?: string | null
          cbu?: string | null
          holder_name?: string | null
          bank_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_payment_details_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: true
            referencedRelation: "venues"
            referencedColumns: ["id"]
          }
        ]
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
          payment_status: 'pending' | 'awaiting_verification' | 'paid' | 'refunded' | 'credited'
          status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
          source: 'platform' | 'manual'
          mp_payment_id: string | null
          created_at: string
          cancelled_at: string | null
          cancelled_reason: string | null
          transfer_reported_at: string | null
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
          payment_status?: 'pending' | 'awaiting_verification' | 'paid' | 'refunded' | 'credited'
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
          source?: 'platform' | 'manual'
          mp_payment_id?: string | null
          created_at?: string
          cancelled_at?: string | null
          cancelled_reason?: string | null
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
          payment_status?: 'pending' | 'awaiting_verification' | 'paid' | 'refunded' | 'credited'
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
          source?: 'platform' | 'manual'
          mp_payment_id?: string | null
          created_at?: string
          cancelled_at?: string | null
          cancelled_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "credits_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_locked_for_booking_id_fkey"
            columns: ["locked_for_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          }
        ]
      }
      conversations: {
        Row: {
          id: string
          venue_id: string
          user_id: string
          status: 'open' | 'closed' | 'archived'
          unread_user_count: number
          unread_venue_count: number
          last_message_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          user_id: string
          status?: 'open' | 'closed' | 'archived'
          unread_user_count?: number
          unread_venue_count?: number
          last_message_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venue_id?: string
          user_id?: string
          status?: 'open' | 'closed' | 'archived'
          unread_user_count?: number
          unread_venue_count?: number
          last_message_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          }
        ]
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          content?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      payment_reconciliations: {
        Row: {
          id: string
          mp_payment_id: string
          booking_id: string | null
          reason: PaymentReconciliationReason
          amount: number | null
          payer_email: string | null
          status: 'pending' | 'refunded' | 'dismissed'
          resolved_by: string | null
          resolved_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          mp_payment_id: string
          booking_id?: string | null
          reason: PaymentReconciliationReason
          amount?: number | null
          payer_email?: string | null
          status?: 'pending' | 'refunded' | 'dismissed'
          resolved_by?: string | null
          resolved_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          mp_payment_id?: string
          booking_id?: string | null
          reason?: PaymentReconciliationReason
          amount?: number | null
          payer_email?: string | null
          status?: 'pending' | 'refunded' | 'dismissed'
          resolved_by?: string | null
          resolved_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reconciliations_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      rate_limits: {
        Row: {
          key: string
          window_start: string
          count: number
        }
        Insert: {
          key: string
          window_start?: string
          count?: number
        }
        Update: {
          key?: string
          window_start?: string
          count?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      /** Migración 020: turnos ya ocupados de un complejo en una fecha. */
      get_venue_availability: {
        Args: { p_venue_id: string; p_date: string }
        Returns: {
          court_id: string
          start_time: string
        }[]
      }
      /** Migración 002: si el usuario actual es admin de plataforma. */
      is_platform_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      /** Migración 034: registra un intento y dice si excede el límite. */
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after: number
        }[]
      }
      /** Migración 034: purga contadores de ventanas ya vencidas. */
      cleanup_rate_limits: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

/**
 * Por qué un pago aprobado quedó sin reserva que confirmar. Espeja el CHECK de
 * `reason` en la migración 032; si se agrega un motivo allá, va también acá.
 */
export type PaymentReconciliationReason =
  | 'reserva_inexistente'
  | 'cancelada_a_proposito'
  | 'turno_ya_vencido'
  | 'turno_reasignado'
