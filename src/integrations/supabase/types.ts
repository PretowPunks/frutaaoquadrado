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
      customers: {
        Row: {
          address: string | null
          address_number: string | null
          city: string | null
          created_at: string
          document_number: string | null
          id: string
          name: string
          neighborhood: string | null
          owner_id: string | null
          phone: string | null
          street: string | null
        }
        Insert: {
          address?: string | null
          address_number?: string | null
          city?: string | null
          created_at?: string
          document_number?: string | null
          id?: string
          name: string
          neighborhood?: string | null
          owner_id?: string | null
          phone?: string | null
          street?: string | null
        }
        Update: {
          address?: string | null
          address_number?: string | null
          city?: string | null
          created_at?: string
          document_number?: string | null
          id?: string
          name?: string
          neighborhood?: string | null
          owner_id?: string | null
          phone?: string | null
          street?: string | null
        }
        Relationships: []
      }
      data_backups: {
        Row: {
          created_at: string
          id: string
          payload: Json
          row_counts: Json
        }
        Insert: {
          created_at?: string
          id?: string
          payload: Json
          row_counts: Json
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          row_counts?: Json
        }
        Relationships: []
      }
      privacy_consents: {
        Row: {
          accepted_at: string
          created_at: string
          id: string
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          id?: string
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Update: {
          accepted_at?: string
          created_at?: string
          id?: string
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          cost_price: number
          created_at: string
          id: string
          low_stock_threshold: number
          name: string
          owner_id: string | null
          sale_price: number
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          cost_price?: number
          created_at?: string
          id?: string
          low_stock_threshold?: number
          name: string
          owner_id?: string | null
          sale_price?: number
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          cost_price?: number
          created_at?: string
          id?: string
          low_stock_threshold?: number
          name?: string
          owner_id?: string | null
          sale_price?: number
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      rep_invites: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          cities: string[]
          created_at: string
          email: string
          id: string
          invited_by: string | null
          name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          cities?: string[]
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          cities?: string[]
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      representative_profit_payments: {
        Row: {
          cost_total: number
          created_at: string
          created_by: string
          gross_sale: number
          id: string
          note: string | null
          paid_at: string
          profit_amount: number
          rep_user_id: string
          sale_id: string
        }
        Insert: {
          cost_total: number
          created_at?: string
          created_by: string
          gross_sale: number
          id?: string
          note?: string | null
          paid_at?: string
          profit_amount: number
          rep_user_id: string
          sale_id: string
        }
        Update: {
          cost_total?: number
          created_at?: string
          created_by?: string
          gross_sale?: number
          id?: string
          note?: string | null
          paid_at?: string
          profit_amount?: number
          rep_user_id?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "representative_profit_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: true
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          boleto_due_date: string | null
          boleto_paid_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          delivery_date: string | null
          id: string
          order_id: string | null
          order_status: string | null
          order_total: number | null
          owner_id: string | null
          payment_method: string
          payment_status: string | null
          product_id: string
          quantity: number
          repassed_quantity: number
          seller_name: string | null
          seller_type: string | null
          status: Database["public"]["Enums"]["sale_status"]
          supplier_payment_id: string | null
          unit_cost: number
          unit_sale_price: number
        }
        Insert: {
          boleto_due_date?: string | null
          boleto_paid_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivery_date?: string | null
          id?: string
          order_id?: string | null
          order_status?: string | null
          order_total?: number | null
          owner_id?: string | null
          payment_method?: string
          payment_status?: string | null
          product_id: string
          quantity: number
          repassed_quantity?: number
          seller_name?: string | null
          seller_type?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          supplier_payment_id?: string | null
          unit_cost: number
          unit_sale_price: number
        }
        Update: {
          boleto_due_date?: string | null
          boleto_paid_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivery_date?: string | null
          id?: string
          order_id?: string | null
          order_status?: string | null
          order_total?: number | null
          owner_id?: string | null
          payment_method?: string
          payment_status?: string | null
          product_id?: string
          quantity?: number
          repassed_quantity?: number
          seller_name?: string | null
          seller_type?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          supplier_payment_id?: string | null
          unit_cost?: number
          unit_sale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_supplier_payment_id_fkey"
            columns: ["supplier_payment_id"]
            isOneToOne: false
            referencedRelation: "supplier_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_route_points: {
        Row: {
          accuracy: number | null
          created_at: string
          id: string
          lat: number
          lng: number
          recorded_at: string
          shift_id: string
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          id?: string
          lat: number
          lng: number
          recorded_at?: string
          shift_id: string
          user_id?: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string
          shift_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_route_points_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "work_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_entries: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          owner_id: string | null
          product_id: string
          quantity: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          owner_id?: string | null
          product_id: string
          quantity: number
          unit_cost: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          owner_id?: string | null
          product_id?: string
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          product_name: string
          quantity: number
          source_product_id: string
          to_user_id: string
          unit_cost: number
          unit_sale_price: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_name: string
          quantity: number
          source_product_id: string
          to_user_id: string
          unit_cost?: number
          unit_sale_price?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_name?: string
          quantity?: number
          source_product_id?: string
          to_user_id?: string
          unit_cost?: number
          unit_sale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_source_product_id_fkey"
            columns: ["source_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payment_items: {
        Row: {
          created_at: string
          id: string
          payment_id: string
          product_id: string | null
          product_name: string
          quantity: number
          total_cost: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          payment_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          total_cost: number
          unit_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          payment_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          total_cost?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payment_items_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "supplier_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          owner_id: string | null
          paid_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          owner_id?: string | null
          paid_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          owner_id?: string | null
          paid_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_shifts: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          note: string | null
          start_city: string | null
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          note?: string | null
          start_city?: string | null
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          note?: string | null
          start_city?: string | null
          started_at?: string
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
      clone_catalog_for: { Args: { _user_id: string }; Returns: number }
      create_data_backup: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      sale_commits_stock: {
        Args: {
          _order_status: string
          _status: Database["public"]["Enums"]["sale_status"]
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      sale_status: "paid" | "unpaid" | "scheduled"
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
      app_role: ["admin", "user"],
      sale_status: ["paid", "unpaid", "scheduled"],
    },
  },
} as const
