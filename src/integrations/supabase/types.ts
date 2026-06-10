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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_reason: string | null
          display_name: string | null
          display_name_ar: string | null
          id: string
          legal_name: string | null
          location_id: string | null
          metadata: Json
          notes: string | null
          poc_contact_id: string | null
          status: string
          tax_number: string | null
          updated_at: string
          updated_by: string | null
          website: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_reason?: string | null
          display_name?: string | null
          display_name_ar?: string | null
          id?: string
          legal_name?: string | null
          location_id?: string | null
          metadata?: Json
          notes?: string | null
          poc_contact_id?: string | null
          status?: string
          tax_number?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_reason?: string | null
          display_name?: string | null
          display_name_ar?: string | null
          id?: string
          legal_name?: string | null
          location_id?: string | null
          metadata?: Json
          notes?: string | null
          poc_contact_id?: string | null
          status?: string
          tax_number?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_poc_contact_id_fkey"
            columns: ["poc_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_poc_contact_id_fkey"
            columns: ["poc_contact_id"]
            isOneToOne: false
            referencedRelation: "customer_list_v1"
            referencedColumns: ["primary_contact_id"]
          },
        ]
      }
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
          request_id: string | null
          summary: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          summary?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          summary?: string | null
        }
        Relationships: []
      }
      addon_definitions: {
        Row: {
          created_at: string
          created_by: string | null
          default_margin_pct: number | null
          default_price: number | null
          default_uom: string
          id: string
          material_id: string | null
          name: string
          name_ar: string | null
          notes: string | null
          scope: string
          status: string
          subcategory_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_margin_pct?: number | null
          default_price?: number | null
          default_uom?: string
          id?: string
          material_id?: string | null
          name: string
          name_ar?: string | null
          notes?: string | null
          scope?: string
          status?: string
          subcategory_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_margin_pct?: number | null
          default_price?: number | null
          default_uom?: string
          id?: string
          material_id?: string | null
          name?: string
          name_ar?: string | null
          notes?: string | null
          scope?: string
          status?: string
          subcategory_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      agent_actions: {
        Row: {
          example_phrases_ar: string[]
          example_phrases_en: string[]
          intent_key: string
          is_visible: boolean
          keywords: string[]
          main_fields: Json
          menu_order: number
          status: string
          tables: string[]
          title_ar: string
          title_en: string
          tool_name: string | null
          updated_at: string
        }
        Insert: {
          example_phrases_ar?: string[]
          example_phrases_en?: string[]
          intent_key: string
          is_visible?: boolean
          keywords?: string[]
          main_fields?: Json
          menu_order?: number
          status?: string
          tables?: string[]
          title_ar: string
          title_en: string
          tool_name?: string | null
          updated_at?: string
        }
        Update: {
          example_phrases_ar?: string[]
          example_phrases_en?: string[]
          intent_key?: string
          is_visible?: boolean
          keywords?: string[]
          main_fields?: Json
          menu_order?: number
          status?: string
          tables?: string[]
          title_ar?: string
          title_en?: string
          tool_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agent_confirmations: {
        Row: {
          actor_user_id: string
          committed_at: string | null
          created_at: string
          error: string | null
          expires_at: string
          payload: Json
          result: Json | null
          status: string
          token: string
          tool: string
        }
        Insert: {
          actor_user_id: string
          committed_at?: string | null
          created_at?: string
          error?: string | null
          expires_at?: string
          payload?: Json
          result?: Json | null
          status?: string
          token?: string
          tool: string
        }
        Update: {
          actor_user_id?: string
          committed_at?: string | null
          created_at?: string
          error?: string | null
          expires_at?: string
          payload?: Json
          result?: Json | null
          status?: string
          token?: string
          tool?: string
        }
        Relationships: []
      }
      agent_logs: {
        Row: {
          actor_phone: string
          actor_user_id: string | null
          channel: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
          session_id: string | null
          wa_message_id: string | null
          wa_type: string | null
        }
        Insert: {
          actor_phone: string
          actor_user_id?: string | null
          channel?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          session_id?: string | null
          wa_message_id?: string | null
          wa_type?: string | null
        }
        Update: {
          actor_phone?: string
          actor_user_id?: string | null
          channel?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          session_id?: string | null
          wa_message_id?: string | null
          wa_type?: string | null
        }
        Relationships: []
      }
      agent_sessions: {
        Row: {
          created_at: string | null
          display_name: string | null
          extra: Json | null
          has_greeted: boolean | null
          id: string
          intent: string | null
          kind: string | null
          phone: string
          poc_name: string | null
          poc_phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          extra?: Json | null
          has_greeted?: boolean | null
          id?: string
          intent?: string | null
          kind?: string | null
          phone: string
          poc_name?: string | null
          poc_phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          extra?: Json | null
          has_greeted?: boolean | null
          id?: string
          intent?: string | null
          kind?: string | null
          phone?: string
          poc_name?: string | null
          poc_phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      agent_table_schema: {
        Row: {
          columns_doc: Json
          description_ar: string
          description_en: string
          module: string
          read_hints: Json
          relationships: Json
          table_name: string
          updated_at: string
        }
        Insert: {
          columns_doc?: Json
          description_ar?: string
          description_en?: string
          module?: string
          read_hints?: Json
          relationships?: Json
          table_name: string
          updated_at?: string
        }
        Update: {
          columns_doc?: Json
          description_ar?: string
          description_en?: string
          module?: string
          read_hints?: Json
          relationships?: Json
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          bucket: string | null
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          file_name: string | null
          id: string
          mime_type: string | null
          notes: string | null
          size_bytes: number | null
          storage_path: string | null
        }
        Insert: {
          bucket?: string | null
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          file_name?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          size_bytes?: number | null
          storage_path?: string | null
        }
        Update: {
          bucket?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          file_name?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          size_bytes?: number | null
          storage_path?: string | null
        }
        Relationships: []
      }
      category_aliases: {
        Row: {
          alias: string
          category_id: string
          created_at: string
          created_by: string | null
          id: string
          locale: string
          notes: string | null
        }
        Insert: {
          alias: string
          category_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          locale: string
          notes?: string | null
        }
        Update: {
          alias?: string
          category_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          locale?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_aliases_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "material_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_action_items: {
        Row: {
          assigned_to: string | null
          communication_id: string
          created_at: string
          details: string | null
          due_at: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          communication_id: string
          created_at?: string
          details?: string | null
          due_at?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          communication_id?: string
          created_at?: string
          details?: string | null
          due_at?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_action_items_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "communications"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          account_id: string | null
          channel: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_reason: string | null
          direction: string | null
          id: string
          metadata: Json | null
          occurred_at: string
          opportunity_id: string | null
          outcome: string | null
          project_id: string | null
          raw_notes: string | null
          sentiment: string | null
          subject: string | null
          summary: string | null
          updated_at: string
          updated_by: string | null
          whatsapp_conversation_id: string | null
        }
        Insert: {
          account_id?: string | null
          channel: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_reason?: string | null
          direction?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          opportunity_id?: string | null
          outcome?: string | null
          project_id?: string | null
          raw_notes?: string | null
          sentiment?: string | null
          subject?: string | null
          summary?: string | null
          updated_at?: string
          updated_by?: string | null
          whatsapp_conversation_id?: string | null
        }
        Update: {
          account_id?: string | null
          channel?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_reason?: string | null
          direction?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          opportunity_id?: string | null
          outcome?: string | null
          project_id?: string | null
          raw_notes?: string | null
          sentiment?: string | null
          subject?: string | null
          summary?: string | null
          updated_at?: string
          updated_by?: string | null
          whatsapp_conversation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "customer_list_v1"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "communications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "customer_list_v1"
            referencedColumns: ["primary_contact_id"]
          },
          {
            foreignKeyName: "communications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_whatsapp_conversation_id_fkey"
            columns: ["whatsapp_conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          email: string | null
          full_name: string
          full_name_ar: string | null
          id: string
          is_primary: boolean
          metadata: Json
          notes: string | null
          phone: string | null
          prefers_whatsapp: boolean
          role_title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          email?: string | null
          full_name: string
          full_name_ar?: string | null
          id?: string
          is_primary?: boolean
          metadata?: Json
          notes?: string | null
          phone?: string | null
          prefers_whatsapp?: boolean
          role_title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          email?: string | null
          full_name?: string
          full_name_ar?: string | null
          id?: string
          is_primary?: boolean
          metadata?: Json
          notes?: string | null
          phone?: string | null
          prefers_whatsapp?: boolean
          role_title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "customer_list_v1"
            referencedColumns: ["account_id"]
          },
        ]
      }
      customers: {
        Row: {
          account_id: string
          assigned_to: string | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          customer_type: string
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          lifecycle_stage: string
          metadata: Json
          notes: string | null
          payment_terms_days: number | null
          pricing_tier: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          customer_type?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          lifecycle_stage?: string
          metadata?: Json
          notes?: string | null
          payment_terms_days?: number | null
          pricing_tier?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          customer_type?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          lifecycle_stage?: string
          metadata?: Json
          notes?: string | null
          payment_terms_days?: number | null
          pricing_tier?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "customer_list_v1"
            referencedColumns: ["account_id"]
          },
        ]
      }
      delivery_rates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          notes: string | null
          price_per_moq: number
          supplier_account_id: string
          supplier_material_ids: string[]
          updated_at: string
          updated_by: string | null
          zone_codes: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          notes?: string | null
          price_per_moq: number
          supplier_account_id: string
          supplier_material_ids?: string[]
          updated_at?: string
          updated_by?: string | null
          zone_codes?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          notes?: string | null
          price_per_moq?: number
          supplier_account_id?: string
          supplier_material_ids?: string[]
          updated_at?: string
          updated_by?: string | null
          zone_codes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "delivery_rates_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["account_id"]
          },
        ]
      }
      drivers: {
        Row: {
          created_at: string
          created_by: string | null
          full_name: string
          id: string
          is_internal: boolean
          notes: string | null
          phone: string | null
          plate_number: string | null
          status: string
          updated_at: string
          updated_by: string | null
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          full_name: string
          id?: string
          is_internal?: boolean
          notes?: string | null
          phone?: string | null
          plate_number?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          full_name?: string
          id?: string
          is_internal?: boolean
          notes?: string | null
          phone?: string | null
          plate_number?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_type?: string | null
        }
        Relationships: []
      }
      geo_edges: {
        Row: {
          created_at: string | null
          created_by: string | null
          end_vertex_id: string
          id: string
          start_vertex_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          end_vertex_id: string
          id?: string
          start_vertex_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          end_vertex_id?: string
          id?: string
          start_vertex_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "geo_edges_end_vertex_id_fkey"
            columns: ["end_vertex_id"]
            isOneToOne: false
            referencedRelation: "geo_vertices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_edges_start_vertex_id_fkey"
            columns: ["start_vertex_id"]
            isOneToOne: false
            referencedRelation: "geo_vertices"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_vertices: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          lat: number
          lng: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          lat: number
          lng: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          lat?: number
          lng?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_account_id: string
          due_at: string | null
          id: string
          invoice_number: string | null
          issued_at: string | null
          notes: string | null
          order_id: string | null
          quotation_id: string | null
          status: string
          subtotal: number | null
          tax_total: number | null
          total: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_account_id: string
          due_at?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          notes?: string | null
          order_id?: string | null
          quotation_id?: string | null
          status?: string
          subtotal?: number | null
          tax_total?: number | null
          total?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_account_id?: string
          due_at?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          notes?: string | null
          order_id?: string | null
          quotation_id?: string | null
          status?: string
          subtotal?: number | null
          tax_total?: number | null
          total?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customer_list_v1"
            referencedColumns: ["customer_account_id"]
          },
          {
            foreignKeyName: "invoices_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_targets: {
        Row: {
          period_key: string
          targets: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          period_key: string
          targets?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          period_key?: string
          targets?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      locations: {
        Row: {
          address_link: string | null
          address_text: string | null
          city: Database["public"]["Enums"]["saudi_city"] | null
          country: Database["public"]["Enums"]["gcc_country"]
          created_at: string
          created_by: string | null
          id: string
          lat: number | null
          lng: number | null
          metadata: Json | null
          place_id: string | null
          place_name: string | null
          raw: Json | null
          region_code: string
          updated_at: string
          updated_by: string | null
          zone_code: string | null
        }
        Insert: {
          address_link?: string | null
          address_text?: string | null
          city?: Database["public"]["Enums"]["saudi_city"] | null
          country?: Database["public"]["Enums"]["gcc_country"]
          created_at?: string
          created_by?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          metadata?: Json | null
          place_id?: string | null
          place_name?: string | null
          raw?: Json | null
          region_code: string
          updated_at?: string
          updated_by?: string | null
          zone_code?: string | null
        }
        Update: {
          address_link?: string | null
          address_text?: string | null
          city?: Database["public"]["Enums"]["saudi_city"] | null
          country?: Database["public"]["Enums"]["gcc_country"]
          created_at?: string
          created_by?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          metadata?: Json | null
          place_id?: string | null
          place_name?: string | null
          raw?: Json | null
          region_code?: string
          updated_at?: string
          updated_by?: string | null
          zone_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_region_code_fkey"
            columns: ["region_code"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "locations_zone_code_fkey"
            columns: ["zone_code"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["code"]
          },
        ]
      }
      material_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          locale: string
          material_id: string
          notes: string | null
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          locale: string
          material_id: string
          notes?: string | null
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          locale?: string
          material_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_aliases_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      material_categories: {
        Row: {
          code2: string
          created_at: string
          created_by: string | null
          default_delivery_time_days: number | null
          default_lead_time_days: number | null
          default_moq: number | null
          default_order_cutoff_local: string | null
          default_order_window_days: number | null
          default_uom: string | null
          description_ar: string | null
          description_en: string | null
          id: string
          name_ar: string | null
          name_en: string
          specs: Json | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code2: string
          created_at?: string
          created_by?: string | null
          default_delivery_time_days?: number | null
          default_lead_time_days?: number | null
          default_moq?: number | null
          default_order_cutoff_local?: string | null
          default_order_window_days?: number | null
          default_uom?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          name_ar?: string | null
          name_en: string
          specs?: Json | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code2?: string
          created_at?: string
          created_by?: string | null
          default_delivery_time_days?: number | null
          default_lead_time_days?: number | null
          default_moq?: number | null
          default_order_cutoff_local?: string | null
          default_order_window_days?: number | null
          default_uom?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          name_ar?: string | null
          name_en?: string
          specs?: Json | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      material_search_index: {
        Row: {
          bag: string
          category_id: string | null
          code: string | null
          display_ar: string | null
          display_en: string | null
          material_id: string
          subcategory_id: string | null
          tsv: unknown
          updated_at: string
        }
        Insert: {
          bag?: string
          category_id?: string | null
          code?: string | null
          display_ar?: string | null
          display_en?: string | null
          material_id: string
          subcategory_id?: string | null
          tsv?: unknown
          updated_at?: string
        }
        Update: {
          bag?: string
          category_id?: string | null
          code?: string | null
          display_ar?: string | null
          display_en?: string | null
          material_id?: string
          subcategory_id?: string | null
          tsv?: unknown
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_search_index_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      material_subcategories: {
        Row: {
          category_id: string
          created_at: string
          created_by: string | null
          default_delivery_time_days: number | null
          default_lead_time_days: number | null
          default_moq: number | null
          default_order_cutoff_local: string | null
          default_order_window_days: number | null
          default_uom: string | null
          description_ar: string | null
          description_en: string | null
          domain_axis: string | null
          id: string
          name_ar: string | null
          name_en: string
          spec_definitions: Json | null
          specs: Json | null
          status: string
          subcategory_no: number
          updated_at: string
          updated_by: string | null
          variant_definitions: Json | null
        }
        Insert: {
          category_id: string
          created_at?: string
          created_by?: string | null
          default_delivery_time_days?: number | null
          default_lead_time_days?: number | null
          default_moq?: number | null
          default_order_cutoff_local?: string | null
          default_order_window_days?: number | null
          default_uom?: string | null
          description_ar?: string | null
          description_en?: string | null
          domain_axis?: string | null
          id?: string
          name_ar?: string | null
          name_en: string
          spec_definitions?: Json | null
          specs?: Json | null
          status?: string
          subcategory_no: number
          updated_at?: string
          updated_by?: string | null
          variant_definitions?: Json | null
        }
        Update: {
          category_id?: string
          created_at?: string
          created_by?: string | null
          default_delivery_time_days?: number | null
          default_lead_time_days?: number | null
          default_moq?: number | null
          default_order_cutoff_local?: string | null
          default_order_window_days?: number | null
          default_uom?: string | null
          description_ar?: string | null
          description_en?: string | null
          domain_axis?: string | null
          id?: string
          name_ar?: string | null
          name_en?: string
          spec_definitions?: Json | null
          specs?: Json | null
          status?: string
          subcategory_no?: number
          updated_at?: string
          updated_by?: string | null
          variant_definitions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "material_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "material_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          category: string | null
          code: string | null
          created_at: string
          created_by: string | null
          default_delivery_time_days: number | null
          default_lead_time_days: number | null
          default_moq: number | null
          default_order_cutoff_local: string | null
          default_order_window_days: number | null
          description_ar: string | null
          description_en: string | null
          id: string
          image_url: string | null
          is_core: boolean
          market_price_max_sar: number | null
          market_price_min_sar: number | null
          material_no: number | null
          name: string
          name_ar: string | null
          name_en: string | null
          notes: string | null
          specs: Json | null
          status: string
          subcategory_id: string | null
          uom: string | null
          updated_at: string
          updated_by: string | null
          variant_no: number
        }
        Insert: {
          category?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          default_delivery_time_days?: number | null
          default_lead_time_days?: number | null
          default_moq?: number | null
          default_order_cutoff_local?: string | null
          default_order_window_days?: number | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          image_url?: string | null
          is_core?: boolean
          market_price_max_sar?: number | null
          market_price_min_sar?: number | null
          material_no?: number | null
          name: string
          name_ar?: string | null
          name_en?: string | null
          notes?: string | null
          specs?: Json | null
          status?: string
          subcategory_id?: string | null
          uom?: string | null
          updated_at?: string
          updated_by?: string | null
          variant_no?: number
        }
        Update: {
          category?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          default_delivery_time_days?: number | null
          default_lead_time_days?: number | null
          default_moq?: number | null
          default_order_cutoff_local?: string | null
          default_order_window_days?: number | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          image_url?: string | null
          is_core?: boolean
          market_price_max_sar?: number | null
          market_price_min_sar?: number | null
          material_no?: number | null
          name?: string
          name_ar?: string | null
          name_en?: string | null
          notes?: string | null
          specs?: Json | null
          status?: string
          subcategory_id?: string | null
          uom?: string | null
          updated_at?: string
          updated_by?: string | null
          variant_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "materials_subcategory_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "material_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          category: string
          components: Json
          created_at: string
          created_by: string | null
          id: string
          language: string
          name: string
          rejection_reason: string | null
          status: string
          template_id: string | null
          updated_at: string
          waba_id: string
        }
        Insert: {
          category: string
          components?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          language: string
          name: string
          rejection_reason?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          waba_id: string
        }
        Update: {
          category?: string
          components?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          name?: string
          rejection_reason?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          waba_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_waba_id_fkey"
            columns: ["waba_id"]
            isOneToOne: false
            referencedRelation: "waba_accounts"
            referencedColumns: ["waba_id"]
          },
          {
            foreignKeyName: "message_templates_waba_id_fkey"
            columns: ["waba_id"]
            isOneToOne: false
            referencedRelation: "waba_accounts_safe"
            referencedColumns: ["waba_id"]
          },
        ]
      }
      opportunities: {
        Row: {
          assigned_to: string | null
          code: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          customer_account_id: string
          deleted_at: string | null
          deleted_reason: string | null
          description: string | null
          expected_close_date: string | null
          id: string
          interest_level: string | null
          lost_at: string | null
          lost_reason: string | null
          materials_interest: Json
          metadata: Json
          notes: string | null
          priority: string
          project_id: string
          source: string | null
          stage: string
          status: string
          title: string
          updated_at: string
          updated_by: string | null
          won_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          code?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_account_id: string
          deleted_at?: string | null
          deleted_reason?: string | null
          description?: string | null
          expected_close_date?: string | null
          id?: string
          interest_level?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          materials_interest?: Json
          metadata?: Json
          notes?: string | null
          priority?: string
          project_id: string
          source?: string | null
          stage?: string
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
          won_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          code?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_account_id?: string
          deleted_at?: string | null
          deleted_reason?: string | null
          description?: string | null
          expected_close_date?: string | null
          id?: string
          interest_level?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          materials_interest?: Json
          metadata?: Json
          notes?: string | null
          priority?: string
          project_id?: string
          source?: string | null
          stage?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "customer_list_v1"
            referencedColumns: ["primary_contact_id"]
          },
          {
            foreignKeyName: "opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customer_list_v1"
            referencedColumns: ["customer_account_id"]
          },
          {
            foreignKeyName: "opportunities_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "opportunities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          addon_definition_id: string | null
          created_at: string
          created_by: string | null
          custom_description: string | null
          custom_name: string | null
          delivery_price: number | null
          domain_id: string | null
          id: string
          is_custom_item: boolean
          item_kind: string
          line_total: number | null
          material_id: string | null
          notes: string | null
          order_id: string
          parent_line_id: string | null
          quantity: number
          source_quote_id: string | null
          supplier_account_id: string | null
          supply_unit_id: string | null
          unit_price: number | null
          uom: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          addon_definition_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_description?: string | null
          custom_name?: string | null
          delivery_price?: number | null
          domain_id?: string | null
          id?: string
          is_custom_item?: boolean
          item_kind?: string
          line_total?: number | null
          material_id?: string | null
          notes?: string | null
          order_id: string
          parent_line_id?: string | null
          quantity?: number
          source_quote_id?: string | null
          supplier_account_id?: string | null
          supply_unit_id?: string | null
          unit_price?: number | null
          uom?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          addon_definition_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_description?: string | null
          custom_name?: string | null
          delivery_price?: number | null
          domain_id?: string | null
          id?: string
          is_custom_item?: boolean
          item_kind?: string
          line_total?: number | null
          material_id?: string | null
          notes?: string | null
          order_id?: string
          parent_line_id?: string | null
          quantity?: number
          source_quote_id?: string | null
          supplier_account_id?: string | null
          supply_unit_id?: string | null
          unit_price?: number | null
          uom?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["account_id"]
          },
        ]
      }
      orders: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_account_id: string
          delivery_total: number | null
          id: string
          notes: string | null
          project_id: string | null
          quotation_id: string | null
          status: string
          subtotal: number | null
          total: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_account_id: string
          delivery_total?: number | null
          id?: string
          notes?: string | null
          project_id?: string | null
          quotation_id?: string | null
          status?: string
          subtotal?: number | null
          total?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_account_id?: string
          delivery_total?: number | null
          id?: string
          notes?: string | null
          project_id?: string | null
          quotation_id?: string | null
          status?: string
          subtotal?: number | null
          total?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customer_list_v1"
            referencedColumns: ["customer_account_id"]
          },
          {
            foreignKeyName: "orders_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          invoice_id: string
          method: string
          notes: string | null
          paid_at: string
          reference: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          invoice_id: string
          method?: string
          notes?: string | null
          paid_at?: string
          reference?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          invoice_id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          reference?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_templates: {
        Row: {
          id: string
          name: string
          settings: Json
          template_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          name: string
          settings?: Json
          template_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          settings?: Json
          template_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pricing_settings: {
        Row: {
          default_margin_pct: number | null
          id: boolean
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          default_margin_pct?: number | null
          id?: boolean
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          default_margin_pct?: number | null
          id?: boolean
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          department: string | null
          full_name: string | null
          id: string
          phone: string | null
          sandbox_enabled: boolean
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          department?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          sandbox_enabled?: boolean
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          department?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          sandbox_enabled?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          current_phase: string | null
          customer_account_id: string
          deleted_at: string | null
          deleted_reason: string | null
          id: string
          location_id: string | null
          metadata: Json
          name: string
          name_ar: string | null
          notes: string | null
          poc: string | null
          project_size: string | null
          project_type: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          current_phase?: string | null
          customer_account_id: string
          deleted_at?: string | null
          deleted_reason?: string | null
          id?: string
          location_id?: string | null
          metadata?: Json
          name: string
          name_ar?: string | null
          notes?: string | null
          poc?: string | null
          project_size?: string | null
          project_type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          current_phase?: string | null
          customer_account_id?: string
          deleted_at?: string | null
          deleted_reason?: string | null
          id?: string
          location_id?: string | null
          metadata?: Json
          name?: string
          name_ar?: string | null
          notes?: string | null
          poc?: string | null
          project_size?: string | null
          project_type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customer_list_v1"
            referencedColumns: ["customer_account_id"]
          },
          {
            foreignKeyName: "projects_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "projects_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_poc_fkey"
            columns: ["poc"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_poc_fkey"
            columns: ["poc"]
            isOneToOne: false
            referencedRelation: "customer_list_v1"
            referencedColumns: ["primary_contact_id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          addon_definition_id: string | null
          created_at: string
          created_by: string | null
          custom_description: string | null
          custom_name: string | null
          delivery_price: number | null
          effective_margin_pct: number | null
          id: string
          is_custom_item: boolean
          item_kind: string
          line_total: number | null
          material_id: string | null
          metadata: Json
          moq: number | null
          notes: string | null
          parent_line_id: string | null
          position: number
          pricing_trace: Json
          quantity: number | null
          quotation_id: string
          removed_at: string | null
          status: string
          supplier_account_id: string | null
          supplier_material_id: string | null
          unit_price: number | null
          uom: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          addon_definition_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_description?: string | null
          custom_name?: string | null
          delivery_price?: number | null
          effective_margin_pct?: number | null
          id?: string
          is_custom_item?: boolean
          item_kind?: string
          line_total?: number | null
          material_id?: string | null
          metadata?: Json
          moq?: number | null
          notes?: string | null
          parent_line_id?: string | null
          position?: number
          pricing_trace?: Json
          quantity?: number | null
          quotation_id: string
          removed_at?: string | null
          status?: string
          supplier_account_id?: string | null
          supplier_material_id?: string | null
          unit_price?: number | null
          uom?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          addon_definition_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_description?: string | null
          custom_name?: string | null
          delivery_price?: number | null
          effective_margin_pct?: number | null
          id?: string
          is_custom_item?: boolean
          item_kind?: string
          line_total?: number | null
          material_id?: string | null
          metadata?: Json
          moq?: number | null
          notes?: string | null
          parent_line_id?: string | null
          position?: number
          pricing_trace?: Json
          quantity?: number | null
          quotation_id?: string
          removed_at?: string | null
          status?: string
          supplier_account_id?: string | null
          supplier_material_id?: string | null
          unit_price?: number | null
          uom?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "quotation_items_supplier_material_id_fkey"
            columns: ["supplier_material_id"]
            isOneToOne: false
            referencedRelation: "supplier_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          accepted_at: string | null
          code: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_account_id: string
          delivery_mode: string
          delivery_total: number | null
          est_delivery_date: string | null
          id: string
          is_soft: boolean
          metadata: Json
          notes: string | null
          opportunity_id: string | null
          order_id: string | null
          pricing_locked_at: string | null
          project_id: string | null
          quote_type: string
          sent_at: string | null
          status: string
          subtotal: number | null
          supplier_role: string
          total: number | null
          updated_at: string
          updated_by: string | null
          valid_until: string | null
          version: number
        }
        Insert: {
          accepted_at?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_account_id: string
          delivery_mode?: string
          delivery_total?: number | null
          est_delivery_date?: string | null
          id?: string
          is_soft?: boolean
          metadata?: Json
          notes?: string | null
          opportunity_id?: string | null
          order_id?: string | null
          pricing_locked_at?: string | null
          project_id?: string | null
          quote_type?: string
          sent_at?: string | null
          status?: string
          subtotal?: number | null
          supplier_role?: string
          total?: number | null
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
          version?: number
        }
        Update: {
          accepted_at?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_account_id?: string
          delivery_mode?: string
          delivery_total?: number | null
          est_delivery_date?: string | null
          id?: string
          is_soft?: boolean
          metadata?: Json
          notes?: string | null
          opportunity_id?: string | null
          order_id?: string | null
          pricing_locked_at?: string | null
          project_id?: string | null
          quote_type?: string
          sent_at?: string | null
          status?: string
          subtotal?: number | null
          supplier_role?: string
          total?: number | null
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotations_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customer_list_v1"
            referencedColumns: ["customer_account_id"]
          },
          {
            foreignKeyName: "quotations_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "quotations_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      region_edges: {
        Row: {
          created_at: string | null
          edge_id: string
          id: string
          is_reversed: boolean | null
          position: number
          region_code: string | null
        }
        Insert: {
          created_at?: string | null
          edge_id: string
          id?: string
          is_reversed?: boolean | null
          position: number
          region_code?: string | null
        }
        Update: {
          created_at?: string | null
          edge_id?: string
          id?: string
          is_reversed?: boolean | null
          position?: number
          region_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "region_edges_edge_id_fkey"
            columns: ["edge_id"]
            isOneToOne: false
            referencedRelation: "geo_edges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "region_edges_region_code_fkey"
            columns: ["region_code"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["code"]
          },
        ]
      }
      regions: {
        Row: {
          boundary_geojson: Json | null
          center_lat: number | null
          center_lng: number | null
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name_ar: string | null
          name_en: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          boundary_geojson?: Json | null
          center_lat?: number | null
          center_lng?: number | null
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name_ar?: string | null
          name_en: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          boundary_geojson?: Json | null
          center_lat?: number | null
          center_lng?: number | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name_ar?: string | null
          name_en?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      renegotiation_cases: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          original_quote_id: string
          priority: string
          replacement_quote_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          supplier_account_id: string
          trigger_ref_id: string | null
          trigger_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          original_quote_id: string
          priority?: string
          replacement_quote_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          supplier_account_id: string
          trigger_ref_id?: string | null
          trigger_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          original_quote_id?: string
          priority?: string
          replacement_quote_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          supplier_account_id?: string
          trigger_ref_id?: string | null
          trigger_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "renegotiation_cases_original_quote_id_fkey"
            columns: ["original_quote_id"]
            isOneToOne: false
            referencedRelation: "supplier_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renegotiation_cases_replacement_quote_id_fkey"
            columns: ["replacement_quote_id"]
            isOneToOne: false
            referencedRelation: "supplier_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renegotiation_cases_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["account_id"]
          },
        ]
      }
      sandbox_journal: {
        Row: {
          after: Json | null
          before: Json | null
          id: string
          occurred_at: string
          op: string
          row_pk: string
          session_id: string
          table_name: string
          user_id: string
        }
        Insert: {
          after?: Json | null
          before?: Json | null
          id?: string
          occurred_at?: string
          op: string
          row_pk: string
          session_id: string
          table_name: string
          user_id: string
        }
        Update: {
          after?: Json | null
          before?: Json | null
          id?: string
          occurred_at?: string
          op?: string
          row_pk?: string
          session_id?: string
          table_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sandbox_journal_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "user_sandbox_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      spec_option_aliases: {
        Row: {
          alias: string
          created_at: string
          created_by: string | null
          id: string
          locale: string
          notes: string | null
          option_value: string
          spec_key: string
          subcategory_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          created_by?: string | null
          id?: string
          locale: string
          notes?: string | null
          option_value: string
          spec_key: string
          subcategory_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          created_by?: string | null
          id?: string
          locale?: string
          notes?: string | null
          option_value?: string
          spec_key?: string
          subcategory_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spec_option_aliases_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "material_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategory_aliases: {
        Row: {
          alias: string
          created_at: string
          created_by: string | null
          id: string
          locale: string
          notes: string | null
          subcategory_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          created_by?: string | null
          id?: string
          locale: string
          notes?: string | null
          subcategory_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          created_by?: string | null
          id?: string
          locale?: string
          notes?: string | null
          subcategory_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategory_aliases_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "material_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategory_areas: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          name_ar: string | null
          sort_order: number
          subcategory_id: string
          updated_at: string
          updated_by: string | null
          zone_codes: string[]
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          name_ar?: string | null
          sort_order?: number
          subcategory_id: string
          updated_at?: string
          updated_by?: string | null
          zone_codes?: string[]
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          name_ar?: string | null
          sort_order?: number
          subcategory_id?: string
          updated_at?: string
          updated_by?: string | null
          zone_codes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "subcategory_areas_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "material_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategory_margin_defaults: {
        Row: {
          created_at: string
          default_margin_pct: number
          id: string
          notes: string | null
          subcategory_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          default_margin_pct?: number
          id?: string
          notes?: string | null
          subcategory_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          default_margin_pct?: number
          id?: string
          notes?: string | null
          subcategory_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcategory_margin_defaults_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: true
            referencedRelation: "material_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_actions: {
        Row: {
          action_type: string
          affected_material_id: string | null
          affected_zone_code: string | null
          created_at: string
          id: string
          issue_id: string | null
          performed_by: string | null
          reason: string | null
          supplier_account_id: string
          supply_unit_id: string | null
        }
        Insert: {
          action_type: string
          affected_material_id?: string | null
          affected_zone_code?: string | null
          created_at?: string
          id?: string
          issue_id?: string | null
          performed_by?: string | null
          reason?: string | null
          supplier_account_id: string
          supply_unit_id?: string | null
        }
        Update: {
          action_type?: string
          affected_material_id?: string | null
          affected_zone_code?: string | null
          created_at?: string
          id?: string
          issue_id?: string | null
          performed_by?: string | null
          reason?: string | null
          supplier_account_id?: string
          supply_unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_actions_affected_material_id_fkey"
            columns: ["affected_material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_actions_affected_zone_code_fkey"
            columns: ["affected_zone_code"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "supplier_actions_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "supplier_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_actions_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "supplier_actions_supply_unit_id_fkey"
            columns: ["supply_unit_id"]
            isOneToOne: false
            referencedRelation: "supply_units"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_followups: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          followup_type: string
          id: string
          next_followup_at: string | null
          outcome: string | null
          status: string
          summary: string | null
          supplier_account_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          followup_type?: string
          id?: string
          next_followup_at?: string | null
          outcome?: string | null
          status?: string
          summary?: string | null
          supplier_account_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          followup_type?: string
          id?: string
          next_followup_at?: string | null
          outcome?: string | null
          status?: string
          summary?: string | null
          supplier_account_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_followups_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_followups_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["account_id"]
          },
        ]
      }
      supplier_issues: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string
          final_outcome: string | null
          id: string
          issue_type: string
          material_id: string | null
          reported_by: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source: string
          status: string
          supplier_account_id: string
          supply_unit_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description: string
          final_outcome?: string | null
          id?: string
          issue_type: string
          material_id?: string | null
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source?: string
          status?: string
          supplier_account_id: string
          supply_unit_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string
          final_outcome?: string | null
          id?: string
          issue_type?: string
          material_id?: string | null
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source?: string
          status?: string
          supplier_account_id?: string
          supply_unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_issues_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_issues_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "supplier_issues_supply_unit_id_fkey"
            columns: ["supply_unit_id"]
            isOneToOne: false
            referencedRelation: "supply_units"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_materials: {
        Row: {
          created_at: string
          created_by: string | null
          delivery_price: number | null
          id: string
          is_current: boolean
          lead_time_days: number | null
          material_id: string
          metadata: Json
          moq: number | null
          notes: string | null
          price_valid_until: string | null
          quotation_file_id: string | null
          quote_version: number
          status: string
          supplier_account_id: string
          supplier_quote_id: string | null
          unit_price: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery_price?: number | null
          id?: string
          is_current?: boolean
          lead_time_days?: number | null
          material_id: string
          metadata?: Json
          moq?: number | null
          notes?: string | null
          price_valid_until?: string | null
          quotation_file_id?: string | null
          quote_version: number
          status?: string
          supplier_account_id: string
          supplier_quote_id?: string | null
          unit_price?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery_price?: number | null
          id?: string
          is_current?: boolean
          lead_time_days?: number | null
          material_id?: string
          metadata?: Json
          moq?: number | null
          notes?: string | null
          price_valid_until?: string | null
          quotation_file_id?: string | null
          quote_version?: number
          status?: string
          supplier_account_id?: string
          supplier_quote_id?: string | null
          unit_price?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_materials_quotation_file_id_fkey"
            columns: ["quotation_file_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_materials_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "supplier_materials_supplier_quote_id_fkey"
            columns: ["supplier_quote_id"]
            isOneToOne: false
            referencedRelation: "supplier_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_quote_delivery_allocations: {
        Row: {
          allocated_delivery_per_moq: number
          allocation_method: string
          allocation_share_pct: number
          created_at: string
          delivery_line_id: string
          id: string
          is_changed: boolean
          landed_price_per_unit: number
          moq: number
          prior_allocation_id: string | null
          raw_delivery_price_per_moq: number
          supplier_material_id: string
          supplier_quote_id: string
          unit_price: number
          zone_code: string
        }
        Insert: {
          allocated_delivery_per_moq: number
          allocation_method?: string
          allocation_share_pct: number
          created_at?: string
          delivery_line_id: string
          id?: string
          is_changed?: boolean
          landed_price_per_unit: number
          moq: number
          prior_allocation_id?: string | null
          raw_delivery_price_per_moq: number
          supplier_material_id: string
          supplier_quote_id: string
          unit_price: number
          zone_code: string
        }
        Update: {
          allocated_delivery_per_moq?: number
          allocation_method?: string
          allocation_share_pct?: number
          created_at?: string
          delivery_line_id?: string
          id?: string
          is_changed?: boolean
          landed_price_per_unit?: number
          moq?: number
          prior_allocation_id?: string | null
          raw_delivery_price_per_moq?: number
          supplier_material_id?: string
          supplier_quote_id?: string
          unit_price?: number
          zone_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quote_delivery_allocations_delivery_line_id_fkey"
            columns: ["delivery_line_id"]
            isOneToOne: false
            referencedRelation: "supplier_quote_delivery_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quote_delivery_allocations_prior_allocation_id_fkey"
            columns: ["prior_allocation_id"]
            isOneToOne: false
            referencedRelation: "supplier_quote_delivery_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quote_delivery_allocations_supplier_material_id_fkey"
            columns: ["supplier_material_id"]
            isOneToOne: false
            referencedRelation: "supplier_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quote_delivery_allocations_supplier_quote_id_fkey"
            columns: ["supplier_quote_id"]
            isOneToOne: false
            referencedRelation: "supplier_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quote_delivery_allocations_zone_code_fkey"
            columns: ["zone_code"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["code"]
          },
        ]
      }
      supplier_quote_delivery_lines: {
        Row: {
          created_at: string
          id: string
          material_ids: string[]
          notes: string | null
          price_per_moq: number
          supplier_quote_id: string
          zone_codes: string[]
        }
        Insert: {
          created_at?: string
          id?: string
          material_ids?: string[]
          notes?: string | null
          price_per_moq: number
          supplier_quote_id: string
          zone_codes?: string[]
        }
        Update: {
          created_at?: string
          id?: string
          material_ids?: string[]
          notes?: string | null
          price_per_moq?: number
          supplier_quote_id?: string
          zone_codes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quote_delivery_lines_supplier_quote_id_fkey"
            columns: ["supplier_quote_id"]
            isOneToOne: false
            referencedRelation: "supplier_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_quote_validity: {
        Row: {
          created_at: string
          id: string
          management_decided_at: string | null
          management_decided_by: string | null
          management_decision: string | null
          new_valid_until: string | null
          notes: string | null
          outreach_at: string | null
          outreach_method: string | null
          renegotiation_case_id: string | null
          status: string
          supplier_quote_id: string
          supplier_responded_at: string | null
          supplier_response: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          management_decided_at?: string | null
          management_decided_by?: string | null
          management_decision?: string | null
          new_valid_until?: string | null
          notes?: string | null
          outreach_at?: string | null
          outreach_method?: string | null
          renegotiation_case_id?: string | null
          status?: string
          supplier_quote_id: string
          supplier_responded_at?: string | null
          supplier_response?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          management_decided_at?: string | null
          management_decided_by?: string | null
          management_decision?: string | null
          new_valid_until?: string | null
          notes?: string | null
          outreach_at?: string | null
          outreach_method?: string | null
          renegotiation_case_id?: string | null
          status?: string
          supplier_quote_id?: string
          supplier_responded_at?: string | null
          supplier_response?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quote_validity_renegotiation_case_id_fkey"
            columns: ["renegotiation_case_id"]
            isOneToOne: false
            referencedRelation: "renegotiation_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quote_validity_supplier_quote_id_fkey"
            columns: ["supplier_quote_id"]
            isOneToOne: false
            referencedRelation: "supplier_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_quotes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          quotation_file_id: string | null
          source: string
          status: string
          submitted_at: string | null
          supplier_account_id: string
          updated_at: string
          updated_by: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          quotation_file_id?: string | null
          source?: string
          status?: string
          submitted_at?: string | null
          supplier_account_id: string
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          quotation_file_id?: string | null
          source?: string
          status?: string
          submitted_at?: string | null
          supplier_account_id?: string
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quotes_quotation_file_id_fkey"
            columns: ["quotation_file_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotes_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["account_id"]
          },
        ]
      }
      supplier_selections: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          domain_id: string
          id: string
          material_code: string | null
          reason: string | null
          role: Database["public"]["Enums"]["supplier_selection_role"]
          supplier_id: string
          zone_code: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          domain_id: string
          id?: string
          material_code?: string | null
          reason?: string | null
          role: Database["public"]["Enums"]["supplier_selection_role"]
          supplier_id: string
          zone_code?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          domain_id?: string
          id?: string
          material_code?: string | null
          reason?: string | null
          role?: Database["public"]["Enums"]["supplier_selection_role"]
          supplier_id?: string
          zone_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_selections_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "supply_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_selections_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_selections_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "customer_list_v1"
            referencedColumns: ["account_id"]
          },
        ]
      }
      suppliers: {
        Row: {
          account_id: string
          bank_name: string | null
          created_at: string
          created_by: string | null
          frozen_at: string | null
          frozen_reason: string | null
          iban: string | null
          is_blacklisted: boolean
          is_frozen: boolean
          lead_time_days: number | null
          notes: string | null
          quality_grade: string | null
          rating: number | null
          rating_notes: string | null
          supplier_code: string | null
          supplier_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          frozen_at?: string | null
          frozen_reason?: string | null
          iban?: string | null
          is_blacklisted?: boolean
          is_frozen?: boolean
          lead_time_days?: number | null
          notes?: string | null
          quality_grade?: string | null
          rating?: number | null
          rating_notes?: string | null
          supplier_code?: string | null
          supplier_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          frozen_at?: string | null
          frozen_reason?: string | null
          iban?: string | null
          is_blacklisted?: boolean
          is_frozen?: boolean
          lead_time_days?: number | null
          notes?: string | null
          quality_grade?: string | null
          rating?: number | null
          rating_notes?: string | null
          supplier_code?: string | null
          supplier_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "customer_list_v1"
            referencedColumns: ["account_id"]
          },
        ]
      }
      supply_cycle_domains: {
        Row: {
          created_at: string
          cycle_id: string
          domain_id: string
          id: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          domain_id: string
          id?: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          domain_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_cycle_domains_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "unlock_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_cycle_domains_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "supply_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_domain_directives: {
        Row: {
          created_at: string
          domain_id: string
          effective_from: string
          effective_until: string | null
          id: string
          is_active: boolean
          landed_price: number | null
          material_id: string | null
          notes: string | null
          role: string
          set_by_cycle_id: string | null
          supplier_account_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain_id: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean
          landed_price?: number | null
          material_id?: string | null
          notes?: string | null
          role: string
          set_by_cycle_id?: string | null
          supplier_account_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain_id?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean
          landed_price?: number | null
          material_id?: string | null
          notes?: string | null
          role?: string
          set_by_cycle_id?: string | null
          supplier_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_domain_directives_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "supply_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_domain_directives_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_domain_directives_set_by_cycle_id_fkey"
            columns: ["set_by_cycle_id"]
            isOneToOne: false
            referencedRelation: "unlock_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_domain_directives_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["account_id"]
          },
        ]
      }
      supply_domain_suppliers: {
        Row: {
          created_at: string
          domain_id: string
          id: string
          is_quality_pick: boolean
          landed_price: number | null
          notes: string | null
          role: string
          source_cycle_id: string | null
          supplier_account_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain_id: string
          id?: string
          is_quality_pick?: boolean
          landed_price?: number | null
          notes?: string | null
          role?: string
          source_cycle_id?: string | null
          supplier_account_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain_id?: string
          id?: string
          is_quality_pick?: boolean
          landed_price?: number | null
          notes?: string | null
          role?: string
          source_cycle_id?: string | null
          supplier_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_domain_suppliers_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "supply_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_domains: {
        Row: {
          area_id: string
          axis_value: string | null
          created_at: string
          created_by: string | null
          id: string
          label: string
          notes: string | null
          review_flagged_at: string | null
          review_flagged_by: string | null
          review_reason: string | null
          review_status: string | null
          status: string
          subcategory_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          area_id: string
          axis_value?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          notes?: string | null
          review_flagged_at?: string | null
          review_flagged_by?: string | null
          review_reason?: string | null
          review_status?: string | null
          status?: string
          subcategory_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          area_id?: string
          axis_value?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          notes?: string | null
          review_flagged_at?: string | null
          review_flagged_by?: string | null
          review_reason?: string | null
          review_status?: string | null
          status?: string
          subcategory_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supply_domains_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "subcategory_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_domains_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "material_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_unit_suppliers: {
        Row: {
          created_at: string
          created_by: string | null
          delivery_allocation_id: string | null
          frozen_at: string | null
          frozen_by: string | null
          frozen_reason: string | null
          id: string
          is_frozen: boolean
          is_quality_pick: boolean
          landed_price: number | null
          notes: string | null
          rank: number | null
          role: string
          supplier_account_id: string
          supplier_material_id: string | null
          supply_unit_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery_allocation_id?: string | null
          frozen_at?: string | null
          frozen_by?: string | null
          frozen_reason?: string | null
          id?: string
          is_frozen?: boolean
          is_quality_pick?: boolean
          landed_price?: number | null
          notes?: string | null
          rank?: number | null
          role?: string
          supplier_account_id: string
          supplier_material_id?: string | null
          supply_unit_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery_allocation_id?: string | null
          frozen_at?: string | null
          frozen_by?: string | null
          frozen_reason?: string | null
          id?: string
          is_frozen?: boolean
          is_quality_pick?: boolean
          landed_price?: number | null
          notes?: string | null
          rank?: number | null
          role?: string
          supplier_account_id?: string
          supplier_material_id?: string | null
          supply_unit_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supply_unit_suppliers_delivery_allocation_id_fkey"
            columns: ["delivery_allocation_id"]
            isOneToOne: false
            referencedRelation: "supplier_quote_delivery_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_unit_suppliers_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "supply_unit_suppliers_supplier_material_id_fkey"
            columns: ["supplier_material_id"]
            isOneToOne: false
            referencedRelation: "supplier_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_unit_suppliers_supply_unit_id_fkey"
            columns: ["supply_unit_id"]
            isOneToOne: false
            referencedRelation: "supply_units"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_units: {
        Row: {
          activated_at: string | null
          area_id: string | null
          created_at: string
          created_by: string | null
          cycle_id: string
          domain_id: string | null
          frozen_reason: string | null
          id: string
          material_id: string
          notes: string | null
          status: string
          target_price: number | null
          updated_at: string
          updated_by: string | null
          zone_code: string
        }
        Insert: {
          activated_at?: string | null
          area_id?: string | null
          created_at?: string
          created_by?: string | null
          cycle_id: string
          domain_id?: string | null
          frozen_reason?: string | null
          id?: string
          material_id: string
          notes?: string | null
          status?: string
          target_price?: number | null
          updated_at?: string
          updated_by?: string | null
          zone_code: string
        }
        Update: {
          activated_at?: string | null
          area_id?: string | null
          created_at?: string
          created_by?: string | null
          cycle_id?: string
          domain_id?: string | null
          frozen_reason?: string | null
          id?: string
          material_id?: string
          notes?: string | null
          status?: string
          target_price?: number | null
          updated_at?: string
          updated_by?: string | null
          zone_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_units_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "subcategory_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_units_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "unlock_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_units_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "supply_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_units_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_units_zone_code_fkey"
            columns: ["zone_code"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["code"]
          },
        ]
      }
      target_prices: {
        Row: {
          average_price: number | null
          best_price: number | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          is_locked: boolean
          material_id: string
          notes: string | null
          scope_id: string
          scope_type: string
          source_mode: string
          target_price: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          average_price?: number | null
          best_price?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          is_locked?: boolean
          material_id: string
          notes?: string | null
          scope_id: string
          scope_type: string
          source_mode?: string
          target_price: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          average_price?: number | null
          best_price?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          is_locked?: boolean
          material_id?: string
          notes?: string | null
          scope_id?: string
          scope_type?: string
          source_mode?: string
          target_price?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "target_prices_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          attachments: Json
          channel: string | null
          client_response: string | null
          communication_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_account_id: string | null
          deleted_at: string | null
          deleted_reason: string | null
          description: string | null
          due_at: string | null
          id: string
          legacy_follow_up_id: string | null
          metadata: Json
          opportunity_id: string | null
          outcome: string | null
          priority: string
          project_id: string | null
          reminder_enabled: boolean
          status: string
          supplier_account_id: string | null
          tags: string[]
          task_type: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          attachments?: Json
          channel?: string | null
          client_response?: string | null
          communication_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_account_id?: string | null
          deleted_at?: string | null
          deleted_reason?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          legacy_follow_up_id?: string | null
          metadata?: Json
          opportunity_id?: string | null
          outcome?: string | null
          priority?: string
          project_id?: string | null
          reminder_enabled?: boolean
          status?: string
          supplier_account_id?: string | null
          tags?: string[]
          task_type?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          attachments?: Json
          channel?: string | null
          client_response?: string | null
          communication_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_account_id?: string | null
          deleted_at?: string | null
          deleted_reason?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          legacy_follow_up_id?: string | null
          metadata?: Json
          opportunity_id?: string | null
          outcome?: string | null
          priority?: string
          project_id?: string | null
          reminder_enabled?: boolean
          status?: string
          supplier_account_id?: string | null
          tags?: string[]
          task_type?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customer_list_v1"
            referencedColumns: ["customer_account_id"]
          },
          {
            foreignKeyName: "tasks_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "tasks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["account_id"]
          },
        ]
      }
      trip_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: string
          happened_at: string
          id: string
          notes: string | null
          trip_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: string
          happened_at?: string
          id?: string
          notes?: string | null
          trip_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: string
          happened_at?: string
          id?: string
          notes?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          arrived_at: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          dispatched_at: string | null
          driver_id: string | null
          dropoff_location_id: string | null
          id: string
          notes: string | null
          order_id: string
          pickup_location_id: string | null
          scheduled_at: string | null
          status: string
          supplier_account_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          arrived_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          dispatched_at?: string | null
          driver_id?: string | null
          dropoff_location_id?: string | null
          id?: string
          notes?: string | null
          order_id: string
          pickup_location_id?: string | null
          scheduled_at?: string | null
          status?: string
          supplier_account_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          arrived_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          dispatched_at?: string | null
          driver_id?: string | null
          dropoff_location_id?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          pickup_location_id?: string | null
          scheduled_at?: string | null
          status?: string
          supplier_account_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_dropoff_location_id_fkey"
            columns: ["dropoff_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_pickup_location_id_fkey"
            columns: ["pickup_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_supplier_account_id_fkey"
            columns: ["supplier_account_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["account_id"]
          },
        ]
      }
      unlock_cycle_materials: {
        Row: {
          created_at: string
          cycle_id: string
          id: string
          material_id: string
          notes: string | null
          status: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          id?: string
          material_id: string
          notes?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          id?: string
          material_id?: string
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "unlock_cycle_materials_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "unlock_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlock_cycle_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      unlock_cycles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          scope_filter: Json
          start_date: string | null
          status: string
          subcategory_id: string | null
          updated_at: string
          updated_by: string | null
          zone_codes: string[]
          zone_group_ids: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          scope_filter?: Json
          start_date?: string | null
          status?: string
          subcategory_id?: string | null
          updated_at?: string
          updated_by?: string | null
          zone_codes?: string[]
          zone_group_ids?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          scope_filter?: Json
          start_date?: string | null
          status?: string
          subcategory_id?: string | null
          updated_at?: string
          updated_by?: string | null
          zone_codes?: string[]
          zone_group_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "unlock_cycles_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "material_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sandbox_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          label: string | null
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          label?: string | null
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          label?: string | null
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      waba_accounts: {
        Row: {
          access_token: string | null
          business_id: string
          created_at: string
          display_phone_number: string | null
          id: string
          onboarded_at: string | null
          onboarded_by: string | null
          phone_number_id: string | null
          quality_rating: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
          verified_name: string | null
          waba_id: string
        }
        Insert: {
          access_token?: string | null
          business_id: string
          created_at?: string
          display_phone_number?: string | null
          id?: string
          onboarded_at?: string | null
          onboarded_by?: string | null
          phone_number_id?: string | null
          quality_rating?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          verified_name?: string | null
          waba_id: string
        }
        Update: {
          access_token?: string | null
          business_id?: string
          created_at?: string
          display_phone_number?: string | null
          id?: string
          onboarded_at?: string | null
          onboarded_by?: string | null
          phone_number_id?: string | null
          quality_rating?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          verified_name?: string | null
          waba_id?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          account_id: string | null
          contact_id: string | null
          created_at: string
          first_message_at: string | null
          id: string
          last_message_at: string | null
          metadata: Json | null
          our_phone: string | null
          status: string
          summary: string | null
          summary_updated_at: string | null
          summary_version: number
          their_phone: string
          updated_at: string
          waba_phone_number_id: string | null
        }
        Insert: {
          account_id?: string | null
          contact_id?: string | null
          created_at?: string
          first_message_at?: string | null
          id?: string
          last_message_at?: string | null
          metadata?: Json | null
          our_phone?: string | null
          status?: string
          summary?: string | null
          summary_updated_at?: string | null
          summary_version?: number
          their_phone: string
          updated_at?: string
          waba_phone_number_id?: string | null
        }
        Update: {
          account_id?: string | null
          contact_id?: string | null
          created_at?: string
          first_message_at?: string | null
          id?: string
          last_message_at?: string | null
          metadata?: Json | null
          our_phone?: string | null
          status?: string
          summary?: string | null
          summary_updated_at?: string | null
          summary_version?: number
          their_phone?: string
          updated_at?: string
          waba_phone_number_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "customer_list_v1"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "customer_list_v1"
            referencedColumns: ["primary_contact_id"]
          },
        ]
      }
      whatsapp_message_status_events: {
        Row: {
          created_at: string
          happened_at: string | null
          id: string
          message_row_id: string | null
          meta_message_id: string
          payload: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          happened_at?: string | null
          id?: string
          message_row_id?: string | null
          meta_message_id: string
          payload?: Json | null
          status: string
        }
        Update: {
          created_at?: string
          happened_at?: string | null
          id?: string
          message_row_id?: string | null
          meta_message_id?: string
          payload?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_status_events_message_row_id_fkey"
            columns: ["message_row_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          conversation_id: string | null
          created_at: string
          direction: string
          from_phone: string | null
          happened_at: string
          id: string
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          location_name: string | null
          media_caption: string | null
          media_id: string | null
          media_mime_type: string | null
          media_sha256: string | null
          message_type: string
          meta_message_id: string
          payload: Json
          template_name: string | null
          text_body: string | null
          to_phone: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          direction: string
          from_phone?: string | null
          happened_at: string
          id?: string
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          media_caption?: string | null
          media_id?: string | null
          media_mime_type?: string | null
          media_sha256?: string | null
          message_type?: string
          meta_message_id: string
          payload: Json
          template_name?: string | null
          text_body?: string | null
          to_phone?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          direction?: string
          from_phone?: string | null
          happened_at?: string
          id?: string
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          media_caption?: string | null
          media_id?: string | null
          media_mime_type?: string | null
          media_sha256?: string | null
          message_type?: string
          meta_message_id?: string
          payload?: Json
          template_name?: string | null
          text_body?: string | null
          to_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_events: {
        Row: {
          error: string | null
          event_type: string
          headers: Json | null
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          received_at: string
          signature_sha256: string | null
        }
        Insert: {
          error?: string | null
          event_type?: string
          headers?: Json | null
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          received_at?: string
          signature_sha256?: string | null
        }
        Update: {
          error?: string | null
          event_type?: string
          headers?: Json | null
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          received_at?: string
          signature_sha256?: string | null
        }
        Relationships: []
      }
      zone_edges: {
        Row: {
          created_at: string | null
          edge_id: string
          id: string
          is_reversed: boolean | null
          position: number
          zone_code: string | null
        }
        Insert: {
          created_at?: string | null
          edge_id: string
          id?: string
          is_reversed?: boolean | null
          position: number
          zone_code?: string | null
        }
        Update: {
          created_at?: string | null
          edge_id?: string
          id?: string
          is_reversed?: boolean | null
          position?: number
          zone_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zone_edges_edge_id_fkey"
            columns: ["edge_id"]
            isOneToOne: false
            referencedRelation: "geo_edges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_edges_zone_code_fkey"
            columns: ["zone_code"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["code"]
          },
        ]
      }
      zone_groups: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          name_ar: string | null
          region_code: string
          updated_at: string
          zone_codes: string[]
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          name_ar?: string | null
          region_code: string
          updated_at?: string
          zone_codes?: string[]
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          name_ar?: string | null
          region_code?: string
          updated_at?: string
          zone_codes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "zone_groups_region_code_fkey"
            columns: ["region_code"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["code"]
          },
        ]
      }
      zones: {
        Row: {
          boundary_geojson: Json | null
          city: string | null
          code: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          name_ar: string | null
          notes: string | null
          region_code: string
          updated_at: string
          updated_by: string | null
          zone_no: string | null
        }
        Insert: {
          boundary_geojson?: Json | null
          city?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          name_ar?: string | null
          notes?: string | null
          region_code: string
          updated_at?: string
          updated_by?: string | null
          zone_no?: string | null
        }
        Update: {
          boundary_geojson?: Json | null
          city?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          name_ar?: string | null
          notes?: string | null
          region_code?: string
          updated_at?: string
          updated_by?: string | null
          zone_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zones_region_code_fkey"
            columns: ["region_code"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Views: {
      customer_list_v1: {
        Row: {
          account_created_at: string | null
          account_id: string | null
          account_metadata: Json | null
          account_notes: string | null
          account_status: string | null
          address_link: string | null
          address_text: string | null
          assigned_to: string | null
          city: Database["public"]["Enums"]["saudi_city"] | null
          code: string | null
          country: Database["public"]["Enums"]["gcc_country"] | null
          credit_limit: number | null
          customer_account_id: string | null
          customer_type: string | null
          display_name: string | null
          display_name_ar: string | null
          last_activity: string | null
          lat: number | null
          legal_name: string | null
          lifecycle_stage: string | null
          lng: number | null
          location_id: string | null
          open_tasks_count: number | null
          payment_terms_days: number | null
          pricing_tier: string | null
          primary_contact_email: string | null
          primary_contact_id: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          primary_contact_role: string | null
          region_code: string | null
          tax_number: string | null
          website: string | null
          zone_code: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: true
            referencedRelation: "customer_list_v1"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "locations_region_code_fkey"
            columns: ["region_code"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "locations_zone_code_fkey"
            columns: ["zone_code"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["code"]
          },
        ]
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      waba_accounts_safe: {
        Row: {
          business_id: string | null
          created_at: string | null
          display_phone_number: string | null
          id: string | null
          onboarded_at: string | null
          onboarded_by: string | null
          phone_number_id: string | null
          quality_rating: string | null
          status: string | null
          token_expires_at: string | null
          updated_at: string | null
          verified_name: string | null
          waba_id: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          display_phone_number?: string | null
          id?: string | null
          onboarded_at?: string | null
          onboarded_by?: string | null
          phone_number_id?: string | null
          quality_rating?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          verified_name?: string | null
          waba_id?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          display_phone_number?: string | null
          id?: string | null
          onboarded_at?: string | null
          onboarded_by?: string | null
          phone_number_id?: string | null
          quality_rating?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          verified_name?: string | null
          waba_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _activity_changed_keys: {
        Args: { _new: Json; _old: Json }
        Returns: string[]
      }
      _activity_row_label: { Args: { _data: Json }; Returns: string }
      _attach_activity_trigger: {
        Args: { p_table: string }
        Returns: undefined
      }
      _current_request_id: { Args: never; Returns: string }
      _extract_variant_unit: {
        Args: { p_key: string; p_label: string }
        Returns: string
      }
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      agent_assert_public_table_v1: {
        Args: { p_table: string }
        Returns: undefined
      }
      agent_commit_allowed_cols: {
        Args: { p_table: string }
        Returns: string[]
      }
      agent_commit_col_type: {
        Args: { p_col: string; p_table: string }
        Returns: string
      }
      agent_commit_filter_allowed: {
        Args: { p_table: string; p_values: Json }
        Returns: Json
      }
      agent_commit_get_ref: {
        Args: { p_actor: Json; p_ref: string; p_vars: Json }
        Returns: Json
      }
      agent_commit_resolve_jsonb: {
        Args: { p_actor: Json; p_node: Json; p_vars: Json }
        Returns: Json
      }
      agent_commit_v1: { Args: { p_token: string }; Returns: Json }
      agent_customer_fields: { Args: never; Returns: Json }
      agent_customer_schema: { Args: never; Returns: Json }
      agent_exec_insert_v1: {
        Args: { p_returning: Json; p_table: string; p_values: Json }
        Returns: Json
      }
      agent_exec_jsonb_patch_v1: {
        Args: {
          p_column: string
          p_mode: string
          p_patch?: Json
          p_path?: string[]
          p_table: string
          p_value?: Json
          p_where: Json
        }
        Returns: Json
      }
      agent_exec_update_v1: {
        Args: { p_returning: Json; p_set: Json; p_table: string; p_where: Json }
        Returns: Json
      }
      agent_resolve_actor_by_phone: {
        Args: { p_phone: string }
        Returns: string
      }
      agent_resolve_refs_v1: {
        Args: { p: Json; p_actor_user_id: string; p_vars: Json }
        Returns: Json
      }
      agent_sql_literal_cast_v1: {
        Args: { p_type: string; p_val: Json }
        Returns: string
      }
      agent_table_schema: { Args: { p_tables: string[] }; Returns: Json }
      assert_spec_change_allowed: {
        Args: {
          p_removed_options: Json
          p_removed_spec_keys: string[]
          p_subcategory_id: string
        }
        Returns: number
      }
      build_material_search_bag: {
        Args: { p_material_id: string }
        Returns: undefined
      }
      can_delete_material: {
        Args: { p_material_id: string }
        Returns: {
          can: boolean
          reasons: string[]
        }[]
      }
      cleanup_expired_rows: { Args: never; Returns: undefined }
      compute_polygon_geojson: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: Json
      }
      compute_quotation_totals: {
        Args: { _quotation_id: string }
        Returns: Json
      }
      create_customer: {
        Args: {
          p_account_notes?: string
          p_account_status?: string
          p_contact_email?: string
          p_contact_name?: string
          p_contact_phone?: string
          p_contact_role?: string
          p_credit_limit?: number
          p_customer_notes?: string
          p_customer_type?: string
          p_display_name: string
          p_display_name_ar?: string
          p_legal_name?: string
          p_location?: Json
          p_payment_terms_days?: number
          p_prefers_whatsapp?: boolean
          p_pricing_tier?: string
          p_tax_number?: string
          p_website?: string
        }
        Returns: string
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      execute_readonly_sql: { Args: { query: string }; Returns: Json }
      find_domain_for_material_zone: {
        Args: { p_material_code: string; p_zone_code: string }
        Returns: string
      }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_full_schema: { Args: never; Returns: Json }
      gettransactionid: { Args: never; Returns: unknown }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      identify_agent_user: {
        Args: { phone: string }
        Returns: {
          display_name: string
          phone: string
          role: string
          user_id: string
        }[]
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      material_display_name: {
        Args: { p_locale?: string; p_material_id: string }
        Returns: string
      }
      open_sandbox_session: { Args: { p_label?: string }; Returns: string }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      promote_cycle_to_domain: {
        Args: { p_cycle_id: string; p_domain_id: string }
        Returns: number
      }
      resolve_line_pricing: {
        Args: {
          _global_margin?: number
          _item_override_margin?: number
          _material_id: string
          _qty?: number
          _requested_role?: string
          _supplier_account_id?: string
          _zone_code: string
        }
        Returns: {
          delivery_per_unit: number
          landed_unit_price: number
          margin_pct: number
          reason: string
          role_used: string
          scope_used: string
          supplier_account_id: string
          supplier_material_id: string
          unit_price: number
          was_fallback: boolean
          zone_resolved: boolean
        }[]
      }
      resolve_margin_pct: {
        Args: {
          _global_margin?: number
          _item_override?: number
          _material_id: string
        }
        Returns: number
      }
      resolve_supplier: {
        Args: {
          p_material_code: string
          p_requested_role?: Database["public"]["Enums"]["supplier_selection_role"]
          p_zone_code: string
        }
        Returns: Json
      }
      revert_activity_entry: { Args: { p_id: string }; Returns: Json }
      revise_quotation: { Args: { _quotation_id: string }; Returns: string }
      sandbox_promote: { Args: { p_session_id: string }; Returns: undefined }
      sandbox_revert: { Args: { p_session_id: string }; Returns: Json }
      set_request_id: { Args: { _request_id: string }; Returns: undefined }
      set_sandbox_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      set_supplier_selection: {
        Args: {
          p_action?: string
          p_domain_id: string
          p_material_code: string
          p_reason?: string
          p_role: Database["public"]["Enums"]["supplier_selection_role"]
          p_supplier_id: string
          p_zone_code: string
        }
        Returns: string
      }
      split_edge: {
        Args: { p_edge_id: string; p_lat: number; p_lng: number }
        Returns: string
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      validate_quotation: { Args: { _quotation_id: string }; Returns: Json }
      validate_supplier_quote_delivery_allocation_shares_v1: {
        Args: { p_delivery_line_id: string; p_zone_code: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "management" | "sales" | "support" | "viewer"
      gcc_country: "SA" | "AE" | "BH" | "KW" | "OM" | "QA"
      saudi_city:
        | "Riyadh"
        | "Jeddah"
        | "Makkah"
        | "Madinah"
        | "Dammam"
        | "Khobar"
        | "Dhahran"
        | "Tabuk"
        | "Abha"
        | "Taif"
        | "Hail"
        | "Buraidah"
        | "Najran"
        | "Jazan"
        | "Yanbu"
        | "Jubail"
        | "Khamis Mushait"
        | "Al Ahsa"
        | "Al Qatif"
        | "Sakaka"
        | "Arar"
        | "Baha"
        | "Bisha"
        | "Hafar Al Batin"
        | "Unaizah"
        | "Dawadmi"
        | "Khafji"
        | "Ras Tanura"
        | "Al Majmaah"
        | "Shaqra"
        | "Al Zulfi"
        | "Wadi Al Dawasir"
        | "Afif"
        | "Al Kharj"
        | "Diriyah"
        | "Muzahmiyya"
        | "Huraymila"
        | "Rumah"
        | "Thadiq"
        | "Al Ghat"
        | "Marat"
        | "Layla"
      supplier_selection_role: "selected" | "quality" | "backup" | "rejected"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
      app_role: ["admin", "management", "sales", "support", "viewer"],
      gcc_country: ["SA", "AE", "BH", "KW", "OM", "QA"],
      saudi_city: [
        "Riyadh",
        "Jeddah",
        "Makkah",
        "Madinah",
        "Dammam",
        "Khobar",
        "Dhahran",
        "Tabuk",
        "Abha",
        "Taif",
        "Hail",
        "Buraidah",
        "Najran",
        "Jazan",
        "Yanbu",
        "Jubail",
        "Khamis Mushait",
        "Al Ahsa",
        "Al Qatif",
        "Sakaka",
        "Arar",
        "Baha",
        "Bisha",
        "Hafar Al Batin",
        "Unaizah",
        "Dawadmi",
        "Khafji",
        "Ras Tanura",
        "Al Majmaah",
        "Shaqra",
        "Al Zulfi",
        "Wadi Al Dawasir",
        "Afif",
        "Al Kharj",
        "Diriyah",
        "Muzahmiyya",
        "Huraymila",
        "Rumah",
        "Thadiq",
        "Al Ghat",
        "Marat",
        "Layla",
      ],
      supplier_selection_role: ["selected", "quality", "backup", "rejected"],
    },
  },
} as const
