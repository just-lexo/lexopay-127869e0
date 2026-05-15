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
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json
          id: string
          target_id: string | null
          target_kind: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_kind?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_kind?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
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
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      conversion_quotes: {
        Row: {
          consumed: boolean
          consumed_at: string | null
          created_at: string
          display_rate: number
          expires_at: string
          fee: number
          from_amount: number
          id: string
          market_rate: number
          network: string
          ngn_amount: number
          spread_pct: number
          token: string
          user_id: string
        }
        Insert: {
          consumed?: boolean
          consumed_at?: string | null
          created_at?: string
          display_rate: number
          expires_at: string
          fee: number
          from_amount: number
          id?: string
          market_rate: number
          network: string
          ngn_amount: number
          spread_pct?: number
          token: string
          user_id: string
        }
        Update: {
          consumed?: boolean
          consumed_at?: string | null
          created_at?: string
          display_rate?: number
          expires_at?: string
          fee?: number
          from_amount?: number
          id?: string
          market_rate?: number
          network?: string
          ngn_amount?: number
          spread_pct?: number
          token?: string
          user_id?: string
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
      daily_usage: {
        Row: {
          ngn_outflow: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          ngn_outflow?: number
          updated_at?: string
          usage_date: string
          user_id: string
        }
        Update: {
          ngn_outflow?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
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
      kyc_submissions: {
        Row: {
          admin_note: string | null
          created_at: string
          date_of_birth: string | null
          document_url: string | null
          full_name: string
          id: string
          id_number: string | null
          id_type: string | null
          phone_number: string
          selfie_url: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          date_of_birth?: string | null
          document_url?: string | null
          full_name: string
          id?: string
          id_number?: string | null
          id_type?: string | null
          phone_number: string
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          date_of_birth?: string | null
          document_url?: string | null
          full_name?: string
          id?: string
          id_number?: string | null
          id_type?: string | null
          phone_number?: string
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id?: string
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
          frozen_at: string | null
          frozen_reason: string | null
          id: string
          is_admin: boolean
          is_frozen: boolean
          kyc_tier: number
          onboarding_completed: boolean
          pin_set_at: string | null
          transaction_pin_hash: string | null
          updated_at: string
          user_id: string
          username: string | null
          wallet_address: string | null
          wallet_connected_at: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          frozen_at?: string | null
          frozen_reason?: string | null
          id?: string
          is_admin?: boolean
          is_frozen?: boolean
          kyc_tier?: number
          onboarding_completed?: boolean
          pin_set_at?: string | null
          transaction_pin_hash?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
          wallet_address?: string | null
          wallet_connected_at?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          frozen_at?: string | null
          frozen_reason?: string | null
          id?: string
          is_admin?: boolean
          is_frozen?: boolean
          kyc_tier?: number
          onboarding_completed?: boolean
          pin_set_at?: string | null
          transaction_pin_hash?: string | null
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
      support_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_id: string
          sender_role: Database["public"]["Enums"]["support_sender_role"]
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_id: string
          sender_role: Database["public"]["Enums"]["support_sender_role"]
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
          sender_role?: Database["public"]["Enums"]["support_sender_role"]
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_reply: string | null
          created_at: string
          id: string
          message: string
          priority: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message: string
          priority?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message?: string
          priority?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_display: string
          created_at: string
          id: string
          idempotency_key: string | null
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
          idempotency_key?: string | null
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
          idempotency_key?: string | null
          kind?: Database["public"]["Enums"]["transaction_kind"]
          metadata?: Json | null
          status?: string
          subtitle?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      treasury_ledger: {
        Row: {
          amount: number
          asset: string
          created_at: string
          entry_type: string
          id: string
          metadata: Json
          reference_id: string | null
          reference_kind: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          asset: string
          created_at?: string
          entry_type: string
          id?: string
          metadata?: Json
          reference_id?: string | null
          reference_kind?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          asset?: string
          created_at?: string
          entry_type?: string
          id?: string
          metadata?: Json
          reference_id?: string | null
          reference_kind?: string | null
          user_id?: string | null
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
      _bump_daily_usage: {
        Args: { _ngn: number; _uid: string }
        Returns: undefined
      }
      _verify_pin_internal: {
        Args: { _pin: string; _uid: string }
        Returns: boolean
      }
      admin_resolve_withdrawal: {
        Args: { _note?: string; _success: boolean; _withdrawal_id: string }
        Returns: Json
      }
      admin_set_account_frozen: {
        Args: { _frozen: boolean; _reason?: string; _target_user: string }
        Returns: Json
      }
      admin_treasury_kpis: { Args: never; Returns: Json }
      change_transaction_pin: {
        Args: { _new_pin: string; _old_pin: string }
        Returns: Json
      }
      consume_conversion_quote: { Args: { _quote_id: string }; Returns: Json }
      convert_crypto_to_ngn: {
        Args: { _amount: number; _network: string; _token: string }
        Returns: Json
      }
      get_tier_daily_limit: { Args: { _tier: number }; Returns: number }
      get_user_kyc_status: { Args: { _user_id: string }; Returns: string }
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
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
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
      process_internal_transfer:
        | {
            Args: {
              _amount: number
              _idempotency_key: string
              _network: string
              _recipient_username: string
              _token: string
            }
            Returns: Json
          }
        | {
            Args: {
              _amount: number
              _idempotency_key: string
              _network: string
              _pin?: string
              _recipient_username: string
              _token: string
            }
            Returns: Json
          }
      request_crypto_conversion: {
        Args: {
          _amount: number
          _estimated_fee: number
          _estimated_ngn: number
          _estimated_rate: number
          _network: string
          _token: string
        }
        Returns: Json
      }
      reset_all_users_data: { Args: { _seed_balance?: boolean }; Returns: Json }
      reset_demo_data: { Args: { _seed_balance?: boolean }; Returns: Json }
      set_transaction_pin: { Args: { _pin: string }; Returns: Json }
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
      withdraw_ngn:
        | {
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
        | {
            Args: {
              _account_name: string
              _account_number: string
              _amount: number
              _bank_code: string
              _bank_name: string
              _fee: number
              _pin?: string
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
      kyc_status: "not_started" | "pending" | "approved" | "rejected"
      payment_request_status: "PENDING" | "PAID" | "DECLINED" | "EXPIRED"
      support_sender_role: "user" | "admin"
      ticket_status: "open" | "in_progress" | "resolved" | "closed"
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
      kyc_status: ["not_started", "pending", "approved", "rejected"],
      payment_request_status: ["PENDING", "PAID", "DECLINED", "EXPIRED"],
      support_sender_role: ["user", "admin"],
      ticket_status: ["open", "in_progress", "resolved", "closed"],
      transaction_kind: ["DEPOSIT", "CONVERT", "WITHDRAW", "SEND", "RECEIVE"],
      wallet_type: ["CRYPTO", "NGN"],
      withdrawal_status: ["PROCESSING", "SUCCESS", "FAILED"],
    },
  },
} as const
