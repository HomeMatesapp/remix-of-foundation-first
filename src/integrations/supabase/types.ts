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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_user: {
        Row: {
          account_state: Database["public"]["Enums"]["account_state"]
          anonymised_at: string | null
          auth_linked_at: string | null
          auth_unlinked_at: string | null
          auth_user_id: string | null
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          account_state?: Database["public"]["Enums"]["account_state"]
          anonymised_at?: string | null
          auth_linked_at?: string | null
          auth_unlinked_at?: string | null
          auth_user_id?: string | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          account_state?: Database["public"]["Enums"]["account_state"]
          anonymised_at?: string | null
          auth_linked_at?: string | null
          auth_unlinked_at?: string | null
          auth_user_id?: string | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      institution: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["relationship_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          status?: Database["public"]["Enums"]["relationship_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["relationship_status"]
          updated_at?: string
        }
        Relationships: []
      }
      institution_participant: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          institution_id: string
          institution_reference: string | null
          participant_profile_id: string
          started_at: string
          status: Database["public"]["Enums"]["participant_link_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          institution_id: string
          institution_reference?: string | null
          participant_profile_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["participant_link_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          institution_id?: string
          institution_reference?: string | null
          participant_profile_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["participant_link_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_participant_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_participant_participant_profile_id_fkey"
            columns: ["participant_profile_id"]
            isOneToOne: false
            referencedRelation: "participant_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_role_assignment: {
        Row: {
          granted_at: string
          id: string
          internal_user_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["internal_role"]
        }
        Insert: {
          granted_at?: string
          id?: string
          internal_user_id: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["internal_role"]
        }
        Update: {
          granted_at?: string
          id?: string
          internal_user_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["internal_role"]
        }
        Relationships: [
          {
            foreignKeyName: "internal_role_assignment_internal_user_id_fkey"
            columns: ["internal_user_id"]
            isOneToOne: false
            referencedRelation: "internal_user"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_user: {
        Row: {
          app_user_id: string
          created_at: string
          display_name: string
          id: string
          status: Database["public"]["Enums"]["relationship_status"]
          updated_at: string
        }
        Insert: {
          app_user_id: string
          created_at?: string
          display_name: string
          id?: string
          status?: Database["public"]["Enums"]["relationship_status"]
          updated_at?: string
        }
        Update: {
          app_user_id?: string
          created_at?: string
          display_name?: string
          id?: string
          status?: Database["public"]["Enums"]["relationship_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_user_app_user_id_fkey"
            columns: ["app_user_id"]
            isOneToOne: true
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_profile: {
        Row: {
          app_user_id: string
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          app_user_id: string
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          app_user_id?: string
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_profile_app_user_id_fkey"
            columns: ["app_user_id"]
            isOneToOne: true
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_role_assignment: {
        Row: {
          granted_at: string
          id: string
          institution_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["institution_role"]
          staff_user_id: string
        }
        Insert: {
          granted_at?: string
          id?: string
          institution_id: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["institution_role"]
          staff_user_id: string
        }
        Update: {
          granted_at?: string
          id?: string
          institution_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["institution_role"]
          staff_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_role_assignment_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_role_same_institution"
            columns: ["staff_user_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "staff_user"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
      staff_user: {
        Row: {
          app_user_id: string
          created_at: string
          display_name: string
          id: string
          institution_id: string
          status: Database["public"]["Enums"]["relationship_status"]
          updated_at: string
        }
        Insert: {
          app_user_id: string
          created_at?: string
          display_name: string
          id?: string
          institution_id: string
          status?: Database["public"]["Enums"]["relationship_status"]
          updated_at?: string
        }
        Update: {
          app_user_id?: string
          created_at?: string
          display_name?: string
          id?: string
          institution_id?: string
          status?: Database["public"]["Enums"]["relationship_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_user_app_user_id_fkey"
            columns: ["app_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_user_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role: {
        Row: {
          app_user_id: string
          granted_at: string
          id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_user_role"]
        }
        Insert: {
          app_user_id: string
          granted_at?: string
          id?: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["app_user_role"]
        }
        Update: {
          app_user_id?: string
          granted_at?: string
          id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "user_role_app_user_id_fkey"
            columns: ["app_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_institution: {
        Args: { _institution_id: string }
        Returns: boolean
      }
      can_access_participant: {
        Args: { _participant_profile_id: string }
        Returns: boolean
      }
      current_app_user_id: { Args: never; Returns: string }
      current_participant_id: { Args: never; Returns: string }
      has_institution_role: {
        Args: {
          _institution_id: string
          _role: Database["public"]["Enums"]["institution_role"]
        }
        Returns: boolean
      }
      is_internal: {
        Args: { _role?: Database["public"]["Enums"]["internal_role"] }
        Returns: boolean
      }
    }
    Enums: {
      account_state: "active" | "suspended" | "login_removed" | "anonymised"
      app_user_role: "participant" | "staff" | "internal"
      institution_role:
        | "adviser"
        | "careers_lead"
        | "institution_admin"
        | "read_only"
      internal_role: "viewer" | "editor" | "reviewer" | "approver" | "admin"
      participant_link_status:
        | "invited"
        | "active"
        | "inactive"
        | "withdrawn"
        | "archived"
      relationship_status: "active" | "inactive"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_state: ["active", "suspended", "login_removed", "anonymised"],
      app_user_role: ["participant", "staff", "internal"],
      institution_role: [
        "adviser",
        "careers_lead",
        "institution_admin",
        "read_only",
      ],
      internal_role: ["viewer", "editor", "reviewer", "approver", "admin"],
      participant_link_status: [
        "invited",
        "active",
        "inactive",
        "withdrawn",
        "archived",
      ],
      relationship_status: ["active", "inactive"],
    },
  },
} as const
