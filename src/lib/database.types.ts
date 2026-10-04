// Generated from the Supabase schema (project theark). Regenerate after
// migrations with the Supabase MCP `generate_typescript_types` or
// `supabase gen types typescript --project-id iwqxscsejpnsxfxxnmun`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Required extends keyof Row, R extends Rel[] = []> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: R;
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      cities: Table<
        {
          active: boolean;
          blurb: string | null;
          country: string | null;
          cover_path: string | null;
          created_at: string;
          id: string;
          is_home: boolean;
          name: string;
          position: number;
        },
        "name"
      >;
      contact_notes: Table<
        {
          author_id: string | null;
          body: string;
          contact_id: string;
          created_at: string;
          id: string;
        },
        "body" | "contact_id",
        [
          {
            foreignKeyName: "contact_notes_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "team_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_notes_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ]
      >;
      contact_stages: Table<
        {
          contact_id: string;
          pipeline: string;
          stage: string;
          updated_at: string;
        },
        "contact_id" | "pipeline" | "stage",
        [
          {
            foreignKeyName: "contact_stages_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ]
      >;
      contacts: Table<
        {
          created_at: string;
          bio: string | null;
          city_id: string | null;
          created_by: string | null;
          discount_id: string | null;
          email: string | null;
          id: string;
          instagram: string | null;
          interests: string[];
          location: string | null;
          lot: string | null;
          member_since: string | null;
          membership_status: string;
          name: string;
          open_to_connect: boolean;
          owner_id: string | null;
          phone: string | null;
          renews_on: string | null;
          resident: boolean;
          show_in_directory: boolean;
          source: string | null;
          tier: string | null;
          type: string;
          updated_at: string;
          user_id: string | null;
        },
        "name",
        [
          {
            foreignKeyName: "contacts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "team_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contacts_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "team_members";
            referencedColumns: ["id"];
          },
        ]
      >;
      discounts: Table<
        {
          active: boolean;
          created_at: string;
          description: string | null;
          id: string;
          lifetime: boolean;
          name: string;
          percent: number;
        },
        "name" | "percent"
      >;
      divisions: Table<
        {
          color: string;
          created_at: string;
          description: string | null;
          id: string;
          lead_id: string | null;
          name: string;
          updated_at: string;
        },
        "name",
        [
          {
            foreignKeyName: "divisions_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "team_members";
            referencedColumns: ["id"];
          },
        ]
      >;
      enrollment_sends: Table<
        {
          enrollment_id: string;
          sent_by: string | null;
          sent_on: string;
          step_position: number;
        },
        "enrollment_id" | "step_position",
        [
          {
            foreignKeyName: "enrollment_sends_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["id"];
          },
        ]
      >;
      enrollments: Table<
        {
          contact_id: string;
          created_at: string;
          id: string;
          sequence_id: string;
          started_on: string;
          status: string;
        },
        "contact_id" | "sequence_id",
        [
          {
            foreignKeyName: "enrollments_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_sequence_id_fkey";
            columns: ["sequence_id"];
            isOneToOne: false;
            referencedRelation: "sequences";
            referencedColumns: ["id"];
          },
        ]
      >;
      finance_months: Table<
        {
          ap: number | null;
          ar: number | null;
          cash: number | null;
          cash_date: string | null;
          created_at: string;
          events: number | null;
          expenses: number | null;
          fnb: number | null;
          land: number | null;
          membership: number | null;
          month: string;
          notes: string | null;
          other: number | null;
          shop: number | null;
          updated_at: string;
        },
        "month"
      >;
      membership_tiers: Table<
        {
          active: boolean;
          currency: string;
          description: string | null;
          key: string;
          name: string;
          pause_rule: string | null;
          period: string;
          perks: string[];
          position: number;
          price: number | null;
          spots: number | null;
          updated_at: string;
        },
        "key" | "name"
      >;
      messages: Table<
        {
          body: string;
          created_at: string;
          id: string;
          read_at: string | null;
          recipient_id: string;
          sender_id: string;
        },
        "body" | "recipient_id" | "sender_id"
      >;
      offerings: Table<
        {
          access: string;
          capacity: number | null;
          city_id: string | null;
          cover_path: string | null;
          created_at: string;
          created_by: string | null;
          days: number[];
          description: string | null;
          end_date: string | null;
          end_time: string | null;
          facilitator_id: string | null;
          id: string;
          kind: string;
          location: string | null;
          repeat: string;
          start_date: string;
          start_time: string | null;
          status: string;
          title: string;
          updated_at: string;
        },
        "kind" | "start_date" | "title",
        [
          {
            foreignKeyName: "offerings_facilitator_id_fkey";
            columns: ["facilitator_id"];
            isOneToOne: false;
            referencedRelation: "team_members";
            referencedColumns: ["id"];
          },
        ]
      >;
      org_settings: Table<
        {
          currency: string;
          currency2: string | null;
          email: string | null;
          id: boolean;
          language: string;
          location: string;
          member_cap: number | null;
          name: string | null;
          timezone: string;
          updated_at: string;
        },
        never
      >;
      pipeline_assignments: Table<
        { pipeline: string; team_member_id: string },
        "pipeline" | "team_member_id",
        [
          {
            foreignKeyName: "pipeline_assignments_team_member_id_fkey";
            columns: ["team_member_id"];
            isOneToOne: false;
            referencedRelation: "team_members";
            referencedColumns: ["id"];
          },
        ]
      >;
      posts: Table<
        {
          author_contact_id: string | null;
          author_staff_id: string | null;
          body: string;
          city_id: string | null;
          created_at: string;
          id: string;
          parent_id: string | null;
        },
        "body"
      >;
      products: Table<
        {
          active: boolean;
          category: string;
          created_at: string;
          description: string | null;
          id: string;
          low_at: number;
          member_price: number | null;
          name: string;
          price: number;
          stock: number;
          unit: string | null;
          updated_at: string;
        },
        "name" | "price"
      >;
      registrations: Table<
        {
          checked_in_at: string | null;
          checked_in_by: string | null;
          contact_id: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          offering_id: string;
          paid: boolean;
          qr_token: string;
          session_date: string;
          source: string;
          ticket_emailed_at: string | null;
          ticket_type_id: string | null;
          user_id: string | null;
        },
        "name" | "offering_id" | "session_date",
        [
          {
            foreignKeyName: "registrations_offering_id_fkey";
            columns: ["offering_id"];
            isOneToOne: false;
            referencedRelation: "offerings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registrations_ticket_type_id_fkey";
            columns: ["ticket_type_id"];
            isOneToOne: false;
            referencedRelation: "ticket_types";
            referencedColumns: ["id"];
          },
        ]
      >;
      sample_records: Table<
        { table_name: string; record_id: string },
        "table_name" | "record_id"
      >;
      sequence_steps: Table<
        {
          body: string;
          channel: string;
          delay_days: number;
          id: string;
          position: number;
          sequence_id: string;
          subject: string | null;
        },
        "body" | "position" | "sequence_id",
        [
          {
            foreignKeyName: "sequence_steps_sequence_id_fkey";
            columns: ["sequence_id"];
            isOneToOne: false;
            referencedRelation: "sequences";
            referencedColumns: ["id"];
          },
        ]
      >;
      sequences: Table<
        {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          updated_at: string;
        },
        "name"
      >;
      session_cancellations: Table<
        { created_at: string; offering_id: string; session_date: string },
        "offering_id" | "session_date",
        [
          {
            foreignKeyName: "session_cancellations_offering_id_fkey";
            columns: ["offering_id"];
            isOneToOne: false;
            referencedRelation: "offerings";
            referencedColumns: ["id"];
          },
        ]
      >;
      stock_movements: Table<
        {
          by_id: string | null;
          created_at: string;
          delta: number;
          id: string;
          product_id: string;
          type: string;
        },
        "delta" | "product_id" | "type",
        [
          {
            foreignKeyName: "stock_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ]
      >;
      tasks: Table<
        {
          assignee_id: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          division_id: string | null;
          due_date: string | null;
          id: string;
          kind: string;
          location: string | null;
          position: number;
          priority: string;
          status: string;
          title: string;
          updated_at: string;
        },
        "title",
        [
          {
            foreignKeyName: "tasks_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "team_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_division_id_fkey";
            columns: ["division_id"];
            isOneToOne: false;
            referencedRelation: "divisions";
            referencedColumns: ["id"];
          },
        ]
      >;
      team_members: Table<
        {
          created_at: string;
          division_id: string | null;
          email: string | null;
          id: string;
          name: string;
          phone: string | null;
          responsibilities: string | null;
          role: string;
          start_date: string | null;
          status: string;
          title: string | null;
          type: string;
          updated_at: string;
          user_id: string | null;
        },
        "name",
        [
          {
            foreignKeyName: "team_members_division_id_fkey";
            columns: ["division_id"];
            isOneToOne: false;
            referencedRelation: "divisions";
            referencedColumns: ["id"];
          },
        ]
      >;
      ticket_types: Table<
        {
          currency: string;
          id: string;
          name: string;
          offering_id: string;
          payment_link: string | null;
          position: number;
          price: number;
          qty: number | null;
        },
        "name" | "offering_id",
        [
          {
            foreignKeyName: "ticket_types_offering_id_fkey";
            columns: ["offering_id"];
            isOneToOne: false;
            referencedRelation: "offerings";
            referencedColumns: ["id"];
          },
        ]
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
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
        }[];
      };
      ticket_sales_for_month: { Args: { p_month: string }; Returns: number };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicTables = Database["public"]["Tables"];
export type Tables<T extends keyof PublicTables> = PublicTables[T]["Row"];
export type TablesInsert<T extends keyof PublicTables> =
  PublicTables[T]["Insert"];
export type TablesUpdate<T extends keyof PublicTables> =
  PublicTables[T]["Update"];
