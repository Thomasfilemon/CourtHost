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
      match_players: {
        Row: {
          created_at: string
          id: string
          match_id: string
          session_player_id: string
          team: number
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          session_player_id: string
          team: number
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          session_player_id?: string
          team?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_players_session_player_id_fkey"
            columns: ["session_player_id"]
            isOneToOne: false
            referencedRelation: "session_leaderboards"
            referencedColumns: ["session_player_id"]
          },
          {
            foreignKeyName: "match_players_session_player_id_fkey"
            columns: ["session_player_id"]
            isOneToOne: false
            referencedRelation: "session_players"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          cancellation_reason: string | null
          court_number: number | null
          created_at: string
          finished_at: string | null
          id: string
          match_number: number
          round_number: number
          session_id: string
          started_at: string | null
          status: string
          team1_score: number | null
          team2_score: number | null
        }
        Insert: {
          cancellation_reason?: string | null
          court_number?: number | null
          created_at?: string
          finished_at?: string | null
          id?: string
          match_number: number
          round_number?: number
          session_id: string
          started_at?: string | null
          status?: string
          team1_score?: number | null
          team2_score?: number | null
        }
        Update: {
          cancellation_reason?: string | null
          court_number?: number | null
          created_at?: string
          finished_at?: string | null
          id?: string
          match_number?: number
          round_number?: number
          session_id?: string
          started_at?: string | null
          status?: string
          team1_score?: number | null
          team2_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking_runs: {
        Row: {
          algorithm: string
          created_at: string
          id: string
          match_id: string | null
          players_considered: number
          session_id: string
          skill_difference: number | null
        }
        Insert: {
          algorithm: string
          created_at?: string
          id?: string
          match_id?: string | null
          players_considered: number
          session_id: string
          skill_difference?: number | null
        }
        Update: {
          algorithm?: string
          created_at?: string
          id?: string
          match_id?: string | null
          players_considered?: number
          session_id?: string
          skill_difference?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matchmaking_runs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchmaking_runs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          default_skill_rating: number
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          default_skill_rating?: number
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          default_skill_rating?: number
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      session_players: {
        Row: {
          created_at: string
          id: string
          is_retired: boolean
          name_snapshot: string
          player_id: string
          session_id: string
          skill_rating: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_retired?: boolean
          name_snapshot: string
          player_id: string
          session_id: string
          skill_rating?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_retired?: boolean
          name_snapshot?: string
          player_id?: string
          session_id?: string
          skill_rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          duration_minutes: number
          estimated_match_minutes: number
          final_leaderboard: Json | null
          game_mode: string
          host_id: string
          id: string
          matchmaking_mode: string
          name: string
          public_code: string
          realtime_token: string
          share_revoked_at: string | null
          start_time: string
          started_at: string | null
          status: string
          venue: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          duration_minutes: number
          estimated_match_minutes?: number
          final_leaderboard?: Json | null
          game_mode: string
          host_id: string
          id?: string
          matchmaking_mode: string
          name: string
          public_code?: string
          realtime_token?: string
          share_revoked_at?: string | null
          start_time: string
          started_at?: string | null
          status?: string
          venue?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          duration_minutes?: number
          estimated_match_minutes?: number
          final_leaderboard?: Json | null
          game_mode?: string
          host_id?: string
          id?: string
          matchmaking_mode?: string
          name?: string
          public_code?: string
          realtime_token?: string
          share_revoked_at?: string | null
          start_time?: string
          started_at?: string | null
          status?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      session_leaderboards: {
        Row: {
          draws: number | null
          game_difference: number | null
          games_lost: number | null
          games_won: number | null
          losses: number | null
          matches_played: number | null
          player_id: string | null
          player_name: string | null
          points: number | null
          ranking: number | null
          session_id: string | null
          session_player_id: string | null
          skill_rating: number | null
          wins: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      courthost_command: {
        Args: { p_action: string; p_data?: Json }
        Returns: Json
      }
      get_public_session: { Args: { p_token: string }; Returns: Json }
    }
    Enums: {
      matchmaking_type: "random" | "skill"
      matchup_status: "pending" | "completed"
      matchup_team: "A" | "B"
      session_mode: "single" | "double"
      session_status: "active" | "completed"
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
    Enums: {
      matchmaking_type: ["random", "skill"],
      matchup_status: ["pending", "completed"],
      matchup_team: ["A", "B"],
      session_mode: ["single", "double"],
      session_status: ["active", "completed"],
    },
  },
} as const

