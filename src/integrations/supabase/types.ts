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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      allowlist: {
        Row: {
          created_at: string
          id: string
          identifier: string
          is_active: boolean
          type: Database["public"]["Enums"]["allowlist_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
          is_active?: boolean
          type: Database["public"]["Enums"]["allowlist_type"]
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
          is_active?: boolean
          type?: Database["public"]["Enums"]["allowlist_type"]
        }
        Relationships: []
      }
      conversions: {
        Row: {
          created_at: string
          fee: number
          from_amount: number
          from_network: string
          from_token: string
          id: string
          ngn_amount: number
          rate: number
          status: Database["public"]["Enums"]["conversion_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fee: number
          from_amount: number
          from_network: string
          from_token: string
          id?: string
          ngn_amount: number
          rate: number
          status?: Database["public"]["Enums"]["conversion_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fee?: number
          from_amount?: number
          from_network?: string
          from_token?: string
          id?: string
          ngn_amount?: number
          rate?: number
          status?: Database["public"]["Enums"]["conversion_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crypto_balances: {
        Row: {
          balance: number
          created_at: string
          id: string
          network: string
          token: string
          updated_at: string
          wallet_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          network: string
          token: string
          updated_at?: string
          wallet_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          network?: string
          token?: string
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crypto_balances_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      deposits: {
        Row: {
          address: string
          amount: number | null
          confirmations_count: number | null
          confirmed_at: string | null
          created_at: string
          detected_at: string | null
          id: string
          network: string
          provider_source: string | null
          reference_id: string | null
          status: Database["public"]["Enums"]["deposit_status"]
          token: string
          tx_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          amount?: number | null
          confirmations_count?: number | null
          confirmed_at?: string | null
          created_at?: string
          detected_at?: string | null
          id?: string
          network: string
          provider_source?: string | null
          reference_id?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          token: string
          tx_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          amount?: number | null
          confirmations_count?: number | null
          confirmed_at?: string | null
          created_at?: string
          detected_at?: string | null
          id?: string
          network?: string
          provider_source?: string | null
          reference_id?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          token?: string
          tx_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          category: Database["public"]["Enums"]["feedback_category"]
          created_at: string
          id: string
          is_read: boolean
          message: string
          page: string | null
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          page?: string | null
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          page?: string | null
          user_id?: string
        }
        Relationships: []
      }
      invite_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          email: string
          id: string
          message: string | null
          status: Database["public"]["Enums"]["invite_request_status"]
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          email: string
          id?: string
          message?: string | null
          status?: Database["public"]["Enums"]["invite_request_status"]
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          status?: Database["public"]["Enums"]["invite_request_status"]
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      ngn_balances: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          wallet_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          wallet_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ngn_balances_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: true
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          related_id: string | null
          related_kind: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          related_id?: string | null
          related_kind?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          related_id?: string | null
          related_kind?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount: number
          asset: string
          created_at: string
          expires_at: string
          id: string
          note: string | null
          recipient_id: string
          recipient_username: string | null
          requester_id: string
          requester_username: string | null
          status: Database["public"]["Enums"]["payment_request_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          asset: string
          created_at?: string
          expires_at: string
          id?: string
          note?: string | null
          recipient_id: string
          recipient_username?: string | null
          requester_id: string
          requester_username?: string | null
          status?: Database["public"]["Enums"]["payment_request_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          asset?: string
          created_at?: string
          expires_at?: string
          id?: string
          note?: string | null
          recipient_id?: string
          recipient_username?: string | null
          requester_id?: string
          requester_username?: string | null
          status?: Database["public"]["Enums"]["payment_request_status"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_admin: boolean
          kyc_tier: number
          onboarding_completed: boolean
          updated_at: string
          user_id: string
          username: string | null
          wallet_address: string | null
          wallet_connected_at: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_admin?: boolean
          kyc_tier?: number
          onboarding_completed?: boolean
          updated_at?: string
          user_id: string
          username?: string | null
          wallet_address?: string | null
          wallet_connected_at?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_admin?: boolean
          kyc_tier?: number
          onboarding_completed?: boolean
          updated_at?: string
          user_id?: string
          username?: string | null
          wallet_address?: string | null
          wallet_connected_at?: string | null
        }
        Relationships: []
      }
      saved_bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_code: string
          bank_name: string
          created_at: string
          id: string
          is_default: boolean
          is_verified_owner: boolean
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_code: string
          bank_name: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_verified_owner?: boolean
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_code?: string
          bank_name?: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_verified_owner?: boolean
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_display: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["transaction_kind"]
          metadata: Json | null
          status: string
          subtitle: string | null
          title: string
          user_id: string
        }
        Insert: {
          amount_display: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["transaction_kind"]
          metadata?: Json | null
          status: string
          subtitle?: string | null
          title: string
          user_id: string
        }
        Update: {
          amount_display?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["transaction_kind"]
          metadata?: Json | null
          status?: string
          subtitle?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          created_at: string
          id: string
          type: Database["public"]["Enums"]["wallet_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          type: Database["public"]["Enums"]["wallet_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["public"]["Enums"]["wallet_type"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          account_name: string
          account_number: string
          amount: number
          bank_code: string
          bank_name: string
          created_at: string
          id: string
          reference: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          amount: number
          bank_code: string
          bank_name: string
          created_at?: string
          id?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          amount?: number
          bank_code?: string
          bank_name?: string
          created_at?: string
          id?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      convert_crypto_to_ngn: {
        Args: {
          _amount: number
          _fee: number
          _net_ngn: number
          _network: string
          _rate: number
          _token: string
        }
        Returns: Json
      }
      get_user_wallet_id: {
        Args: {
          _type: Database["public"]["Enums"]["wallet_type"]
          _user_id: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lookup_public_profile: {
        Args: { _username: string }
        Returns: {
          display_name: string
          username: string
        }[]
      }
      lookup_username: {
        Args: { _username: string }
        Returns: {
          display_name: string
          user_id: string
          username: string
        }[]
      }
      pay_payment_request: { Args: { _request_id: string }; Returns: Json }
      reset_all_users_data: { Args: { _seed_balance?: boolean }; Returns: Json }
      reset_demo_data: { Args: { _seed_balance?: boolean }; Returns: Json }
      transfer_crypto:
        | {
            Args: {
              _amount: number
              _network: string
              _recipient_username: string
              _token: string
            }
            Returns: Json
          }
        | {
            Args: {
              _amount: number
              _network: string
              _recipient_username: string
              _sender_id: string
              _token: string
            }
            Returns: Json
          }
      withdraw_ngn: {
        Args: {
          _account_name: string
          _account_number: string
          _amount: number
          _bank_code: string
          _bank_name: string
          _fee: number
        }
        Returns: Json
      }
    }
    Enums: {
      allowlist_type: "EMAIL" | "USERNAME"
      app_role: "admin" | "moderator" | "user"
      conversion_status: "PROCESSING" | "SUCCESS" | "FAILED"
      deposit_status: "PENDING" | "CONFIRMED" | "FAILED" | "DETECTED"
      feedback_category: "BUG" | "IDEA" | "OTHER"
      invite_request_status: "PENDING" | "APPROVED" | "DECLINED"
      payment_request_status: "PENDING" | "PAID" | "DECLINED" | "EXPIRED"
      transaction_kind: "DEPOSIT" | "CONVERT" | "WITHDRAW" | "SEND" | "RECEIVE"
      wallet_type: "CRYPTO" | "NGN"
      withdrawal_status: "PROCESSING" | "SUCCESS" | "FAILED"
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
      allowlist_type: ["EMAIL", "USERNAME"],
      app_role: ["admin", "moderator", "user"],
      conversion_status: ["PROCESSING", "SUCCESS", "FAILED"],
      deposit_status: ["PENDING", "CONFIRMED", "FAILED", "DETECTED"],
      feedback_category: ["BUG", "IDEA", "OTHER"],
      invite_request_status: ["PENDING", "APPROVED", "DECLINED"],
      payment_request_status: ["PENDING", "PAID", "DECLINED", "EXPIRED"],
      transaction_kind: ["DEPOSIT", "CONVERT", "WITHDRAW", "SEND", "RECEIVE"],
      wallet_type: ["CRYPTO", "NGN"],
      withdrawal_status: ["PROCESSING", "SUCCESS", "FAILED"],
    },
  },
} as const
