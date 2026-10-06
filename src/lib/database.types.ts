// Generated from the Supabase schema (project theark). Regenerate after
// migrations with the Supabase MCP `generate_typescript_types` or
// `supabase gen types typescript --project-id iwqxscsejpnsxfxxnmun`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      business_lines: {
        Row: {
          active: boolean
          color: string
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      cities: {
        Row: {
          active: boolean
          blurb: string | null
          country: string | null
          cover_path: string | null
          created_at: string
          id: string
          is_home: boolean
          name: string
          position: number
        }
        Insert: {
          active?: boolean
          blurb?: string | null
          country?: string | null
          cover_path?: string | null
          created_at?: string
          id?: string
          is_home?: boolean
          name: string
          position?: number
        }
        Update: {
          active?: boolean
          blurb?: string | null
          country?: string | null
          cover_path?: string | null
          created_at?: string
          id?: string
          is_home?: boolean
          name?: string
          position?: number
        }
        Relationships: []
      }
      contact_notes: {
        Row: {
          author_id: string | null
          body: string
          contact_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          contact_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          contact_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_stages: {
        Row: {
          contact_id: string
          pipeline: string
          stage: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          pipeline: string
          stage: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          pipeline?: string
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_stages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          bio: string | null
          city_id: string | null
          created_at: string
          created_by: string | null
          discount_id: string | null
          email: string | null
          email_opt_out: boolean
          id: string
          instagram: string | null
          interests: string[]
          lead_brand: string | null
          location: string | null
          lot: string | null
          member_since: string | null
          membership_status: string
          name: string
          open_to_connect: boolean
          owner_id: string | null
          pass_token: string
          photo_path: string | null
          phone: string | null
          rate: string
          renews_on: string | null
          resident: boolean
          show_in_directory: boolean
          source: string | null
          tier: string | null
          type: string
          updated_at: string
          user_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          waitlist_at: string | null
        }
        Insert: {
          bio?: string | null
          city_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_id?: string | null
          email?: string | null
          email_opt_out?: boolean
          id?: string
          instagram?: string | null
          interests?: string[]
          lead_brand?: string | null
          location?: string | null
          lot?: string | null
          member_since?: string | null
          membership_status?: string
          name: string
          open_to_connect?: boolean
          owner_id?: string | null
          pass_token?: string
          photo_path?: string | null
          phone?: string | null
          rate?: string
          renews_on?: string | null
          resident?: boolean
          show_in_directory?: boolean
          source?: string | null
          tier?: string | null
          type?: string
          updated_at?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          waitlist_at?: string | null
        }
        Update: {
          bio?: string | null
          city_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_id?: string | null
          email?: string | null
          email_opt_out?: boolean
          id?: string
          instagram?: string | null
          interests?: string[]
          lead_brand?: string | null
          location?: string | null
          lot?: string | null
          member_since?: string | null
          membership_status?: string
          name?: string
          open_to_connect?: boolean
          owner_id?: string | null
          pass_token?: string
          photo_path?: string | null
          phone?: string | null
          rate?: string
          renews_on?: string | null
          resident?: boolean
          show_in_directory?: boolean
          source?: string | null
          tier?: string | null
          type?: string
          updated_at?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          waitlist_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_lead_brand_fkey"
            columns: ["lead_brand"]
            isOneToOne: false
            referencedRelation: "marketing_brands"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tier_fkey"
            columns: ["tier"]
            isOneToOne: false
            referencedRelation: "membership_tiers"
            referencedColumns: ["key"]
          },
        ]
      }
      court_bookings: {
        Row: {
          contact_id: string | null
          court_id: string
          created_at: string
          created_by: string | null
          date: string
          email: string | null
          end_time: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          players: number | null
          source: string
          start_time: string
          status: string
        }
        Insert: {
          contact_id?: string | null
          court_id: string
          created_at?: string
          created_by?: string | null
          date: string
          email?: string | null
          end_time: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          players?: number | null
          source?: string
          start_time: string
          status?: string
        }
        Update: {
          contact_id?: string | null
          court_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          email?: string | null
          end_time?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          players?: number | null
          source?: string
          start_time?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_bookings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_bookings_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          active: boolean
          close_time: string
          created_at: string
          id: string
          name: string
          open_time: string
          position: number
          slot_minutes: number
          sport: string
        }
        Insert: {
          active?: boolean
          close_time?: string
          created_at?: string
          id?: string
          name: string
          open_time?: string
          position?: number
          slot_minutes?: number
          sport?: string
        }
        Update: {
          active?: boolean
          close_time?: string
          created_at?: string
          id?: string
          name?: string
          open_time?: string
          position?: number
          slot_minutes?: number
          sport?: string
        }
        Relationships: [

        ]
      }
      discounts: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          lifetime: boolean
          name: string
          percent: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          lifetime?: boolean
          name: string
          percent: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          lifetime?: boolean
          name?: string
          percent?: number
        }
        Relationships: []
      }
      divisions: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          is_school: boolean
          lead_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_school?: boolean
          lead_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_school?: boolean
          lead_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "divisions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_sends: {
        Row: {
          enrollment_id: string
          sent_by: string | null
          sent_on: string
          step_position: number
        }
        Insert: {
          enrollment_id: string
          sent_by?: string | null
          sent_on?: string
          step_position: number
        }
        Update: {
          enrollment_id?: string
          sent_by?: string | null
          sent_on?: string
          step_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_sends_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_sends_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          sequence_id: string
          started_on: string
          status: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          sequence_id: string
          started_on?: string
          status?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          sequence_id?: string
          started_on?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_entries: {
        Row: {
          contact_id: string | null
          amount: number
          business_line_id: string | null
          category: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          doc_kind: string | null
          due_date: string | null
          entry_date: string
          file_name: string | null
          file_path: string | null
          id: string
          kind: string
          method: string | null
          paid_on: string | null
          party: string | null
          reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          amount: number
          business_line_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          doc_kind?: string | null
          due_date?: string | null
          entry_date?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          kind: string
          method?: string | null
          paid_on?: string | null
          party?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          amount?: number
          business_line_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          doc_kind?: string | null
          due_date?: string | null
          entry_date?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          kind?: string
          method?: string | null
          paid_on?: string | null
          party?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_business_line_id_fkey"
            columns: ["business_line_id"]
            isOneToOne: false
            referencedRelation: "business_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_months: {
        Row: {
          ap: number | null
          ar: number | null
          cash: number | null
          cash_date: string | null
          created_at: string
          events: number | null
          expenses: number | null
          fnb: number | null
          land: number | null
          membership: number | null
          month: string
          notes: string | null
          other: number | null
          shop: number | null
          updated_at: string
        }
        Insert: {
          ap?: number | null
          ar?: number | null
          cash?: number | null
          cash_date?: string | null
          created_at?: string
          events?: number | null
          expenses?: number | null
          fnb?: number | null
          land?: number | null
          membership?: number | null
          month: string
          notes?: string | null
          other?: number | null
          shop?: number | null
          updated_at?: string
        }
        Update: {
          ap?: number | null
          ar?: number | null
          cash?: number | null
          cash_date?: string | null
          created_at?: string
          events?: number | null
          expenses?: number | null
          fnb?: number | null
          land?: number | null
          membership?: number | null
          month?: string
          notes?: string | null
          other?: number | null
          shop?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      gate_entries: {
        Row: {
          contact_id: string | null
          entered_at: string
          id: string
          logged_by: string | null
        }
        Insert: {
          contact_id?: string | null
          entered_at?: string
          id?: string
          logged_by?: string | null
        }
        Update: {
          contact_id?: string | null
          entered_at?: string
          id?: string
          logged_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gate_entries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_entries_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_passes: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          guest_name: string
          host_contact_id: string
          id: string
          phone: string | null
          status: string
          token: string
          used_at: string | null
          used_by: string | null
          visit_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          guest_name: string
          host_contact_id: string
          id?: string
          phone?: string | null
          status?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
          visit_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          guest_name?: string
          host_contact_id?: string
          id?: string
          phone?: string | null
          status?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_passes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_passes_host_contact_id_fkey"
            columns: ["host_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_passes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          lot_id: string
          path: string
          position: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          lot_id: string
          path: string
          position?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          lot_id?: string
          path?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_photos_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      lot_household: {
        Row: {
          birth_year: number | null
          contact_id: string | null
          created_at: string
          email: string | null
          id: string
          lives_on_site: boolean
          lot_id: string
          name: string
          notes: string | null
          phone: string | null
          relation: string
        }
        Insert: {
          birth_year?: number | null
          contact_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lives_on_site?: boolean
          lot_id: string
          name: string
          notes?: string | null
          phone?: string | null
          relation?: string
        }
        Update: {
          birth_year?: number | null
          contact_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lives_on_site?: boolean
          lot_id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          relation?: string
        }
        Relationships: [
          {
            foreignKeyName: "lot_household_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lot_household_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      lot_maintenance: {
        Row: {
          category: string
          cost: number | null
          created_at: string
          created_by: string | null
          currency: string
          details: string | null
          done_by: string | null
          id: string
          lot_id: string
          performed_on: string
          status: string
          title: string
        }
        Insert: {
          category?: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          details?: string | null
          done_by?: string | null
          id?: string
          lot_id: string
          performed_on?: string
          status?: string
          title: string
        }
        Update: {
          category?: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          details?: string | null
          done_by?: string | null
          id?: string
          lot_id?: string
          performed_on?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lot_maintenance_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lot_maintenance_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      lots: {
        Row: {
          aerial_path: string | null
          amenities: string[]
          bathrooms: number | null
          bedrooms: number | null
          beds: number | null
          built_m2: number | null
          check_in_time: string
          check_out_time: string
          cleaning_fee: number | null
          code: string
          created_at: string
          currency: string
          description: string | null
          estate_lot_id: string | null
          features: string | null
          home_name: string | null
          home_notes: string | null
          home_status: string
          hospitality_since: string | null
          house_rules: string | null
          id: string
          in_hospitality: boolean
          kind: string
          listing_notes: string | null
          listing_published: boolean
          listing_summary: string | null
          listing_title: string | null
          max_guests: number | null
          min_nights: number
          name: string | null
          nightly_rate: number | null
          owner_contact_id: string | null
          photo_path: string | null
          price: number | null
          rate_currency: string
          size_m2: number | null
          status: string
          updated_at: string
          zone: string | null
        }
        Insert: {
          aerial_path?: string | null
          amenities?: string[]
          bathrooms?: number | null
          bedrooms?: number | null
          beds?: number | null
          built_m2?: number | null
          check_in_time?: string
          check_out_time?: string
          cleaning_fee?: number | null
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          estate_lot_id?: string | null
          features?: string | null
          home_name?: string | null
          home_notes?: string | null
          home_status?: string
          hospitality_since?: string | null
          house_rules?: string | null
          id?: string
          in_hospitality?: boolean
          kind?: string
          listing_notes?: string | null
          listing_published?: boolean
          listing_summary?: string | null
          listing_title?: string | null
          max_guests?: number | null
          min_nights?: number
          name?: string | null
          nightly_rate?: number | null
          owner_contact_id?: string | null
          photo_path?: string | null
          price?: number | null
          rate_currency?: string
          size_m2?: number | null
          status?: string
          updated_at?: string
          zone?: string | null
        }
        Update: {
          aerial_path?: string | null
          amenities?: string[]
          bathrooms?: number | null
          bedrooms?: number | null
          beds?: number | null
          built_m2?: number | null
          check_in_time?: string
          check_out_time?: string
          cleaning_fee?: number | null
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          estate_lot_id?: string | null
          features?: string | null
          home_name?: string | null
          home_notes?: string | null
          home_status?: string
          hospitality_since?: string | null
          house_rules?: string | null
          id?: string
          in_hospitality?: boolean
          kind?: string
          listing_notes?: string | null
          listing_published?: boolean
          listing_summary?: string | null
          listing_title?: string | null
          max_guests?: number | null
          min_nights?: number
          name?: string | null
          nightly_rate?: number | null
          owner_contact_id?: string | null
          photo_path?: string | null
          price?: number | null
          rate_currency?: string
          size_m2?: number | null
          status?: string
          updated_at?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lots_estate_lot_id_fkey"
            columns: ["estate_lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_owner_contact_id_fkey"
            columns: ["owner_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_tiers: {
        Row: {
          active: boolean
          currency: string
          description: string | null
          guest_passes: number
          key: string
          name: string
          pause_rule: string | null
          period: string
          perks: string[]
          position: number
          price: number | null
          price_ff: number | null
          spots: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          currency?: string
          description?: string | null
          guest_passes?: number
          key: string
          name: string
          pause_rule?: string | null
          period?: string
          perks?: string[]
          position?: number
          price?: number | null
          price_ff?: number | null
          spots?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          currency?: string
          description?: string | null
          guest_passes?: number
          key?: string
          name?: string
          pause_rule?: string | null
          period?: string
          perks?: string[]
          position?: number
          price?: number | null
          price_ff?: number | null
          spots?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      offerings: {
        Row: {
          access: string
          capacity: number | null
          city_id: string | null
          cover_path: string | null
          created_at: string
          created_by: string | null
          days: number[]
          description: string | null
          end_date: string | null
          end_time: string | null
          facilitator_id: string | null
          id: string
          kind: string
          location: string | null
          repeat: string
          start_date: string
          start_time: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          access?: string
          capacity?: number | null
          city_id?: string | null
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          days?: number[]
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          facilitator_id?: string | null
          id?: string
          kind: string
          location?: string | null
          repeat?: string
          start_date: string
          start_time?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          access?: string
          capacity?: number | null
          city_id?: string | null
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          days?: number[]
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          facilitator_id?: string | null
          id?: string
          kind?: string
          location?: string | null
          repeat?: string
          start_date?: string
          start_time?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offerings_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offerings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offerings_facilitator_id_fkey"
            columns: ["facilitator_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      org_settings: {
        Row: {
          currency: string
          currency2: string | null
          email: string | null
          id: boolean
          language: string
          location: string
          member_cap: number | null
          name: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          currency?: string
          currency2?: string | null
          email?: string | null
          id?: boolean
          language?: string
          location?: string
          member_cap?: number | null
          name?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          currency?: string
          currency2?: string | null
          email?: string | null
          id?: boolean
          language?: string
          location?: string
          member_cap?: number | null
          name?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_assignments: {
        Row: {
          pipeline: string
          team_member_id: string
        }
        Insert: {
          pipeline: string
          team_member_id: string
        }
        Update: {
          pipeline?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_assignments_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_contact_id: string | null
          author_staff_id: string | null
          body: string
          city_id: string | null
          created_at: string
          id: string
          parent_id: string | null
        }
        Insert: {
          author_contact_id?: string | null
          author_staff_id?: string | null
          body: string
          city_id?: string | null
          created_at?: string
          id?: string
          parent_id?: string | null
        }
        Update: {
          author_contact_id?: string | null
          author_staff_id?: string | null
          body?: string
          city_id?: string | null
          created_at?: string
          id?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_contact_id_fkey"
            columns: ["author_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_author_staff_id_fkey"
            columns: ["author_staff_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string | null
          external_id: string | null
          id: string
          image_path: string | null
          image_url: string | null
          low_at: number
          member_price: number | null
          name: string
          online: boolean | null
          price: number
          product_group: string | null
          stock: number
          track_stock: boolean
          unit: string | null
          updated_at: string
          variant: string | null
          web_url: string | null
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          low_at?: number
          member_price?: number | null
          name: string
          online?: boolean | null
          price: number
          product_group?: string | null
          stock?: number
          track_stock?: boolean
          unit?: string | null
          updated_at?: string
          variant?: string | null
          web_url?: string | null
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          low_at?: number
          member_price?: number | null
          name?: string
          online?: boolean | null
          price?: number
          product_group?: string | null
          stock?: number
          track_stock?: boolean
          unit?: string | null
          updated_at?: string
          variant?: string | null
          web_url?: string | null
        }
        Relationships: []
      }
      registrations: {
        Row: {
          checked_in_at: string | null
          checked_in_by: string | null
          contact_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          offering_id: string
          paid: boolean
          qr_token: string
          session_date: string
          source: string
          ticket_emailed_at: string | null
          ticket_type_id: string | null
          user_id: string | null
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          contact_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          offering_id: string
          paid?: boolean
          qr_token?: string
          session_date: string
          source?: string
          ticket_emailed_at?: string | null
          ticket_type_id?: string | null
          user_id?: string | null
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          contact_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          offering_id?: string
          paid?: boolean
          qr_token?: string
          session_date?: string
          source?: string
          ticket_emailed_at?: string | null
          ticket_type_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      sample_records: {
        Row: {
          record_id: string
          table_name: string
        }
        Insert: {
          record_id: string
          table_name: string
        }
        Update: {
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      school_schedule: {
        Row: {
          created_at: string
          end_time: string
          group_name: string | null
          id: string
          location: string | null
          notes: string | null
          on_date: string | null
          start_time: string
          teacher_id: string | null
          title: string
          weekday: number | null
        }
        Insert: {
          created_at?: string
          end_time: string
          group_name?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          on_date?: string | null
          start_time: string
          teacher_id?: string | null
          title: string
          weekday?: number | null
        }
        Update: {
          created_at?: string
          end_time?: string
          group_name?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          on_date?: string | null
          start_time?: string
          teacher_id?: string | null
          title?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "school_schedule_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_steps: {
        Row: {
          body: string
          channel: string
          delay_days: number
          id: string
          position: number
          sequence_id: string
          subject: string | null
        }
        Insert: {
          body: string
          channel?: string
          delay_days?: number
          id?: string
          position: number
          sequence_id: string
          subject?: string | null
        }
        Update: {
          body?: string
          channel?: string
          delay_days?: number
          id?: string
          position?: number
          sequence_id?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_cancellations: {
        Row: {
          created_at: string
          offering_id: string
          session_date: string
        }
        Insert: {
          created_at?: string
          offering_id: string
          session_date: string
        }
        Update: {
          created_at?: string
          offering_id?: string
          session_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_cancellations_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      stays: {
        Row: {
          check_in: string
          check_out: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          email: string | null
          guest_name: string
          guests: number | null
          id: string
          kind: string
          lot_id: string
          nightly_rate: number | null
          notes: string | null
          paid: boolean
          phone: string | null
          source: string
          status: string
          total: number | null
          updated_at: string
        }
        Insert: {
          check_in: string
          check_out: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          email?: string | null
          guest_name: string
          guests?: number | null
          id?: string
          kind?: string
          lot_id: string
          nightly_rate?: number | null
          notes?: string | null
          paid?: boolean
          phone?: string | null
          source?: string
          status?: string
          total?: number | null
          updated_at?: string
        }
        Update: {
          check_in?: string
          check_out?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          email?: string | null
          guest_name?: string
          guests?: number | null
          id?: string
          kind?: string
          lot_id?: string
          nightly_rate?: number | null
          notes?: string | null
          paid?: boolean
          phone?: string | null
          source?: string
          status?: string
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stays_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          amount: number | null
          contact_id: string | null
          by_id: string | null
          created_at: string
          delta: number
          id: string
          product_id: string
          type: string
        }
        Insert: {
          amount?: number | null
          contact_id?: string | null
          by_id?: string | null
          created_at?: string
          delta: number
          id?: string
          product_id: string
          type: string
        }
        Update: {
          amount?: number | null
          contact_id?: string | null
          by_id?: string | null
          created_at?: string
          delta?: number
          id?: string
          product_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_by_id_fkey"
            columns: ["by_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      student_guardians: {
        Row: {
          contact_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          relation: string | null
          student_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          relation?: string | null
          student_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          relation?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_guardians_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_guardians_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_updates: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          photo_path: string | null
          shared: boolean
          student_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          photo_path?: string | null
          shared?: boolean
          student_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          photo_path?: string | null
          shared?: boolean
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_updates_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_updates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          about: string | null
          birthdate: string | null
          created_at: string
          group_name: string | null
          id: string
          name: string
          photo_path: string | null
          preferred_name: string | null
          share_token: string
          staff_notes: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          about?: string | null
          birthdate?: string | null
          created_at?: string
          group_name?: string | null
          id?: string
          name: string
          photo_path?: string | null
          preferred_name?: string | null
          share_token?: string
          staff_notes?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          about?: string | null
          birthdate?: string | null
          created_at?: string
          group_name?: string | null
          id?: string
          name?: string
          photo_path?: string | null
          preferred_name?: string | null
          share_token?: string
          staff_notes?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          division_id: string | null
          due_date: string | null
          id: string
          kind: string
          location: string | null
          position: number
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          division_id?: string | null
          due_date?: string | null
          id?: string
          kind?: string
          location?: string | null
          position?: number
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          division_id?: string | null
          due_date?: string | null
          id?: string
          kind?: string
          location?: string | null
          position?: number
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          division_id: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          responsibilities: string | null
          role: string
          start_date: string | null
          status: string
          title: string | null
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          division_id?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          responsibilities?: string | null
          role?: string
          start_date?: string | null
          status?: string
          title?: string | null
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          division_id?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          responsibilities?: string | null
          role?: string
          start_date?: string | null
          status?: string
          title?: string | null
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_types: {
        Row: {
          currency: string
          id: string
          name: string
          offering_id: string
          payment_link: string | null
          position: number
          price: number
          qty: number | null
        }
        Insert: {
          currency?: string
          id?: string
          name: string
          offering_id: string
          payment_link?: string | null
          position?: number
          price?: number
          qty?: number | null
        }
        Update: {
          currency?: string
          id?: string
          name?: string
          offering_id?: string
          payment_link?: string | null
          position?: number
          price?: number
          qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_types_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_refs: {
        Row: {
          brand: string
          caption: string | null
          created_at: string
          created_by: string | null
          id: string
          path: string | null
          url: string | null
        }
        Insert: {
          brand: string
          caption?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          path?: string | null
          url?: string | null
        }
        Update: {
          brand?: string
          caption?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          path?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_refs_brand_fkey"
            columns: ["brand"]
            isOneToOne: false
            referencedRelation: "marketing_brands"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "brand_refs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_strategies: {
        Row: {
          audience: string | null
          brand: string
          channels: string | null
          goals: string | null
          key_messages: string | null
          pillars: string | null
          story: string | null
          tone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          audience?: string | null
          brand: string
          channels?: string | null
          goals?: string | null
          key_messages?: string | null
          pillars?: string | null
          story?: string | null
          tone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          audience?: string | null
          brand?: string
          channels?: string | null
          goals?: string | null
          key_messages?: string | null
          pillars?: string | null
          story?: string | null
          tone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_strategies_brand_fkey"
            columns: ["brand"]
            isOneToOne: true
            referencedRelation: "marketing_brands"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "brand_strategies_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      content_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          item_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          item_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_comments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_item_assets: {
        Row: {
          asset_id: string
          item_id: string
        }
        Insert: {
          asset_id: string
          item_id: string
        }
        Update: {
          asset_id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_item_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "marketing_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_item_assets_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          assignee_id: string | null
          brands: string[]
          brief: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          published_at: string | null
          stage: string
          stage_changed_at: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          brands?: string[]
          brief?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          published_at?: string | null
          stage?: string
          stage_changed_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          brands?: string[]
          brief?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          published_at?: string | null
          stage?: string
          stage_changed_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automations: {
        Row: {
          active: boolean
          application_url: string | null
          followup_body: string
          followup_days: number
          followup_subject: string
          key: string
          name: string
          updated_at: string
          welcome_body: string
          welcome_subject: string
        }
        Insert: {
          active?: boolean
          application_url?: string | null
          followup_body?: string
          followup_days?: number
          followup_subject?: string
          key: string
          name: string
          updated_at?: string
          welcome_body?: string
          welcome_subject?: string
        }
        Update: {
          active?: boolean
          application_url?: string | null
          followup_body?: string
          followup_days?: number
          followup_subject?: string
          key?: string
          name?: string
          updated_at?: string
          welcome_body?: string
          welcome_subject?: string
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          body: string
          brands: string[]
          created_at: string
          created_by: string | null
          id: string
          list_key: string
          name: string
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          body?: string
          brands?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          list_key?: string
          name: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Update: {
          body?: string
          brands?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          list_key?: string
          name?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sends: {
        Row: {
          automation_step: string | null
          bounced_at: string | null
          campaign_id: string | null
          clicked_at: string | null
          contact_id: string | null
          created_at: string
          delivered_at: string | null
          email: string
          id: string
          opened_at: string | null
          resend_id: string | null
          sent_at: string | null
          status: string
          unsubscribed_at: string | null
        }
        Insert: {
          automation_step?: string | null
          bounced_at?: string | null
          campaign_id?: string | null
          clicked_at?: string | null
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          email: string
          id?: string
          opened_at?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          unsubscribed_at?: string | null
        }
        Update: {
          automation_step?: string | null
          bounced_at?: string | null
          campaign_id?: string | null
          clicked_at?: string | null
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          email?: string
          id?: string
          opened_at?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_assets: {
        Row: {
          body: string | null
          brands: string[]
          created_at: string
          created_by: string | null
          id: string
          kind: string
          path: string | null
          tags: string[]
          title: string
        }
        Insert: {
          body?: string | null
          brands?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          path?: string | null
          tags?: string[]
          title: string
        }
        Update: {
          body?: string | null
          brands?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          path?: string | null
          tags?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_brands: {
        Row: {
          color: string
          key: string
          name: string
          position: number
        }
        Insert: {
          color: string
          key: string
          name: string
          position?: number
        }
        Update: {
          color?: string
          key?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      social_post_assets: {
        Row: {
          asset_id: string
          position: number
          post_id: string
        }
        Insert: {
          asset_id: string
          position?: number
          post_id: string
        }
        Update: {
          asset_id?: string
          position?: number
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "marketing_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_post_assets_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          brands: string[]
          caption: string
          channels: string[]
          comments: number | null
          content_item_id: string | null
          created_at: string
          created_by: string | null
          id: string
          likes: number | null
          link: string | null
          published_at: string | null
          reach: number | null
          saves: number | null
          scheduled_at: string
          shares: number | null
          status: string
          updated_at: string
        }
        Insert: {
          brands?: string[]
          caption?: string
          channels?: string[]
          comments?: number | null
          content_item_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          likes?: number | null
          link?: string | null
          published_at?: string | null
          reach?: number | null
          saves?: number | null
          scheduled_at: string
          shares?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          brands?: string[]
          caption?: string
          channels?: string[]
          comments?: number | null
          content_item_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          likes?: number | null
          link?: string | null
          published_at?: string | null
          reach?: number | null
          saves?: number | null
          scheduled_at?: string
          shares?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      my_guests: { Args: never; Returns: Json };
      todays_guests: {
        Args: never;
        Returns: { guest_name: string; host_name: string; token: string; status: string; used_at: string | null }[];
      };
      my_rate: { Args: never; Returns: string | null };
      invite_guest: {
        Args: { p_name: string; p_phone: string | null; p_email: string | null; p_visit_date: string };
        Returns: string;
      };
      book_court: {
        Args: { p_court: string; p_date: string; p_start: string };
        Returns: string;
      };
      cancel_court_booking: { Args: { p_id: string }; Returns: undefined };
      court_class_at: {
        Args: { p_court: string; p_date: string; p_end: string; p_start: string };
        Returns: string;
      };
      my_court_bookings: {
        Args: never;
        Returns: { court: string; date: string; end_time: string; id: string; start_time: string }[];
      };
      court_day: {
        Args: { p_date: string };
        Returns: { court_id: string; end_time: string; id: string; mine: boolean; start_time: string }[];
      };
      cancel_guest: { Args: { p_id: string }; Returns: undefined };
      use_guest_pass: { Args: { p_token: string }; Returns: string };
      guest_pass_by_token: {
        Args: { p_token: string };
        Returns: {
          guest_name: string;
          host_name: string;
          visit_date: string;
          status: string;
          state: string;
          used_at: string | null;
          can_log: boolean;
        }[];
      };
      public_listings: {
        Args: { p_check_in?: string | null; p_check_out?: string | null; p_guests?: number | null };
        Returns: {
          id: string;
          title: string;
          summary: string | null;
          zone: string | null;
          bedrooms: number | null;
          beds: number | null;
          bathrooms: number | null;
          max_guests: number | null;
          min_nights: number;
          nightly_rate: number | null;
          rate_currency: string;
          cleaning_fee: number | null;
          amenities: string[];
          cover_path: string | null;
          available: boolean;
        }[];
      };
      public_listing: { Args: { p_id: string }; Returns: Json };
      request_stay: {
        Args: {
          p_lot_id: string;
          p_check_in: string;
          p_check_out: string;
          p_guests: number;
          p_name: string;
          p_email: string;
          p_phone: string | null;
          p_message: string | null;
        };
        Returns: string;
      };
      can_work_gate: { Args: never; Returns: boolean };
      is_estate_staff: { Args: never; Returns: boolean };
      org_now: { Args: never; Returns: string };
      my_pass_token: { Args: never; Returns: string | null };
      log_pass_entry: { Args: { p_token: string }; Returns: string };
      pass_by_token: {
        Args: { p_token: string };
        Returns: {
          contact_id: string;
          holder: string;
          tier: string | null;
          tier_name: string | null;
          period: string;
          membership_status: string | null;
          valid_from: string | null;
          valid_until: string | null;
          state: string;
          can_log: boolean;
          is_mine: boolean;
          last_entry_at: string | null;
        }[];
      };
      book_session: {
        Args: {
          p_email: string;
          p_name: string;
          p_offering_id: string;
          p_session_date: string;
          p_ticket_type_id?: string;
        };
        Returns: { qr_token: string; registration_id: string }[];
      };
      check_in: { Args: { p_token: string }; Returns: string };
      current_member_contact_id: { Args: never; Returns: string | null };
      current_staff_id: { Args: never; Returns: string | null };
      dashboard_counts: {
        Args: never;
        Returns: {
          active_members: number;
          active_team: number;
          divisions: number;
          offerings: number;
          open_tasks: number;
          overdue_tasks: number;
          tasks: number;
        }[];
      };
      facilitator_names: {
        Args: never;
        Returns: { id: string; name: string }[];
      };
      is_member: { Args: never; Returns: boolean };
      is_school_staff: { Args: never; Returns: boolean };
      school_add_guardian: {
        Args: {
          p_contact_id: string | null;
          p_email: string | null;
          p_name: string;
          p_phone: string | null;
          p_relation: string | null;
          p_student_id: string;
        };
        Returns: string;
      };
      shop_contact_search: {
        Args: { q: string };
        Returns: { id: string; name: string; email: string | null; tier: string | null }[];
      };
      contact_activity: {
        Args: { cid: string };
        Returns: {
          at: string;
          area: string;
          title: string;
          detail: string | null;
          amount: number | null;
          currency: string | null;
          status: string | null;
          link: string | null;
        }[];
      };
      is_active_member: { Args: { cid: string }; Returns: boolean };
      is_sample: { Args: { p_table: string; p_id: string }; Returns: boolean };
      is_marketing: { Args: never; Returns: boolean }
      marketing_leads: {
        Args: { p_from: string; p_to: string; p_brand?: string | null };
        Returns: { day: string; source: string; medium: string | null; campaign: string | null; brand: string | null }[];
      };
      marketing_list: {
        Args: { p_list: string }
        Returns: {
          contact_id: string
          email: string
          name: string
        }[]
      }
      join_waitlist: {
        Args: {
          p_brand: string
          p_campaign: string
          p_email: string
          p_medium: string
          p_name: string
          p_phone: string
          p_source: string
        }
        Returns: string
      }
      email_unsubscribe: { Args: { p_send: string }; Returns: string }
      school_contact_search: {
        Args: { q: string };
        Returns: { email: string | null; id: string; name: string; phone: string | null }[];
      };
      is_staff: { Args: never; Returns: boolean };
      member_directory: {
        Args: never;
        Returns: {
          id: string;
          name: string;
          tier: string | null;
          city_id: string | null;
          bio: string | null;
          interests: string[];
          instagram: string | null;
          open_to_connect: boolean;
          is_me: boolean;
        }[];
      };
      member_names: {
        Args: { ids: string[] };
        Returns: { id: string; name: string; tier: string | null }[];
      };
      feed: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          parent_id: string | null;
          city_id: string | null;
          body: string;
          created_at: string;
          author_name: string;
          author_contact_id: string | null;
          from_team: boolean;
          mine: boolean;
        }[];
      };
      can_message: { Args: { recipient: string }; Returns: boolean };
      my_member_profile: {
        Args: never;
        Returns: {
          id: string;
          name: string;
          email: string | null;
          tier: string | null;
          membership_status: string;
          member_since: string | null;
          renews_on: string | null;
          city_id: string | null;
          bio: string | null;
          interests: string[];
          instagram: string | null;
          open_to_connect: boolean;
          show_in_directory: boolean;
          discount_name: string | null;
          discount_percent: number | null;
        }[];
      };
      insert_sample_posts: { Args: { p_posts: Json }; Returns: string[] };
      set_my_city: { Args: { p_city_id: string | null }; Returns: undefined };
      set_my_photo: { Args: { p_path: string | null }; Returns: undefined };
      my_photo: { Args: never; Returns: string | null };
      session_roster: {
        Args: { p_offering_id: string; p_date: string };
        Returns: {
          registration_id: string;
          name: string;
          photo_path: string | null;
          tier: string | null;
          is_member: boolean;
          source: string;
          paid: boolean;
          qr_token: string;
          checked_in_at: string | null;
        }[];
      };
      update_my_profile: {
        Args: {
          p_bio: string | null;
          p_interests: string[];
          p_city_id: string | null;
          p_instagram: string | null;
          p_open_to_connect: boolean;
          p_show_in_directory: boolean;
        };
        Returns: undefined;
      };
      org_today: { Args: never; Returns: string };
      public_org: {
        Args: never;
        Returns: {
          currency: string;
          location: string;
          name: string;
          timezone: string;
        }[];
      };
      save_sequence: {
        Args: {
          p_id: string | null;
          p_name: string;
          p_description: string | null;
          p_steps: Json;
        };
        Returns: string;
      };
      student_page: { Args: { p_token: string }; Returns: Json };
      session_counts: {
        Args: { p_offering_id: string; p_from: string; p_to: string };
        Returns: {
          session_date: string;
          ticket_type_id: string | null;
          taken: number;
        }[];
      };
      staff_role: { Args: never; Returns: string };
      tier_counts: {
        Args: never;
        Returns: { tier: string; active: number }[];
      };
      ticket_by_token: {
        Args: { p_token: string };
        Returns: {
          can_check_in: boolean;
          checked_in_at: string | null;
          currency: string | null;
          end_time: string | null;
          facilitator: string | null;
          holder: string;
          kind: string;
          location: string | null;
          offering_id: string;
          paid: boolean;
          price: number | null;
          registration_id: string;
          session_date: string;
          start_time: string | null;
          state: string;
          ticket_name: string | null;
          title: string;
          gate_opens: string | null;
        }[];
      };
      ticket_sales_for_month: { Args: { p_month: string }; Returns: number };
    };
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
