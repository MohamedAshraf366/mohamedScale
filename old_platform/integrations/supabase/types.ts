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
      activities: {
        Row: {
          activity_date: string
          activity_type: string
          assigned_to: string | null
          channel: string | null
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          interest_level: string | null
          legacy_communication_id: string | null
          legacy_status: string | null
          notes: string | null
          opportunity_id: string | null
          project_id: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          activity_date?: string
          activity_type?: string
          assigned_to?: string | null
          channel?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          interest_level?: string | null
          legacy_communication_id?: string | null
          legacy_status?: string | null
          notes?: string | null
          opportunity_id?: string | null
          project_id?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          activity_date?: string
          activity_type?: string
          assigned_to?: string | null
          channel?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          interest_level?: string | null
          legacy_communication_id?: string | null
          legacy_status?: string | null
          notes?: string | null
          opportunity_id?: string | null
          project_id?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_legacy_communication_id_fkey"
            columns: ["legacy_communication_id"]
            isOneToOne: false
            referencedRelation: "communication_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          description: string | null
          id: string
          module: string
          new_values: Json | null
          old_values: Json | null
          record_id: string
          record_name: string | null
          user_id: string
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          module: string
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          record_name?: string | null
          user_id: string
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          module?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          record_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          icon: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_contacts: {
        Row: {
          client_id: string
          contact_name: string
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          phone: string
          role: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          contact_name: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          phone: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          contact_name?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          phone?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_segments: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          assigned_to: string | null
          city: string | null
          company_name: string
          created_at: string
          district: string | null
          id: string
          interest_level: string | null
          notes: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          segment_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          city?: string | null
          company_name: string
          created_at?: string
          district?: string | null
          id?: string
          interest_level?: string | null
          notes?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          segment_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          city?: string | null
          company_name?: string
          created_at?: string
          district?: string | null
          id?: string
          interest_level?: string | null
          notes?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          segment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "client_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      closed_deal_items: {
        Row: {
          communication_id: string
          created_at: string
          final_unit_price: number | null
          id: string
          line_total: number | null
          material_id: string | null
          quantity: number | null
          unit: string | null
        }
        Insert: {
          communication_id: string
          created_at?: string
          final_unit_price?: number | null
          id?: string
          line_total?: number | null
          material_id?: string | null
          quantity?: number | null
          unit?: string | null
        }
        Update: {
          communication_id?: string
          created_at?: string
          final_unit_price?: number | null
          id?: string
          line_total?: number | null
          material_id?: string | null
          quantity?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "closed_deal_items_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "communication_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closed_deal_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_log: {
        Row: {
          action: string | null
          assigned_to: string | null
          category: string | null
          city: string | null
          client_delivery_satisfaction: number | null
          client_id: string | null
          client_improvements: string | null
          client_liked: string | null
          client_overall_satisfaction: number | null
          client_price_satisfaction: number | null
          client_quality_satisfaction: number | null
          client_retention_ideas: string | null
          communication_channels: string | null
          communication_date: string | null
          company_name: string | null
          contact_info: string | null
          created_at: string | null
          current_phase: string | null
          deal_city: string | null
          deal_closed_at: string | null
          deal_completed: boolean | null
          deal_delivery_feedback: string | null
          deal_delivery_rating: number | null
          deal_delivery_type: string | null
          deal_district: string | null
          deal_duration_days: number | null
          deal_location_notes: string | null
          deal_project_name: string | null
          deal_started_at: string | null
          deal_supplier_feedback: string | null
          deal_supplier_id: string | null
          deal_supplier_rating: number | null
          deal_value_total: number | null
          district: string | null
          follow_up_date: string | null
          id: string
          interest_level: string | null
          is_general_quotation: boolean | null
          is_soft_quotation: boolean | null
          location: string | null
          notes: string | null
          objection_type: string | null
          opportunity_id: string | null
          other_projects: string | null
          outcome_notes: string | null
          owner_id: string | null
          person_name: string | null
          project_id: string | null
          project_size: string | null
          project_type: string | null
          quantity: number | null
          quotation_required: boolean | null
          quotation_sent: boolean | null
          related_material_id: string | null
          related_supplier_id: string | null
          status: Database["public"]["Enums"]["communication_status"] | null
          summary: string | null
          topic: string | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          action?: string | null
          assigned_to?: string | null
          category?: string | null
          city?: string | null
          client_delivery_satisfaction?: number | null
          client_id?: string | null
          client_improvements?: string | null
          client_liked?: string | null
          client_overall_satisfaction?: number | null
          client_price_satisfaction?: number | null
          client_quality_satisfaction?: number | null
          client_retention_ideas?: string | null
          communication_channels?: string | null
          communication_date?: string | null
          company_name?: string | null
          contact_info?: string | null
          created_at?: string | null
          current_phase?: string | null
          deal_city?: string | null
          deal_closed_at?: string | null
          deal_completed?: boolean | null
          deal_delivery_feedback?: string | null
          deal_delivery_rating?: number | null
          deal_delivery_type?: string | null
          deal_district?: string | null
          deal_duration_days?: number | null
          deal_location_notes?: string | null
          deal_project_name?: string | null
          deal_started_at?: string | null
          deal_supplier_feedback?: string | null
          deal_supplier_id?: string | null
          deal_supplier_rating?: number | null
          deal_value_total?: number | null
          district?: string | null
          follow_up_date?: string | null
          id?: string
          interest_level?: string | null
          is_general_quotation?: boolean | null
          is_soft_quotation?: boolean | null
          location?: string | null
          notes?: string | null
          objection_type?: string | null
          opportunity_id?: string | null
          other_projects?: string | null
          outcome_notes?: string | null
          owner_id?: string | null
          person_name?: string | null
          project_id?: string | null
          project_size?: string | null
          project_type?: string | null
          quantity?: number | null
          quotation_required?: boolean | null
          quotation_sent?: boolean | null
          related_material_id?: string | null
          related_supplier_id?: string | null
          status?: Database["public"]["Enums"]["communication_status"] | null
          summary?: string | null
          topic?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          action?: string | null
          assigned_to?: string | null
          category?: string | null
          city?: string | null
          client_delivery_satisfaction?: number | null
          client_id?: string | null
          client_improvements?: string | null
          client_liked?: string | null
          client_overall_satisfaction?: number | null
          client_price_satisfaction?: number | null
          client_quality_satisfaction?: number | null
          client_retention_ideas?: string | null
          communication_channels?: string | null
          communication_date?: string | null
          company_name?: string | null
          contact_info?: string | null
          created_at?: string | null
          current_phase?: string | null
          deal_city?: string | null
          deal_closed_at?: string | null
          deal_completed?: boolean | null
          deal_delivery_feedback?: string | null
          deal_delivery_rating?: number | null
          deal_delivery_type?: string | null
          deal_district?: string | null
          deal_duration_days?: number | null
          deal_location_notes?: string | null
          deal_project_name?: string | null
          deal_started_at?: string | null
          deal_supplier_feedback?: string | null
          deal_supplier_id?: string | null
          deal_supplier_rating?: number | null
          deal_value_total?: number | null
          district?: string | null
          follow_up_date?: string | null
          id?: string
          interest_level?: string | null
          is_general_quotation?: boolean | null
          is_soft_quotation?: boolean | null
          location?: string | null
          notes?: string | null
          objection_type?: string | null
          opportunity_id?: string | null
          other_projects?: string | null
          outcome_notes?: string | null
          owner_id?: string | null
          person_name?: string | null
          project_id?: string | null
          project_size?: string | null
          project_type?: string | null
          quantity?: number | null
          quotation_required?: boolean | null
          quotation_sent?: boolean | null
          related_material_id?: string | null
          related_supplier_id?: string | null
          status?: Database["public"]["Enums"]["communication_status"] | null
          summary?: string | null
          topic?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_log_deal_supplier_id_fkey"
            columns: ["deal_supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_log_deal_supplier_id_fkey"
            columns: ["deal_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_log_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_log_related_material_id_fkey"
            columns: ["related_material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_log_related_supplier_id_fkey"
            columns: ["related_supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_log_related_supplier_id_fkey"
            columns: ["related_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_material_needs: {
        Row: {
          category_id: string | null
          category_name: string | null
          communication_id: string
          created_at: string
          id: string
          material_id: string | null
          notes: string | null
          subcategory_name: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          category_name?: string | null
          communication_id: string
          created_at?: string
          id?: string
          material_id?: string | null
          notes?: string | null
          subcategory_name?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          category_name?: string | null
          communication_id?: string
          created_at?: string
          id?: string
          material_id?: string | null
          notes?: string | null
          subcategory_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_material_needs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_material_needs_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "communication_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_material_needs_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_material_prices: {
        Row: {
          communication_id: string
          created_at: string
          current_purchase_price: number | null
          id: string
          material_id: string
          updated_at: string
        }
        Insert: {
          communication_id: string
          created_at?: string
          current_purchase_price?: number | null
          id?: string
          material_id: string
          updated_at?: string
        }
        Update: {
          communication_id?: string
          created_at?: string
          current_purchase_price?: number | null
          id?: string
          material_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_material_prices_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "communication_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_material_prices_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          id: string
          material_id: string
          notes: string | null
          status: string
          supplier_id: string | null
          task_type: string
          updated_at: string
          validity_tracker_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          material_id: string
          notes?: string | null
          status?: string
          supplier_id?: string | null
          task_type?: string
          updated_at?: string
          validity_tracker_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          material_id?: string
          notes?: string | null
          status?: string
          supplier_id?: string | null
          task_type?: string
          updated_at?: string
          validity_tracker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalation_tasks_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_tasks_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_tasks_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_tasks_validity_tracker_id_fkey"
            columns: ["validity_tracker_id"]
            isOneToOne: false
            referencedRelation: "material_validity_tracker"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_pipeline: {
        Row: {
          bucket: string
          created_at: string
          description: string | null
          display_order: number
          expected_date: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          bucket: string
          created_at?: string
          description?: string | null
          display_order?: number
          expected_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          bucket?: string
          created_at?: string
          description?: string | null
          display_order?: number
          expected_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      follow_up_audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string
          communication_log_id: string
          created_at: string
          follow_up_id: string
          id: string
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by: string
          communication_log_id: string
          created_at?: string
          follow_up_id: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string
          communication_log_id?: string
          created_at?: string
          follow_up_id?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_audit_log_communication_log_id_fkey"
            columns: ["communication_log_id"]
            isOneToOne: false
            referencedRelation: "communication_log"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_history: {
        Row: {
          action: string | null
          attachments: string[] | null
          client_response: string | null
          communication_log_id: string
          created_at: string
          follow_up_channel: string | null
          follow_up_date: string
          follow_up_type: string | null
          id: string
          notes: string | null
          opportunity_id: string | null
          outcome: string | null
          priority: string | null
          project_id: string | null
          reminder_enabled: boolean | null
          status_after:
            | Database["public"]["Enums"]["communication_status"]
            | null
          tags: string[] | null
          user_id: string
        }
        Insert: {
          action?: string | null
          attachments?: string[] | null
          client_response?: string | null
          communication_log_id: string
          created_at?: string
          follow_up_channel?: string | null
          follow_up_date?: string
          follow_up_type?: string | null
          id?: string
          notes?: string | null
          opportunity_id?: string | null
          outcome?: string | null
          priority?: string | null
          project_id?: string | null
          reminder_enabled?: boolean | null
          status_after?:
            | Database["public"]["Enums"]["communication_status"]
            | null
          tags?: string[] | null
          user_id: string
        }
        Update: {
          action?: string | null
          attachments?: string[] | null
          client_response?: string | null
          communication_log_id?: string
          created_at?: string
          follow_up_channel?: string | null
          follow_up_date?: string
          follow_up_type?: string | null
          id?: string
          notes?: string | null
          opportunity_id?: string | null
          outcome?: string | null
          priority?: string | null
          project_id?: string | null
          reminder_enabled?: boolean | null
          status_after?:
            | Database["public"]["Enums"]["communication_status"]
            | null
          tags?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_history_communication_log_id_fkey"
            columns: ["communication_log_id"]
            isOneToOne: false
            referencedRelation: "communication_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_history_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      general_tasks: {
        Row: {
          assigned_to: string
          attachments: string[] | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to: string
          attachments?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          attachments?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      material_alt_suppliers: {
        Row: {
          created_at: string | null
          delivery_price: number | null
          id: string
          manufacturer_price: number | null
          material_id: string
          material_notes: string | null
          moq: number | null
          price_valid_until: string | null
          supplier_id: string
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          delivery_price?: number | null
          id?: string
          manufacturer_price?: number | null
          material_id: string
          material_notes?: string | null
          moq?: number | null
          price_valid_until?: string | null
          supplier_id: string
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          delivery_price?: number | null
          id?: string
          manufacturer_price?: number | null
          material_id?: string
          material_notes?: string | null
          moq?: number | null
          price_valid_until?: string | null
          supplier_id?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "material_alt_suppliers_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_alt_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_alt_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      material_coverage: {
        Row: {
          created_at: string
          id: string
          is_covered: boolean
          material_id: string
          supplier_id: string | null
          updated_at: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_covered?: boolean
          material_id: string
          supplier_id?: string | null
          updated_at?: string
          zone_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_covered?: boolean
          material_id?: string
          supplier_id?: string | null
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_coverage_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_coverage_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_coverage_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_coverage_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      material_price_history: {
        Row: {
          change_reason: string | null
          created_at: string
          delivery_price: number | null
          id: string
          manufacturer_price: number | null
          material_id: string
          recorded_at: string
          recorded_by: string | null
          supplier_id: string
          unit_price: number | null
        }
        Insert: {
          change_reason?: string | null
          created_at?: string
          delivery_price?: number | null
          id?: string
          manufacturer_price?: number | null
          material_id: string
          recorded_at?: string
          recorded_by?: string | null
          supplier_id: string
          unit_price?: number | null
        }
        Update: {
          change_reason?: string | null
          created_at?: string
          delivery_price?: number | null
          id?: string
          manufacturer_price?: number | null
          material_id?: string
          recorded_at?: string
          recorded_by?: string | null
          supplier_id?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "material_price_history_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_price_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_price_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      material_price_versions: {
        Row: {
          confirmation_status: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          delivery_price: number | null
          id: string
          material_id: string
          notes: string | null
          supplier_id: string
          total_price: number | null
          unit_price: number | null
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          confirmation_status?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          delivery_price?: number | null
          id?: string
          material_id: string
          notes?: string | null
          supplier_id: string
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          confirmation_status?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          delivery_price?: number | null
          id?: string
          material_id?: string
          notes?: string | null
          supplier_id?: string
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_price_versions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_price_versions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_price_versions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      material_renegotiations: {
        Row: {
          approval_status: Database["public"]["Enums"]["renegotiation_approval_status"]
          completed_at: string | null
          created_at: string
          current_price: number | null
          final_agreed_price: number | null
          id: string
          management_approved_target: number | null
          management_notes: string | null
          management_reviewed_at: string | null
          management_reviewed_by: string | null
          material_id: string
          objection_id: string | null
          rejection_reason: string | null
          renegotiation_status: string | null
          requested_by: string | null
          sales_suggested_price: number | null
          scheduled_date: string | null
          supplier_id: string | null
          supply_head_notes: string | null
          supply_head_reviewed_at: string | null
          supply_head_reviewed_by: string | null
          supply_head_target: number | null
          updated_at: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["renegotiation_approval_status"]
          completed_at?: string | null
          created_at?: string
          current_price?: number | null
          final_agreed_price?: number | null
          id?: string
          management_approved_target?: number | null
          management_notes?: string | null
          management_reviewed_at?: string | null
          management_reviewed_by?: string | null
          material_id: string
          objection_id?: string | null
          rejection_reason?: string | null
          renegotiation_status?: string | null
          requested_by?: string | null
          sales_suggested_price?: number | null
          scheduled_date?: string | null
          supplier_id?: string | null
          supply_head_notes?: string | null
          supply_head_reviewed_at?: string | null
          supply_head_reviewed_by?: string | null
          supply_head_target?: number | null
          updated_at?: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["renegotiation_approval_status"]
          completed_at?: string | null
          created_at?: string
          current_price?: number | null
          final_agreed_price?: number | null
          id?: string
          management_approved_target?: number | null
          management_notes?: string | null
          management_reviewed_at?: string | null
          management_reviewed_by?: string | null
          material_id?: string
          objection_id?: string | null
          rejection_reason?: string | null
          renegotiation_status?: string | null
          requested_by?: string | null
          sales_suggested_price?: number | null
          scheduled_date?: string | null
          supplier_id?: string | null
          supply_head_notes?: string | null
          supply_head_reviewed_at?: string | null
          supply_head_reviewed_by?: string | null
          supply_head_target?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_renegotiations_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_renegotiations_objection_id_fkey"
            columns: ["objection_id"]
            isOneToOne: false
            referencedRelation: "communication_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_renegotiations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_renegotiations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      material_unlock_cycles: {
        Row: {
          completed_at: string | null
          created_at: string
          cycle_status: string | null
          id: string
          initiated_at: string | null
          initiated_by: string | null
          is_renegotiation: boolean | null
          material_id: string
          notes: string | null
          renegotiation_status: string | null
          target_price: number | null
          unlock_status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          cycle_status?: string | null
          id?: string
          initiated_at?: string | null
          initiated_by?: string | null
          is_renegotiation?: boolean | null
          material_id: string
          notes?: string | null
          renegotiation_status?: string | null
          target_price?: number | null
          unlock_status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          cycle_status?: string | null
          id?: string
          initiated_at?: string | null
          initiated_by?: string | null
          is_renegotiation?: boolean | null
          material_id?: string
          notes?: string | null
          renegotiation_status?: string | null
          target_price?: number | null
          unlock_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_unlock_cycles_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      material_unlock_suppliers: {
        Row: {
          agreed_at: string | null
          coverage_zones: string[] | null
          created_at: string
          cycle_id: string
          delivery_price: number | null
          final_price: number | null
          id: string
          notes: string | null
          quality_rating: number | null
          quoted_at: string | null
          quoted_price: number | null
          status: string
          supplier_id: string
          total_price: number | null
          updated_at: string
        }
        Insert: {
          agreed_at?: string | null
          coverage_zones?: string[] | null
          created_at?: string
          cycle_id: string
          delivery_price?: number | null
          final_price?: number | null
          id?: string
          notes?: string | null
          quality_rating?: number | null
          quoted_at?: string | null
          quoted_price?: number | null
          status?: string
          supplier_id: string
          total_price?: number | null
          updated_at?: string
        }
        Update: {
          agreed_at?: string | null
          coverage_zones?: string[] | null
          created_at?: string
          cycle_id?: string
          delivery_price?: number | null
          final_price?: number | null
          id?: string
          notes?: string | null
          quality_rating?: number | null
          quoted_at?: string | null
          quoted_price?: number | null
          status?: string
          supplier_id?: string
          total_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_unlock_suppliers_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "material_unlock_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_unlock_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_unlock_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      material_validity_tracker: {
        Row: {
          ai_attempt_count: number | null
          confirmation_source: string | null
          created_at: string
          current_price: number | null
          escalation_phase: string | null
          escalation_started_at: string | null
          id: string
          is_active: boolean | null
          last_ai_message_at: string | null
          last_confirmed_at: string | null
          material_id: string
          notification_sent: boolean | null
          officer_assigned_at: string | null
          price_valid_from: string
          price_valid_until: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          ai_attempt_count?: number | null
          confirmation_source?: string | null
          created_at?: string
          current_price?: number | null
          escalation_phase?: string | null
          escalation_started_at?: string | null
          id?: string
          is_active?: boolean | null
          last_ai_message_at?: string | null
          last_confirmed_at?: string | null
          material_id: string
          notification_sent?: boolean | null
          officer_assigned_at?: string | null
          price_valid_from?: string
          price_valid_until: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_attempt_count?: number | null
          confirmation_source?: string | null
          created_at?: string
          current_price?: number | null
          escalation_phase?: string | null
          escalation_started_at?: string | null
          id?: string
          is_active?: boolean | null
          last_ai_message_at?: string | null
          last_confirmed_at?: string | null
          material_id?: string
          notification_sent?: boolean | null
          officer_assigned_at?: string | null
          price_valid_from?: string
          price_valid_until?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_validity_tracker_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_validity_tracker_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_validity_tracker_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          category: string
          created_at: string | null
          cumulative_order_quantity: number | null
          datasheet_url: string | null
          delivery_time_days: number | null
          fast_moving_score: number | null
          id: string
          image_url: string | null
          last_reviewed_at: string | null
          long_desc: string | null
          main_supplier_id: string | null
          market_price_avg: number | null
          market_price_max: number | null
          market_price_min: number | null
          moq: string | null
          name: string
          scale_price: number | null
          short_desc: string | null
          spec_ref: string | null
          subcategory: string | null
          target_price: number | null
          transportation_type:
            | Database["public"]["Enums"]["transportation_type"]
            | null
          uom: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          cumulative_order_quantity?: number | null
          datasheet_url?: string | null
          delivery_time_days?: number | null
          fast_moving_score?: number | null
          id?: string
          image_url?: string | null
          last_reviewed_at?: string | null
          long_desc?: string | null
          main_supplier_id?: string | null
          market_price_avg?: number | null
          market_price_max?: number | null
          market_price_min?: number | null
          moq?: string | null
          name: string
          scale_price?: number | null
          short_desc?: string | null
          spec_ref?: string | null
          subcategory?: string | null
          target_price?: number | null
          transportation_type?:
            | Database["public"]["Enums"]["transportation_type"]
            | null
          uom: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          cumulative_order_quantity?: number | null
          datasheet_url?: string | null
          delivery_time_days?: number | null
          fast_moving_score?: number | null
          id?: string
          image_url?: string | null
          last_reviewed_at?: string | null
          long_desc?: string | null
          main_supplier_id?: string | null
          market_price_avg?: number | null
          market_price_max?: number | null
          market_price_min?: number | null
          moq?: string | null
          name?: string
          scale_price?: number | null
          short_desc?: string | null
          spec_ref?: string | null
          subcategory?: string | null
          target_price?: number | null
          transportation_type?:
            | Database["public"]["Enums"]["transportation_type"]
            | null
          uom?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "materials_main_supplier_id_fkey"
            columns: ["main_supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_main_supplier_id_fkey"
            columns: ["main_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      operations_order_materials: {
        Row: {
          created_at: string
          expected_delivery_date: string | null
          id: string
          material_name: string
          notes: string | null
          order_id: string
          pricing_type: string | null
          quantity: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          expected_delivery_date?: string | null
          id?: string
          material_name: string
          notes?: string | null
          order_id: string
          pricing_type?: string | null
          quantity?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          expected_delivery_date?: string | null
          id?: string
          material_name?: string
          notes?: string | null
          order_id?: string
          pricing_type?: string | null
          quantity?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "operations_order_materials_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "operations_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      operations_orders: {
        Row: {
          client_id: string
          closed_at: string | null
          closed_by_name: string | null
          created_at: string
          created_by: string | null
          deal_id: string
          final_payment_proof_url: string | null
          first_payment_proof_url: string | null
          id: string
          notes: string | null
          opportunity_id: string
          order_number: string
          payment_status: string
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          closed_at?: string | null
          closed_by_name?: string | null
          created_at?: string
          created_by?: string | null
          deal_id: string
          final_payment_proof_url?: string | null
          first_payment_proof_url?: string | null
          id?: string
          notes?: string | null
          opportunity_id: string
          order_number: string
          payment_status?: string
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          closed_at?: string | null
          closed_by_name?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string
          final_payment_proof_url?: string | null
          first_payment_proof_url?: string | null
          id?: string
          notes?: string | null
          opportunity_id?: string
          order_number?: string
          payment_status?: string
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operations_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_orders_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          assigned_to: string | null
          client_id: string
          closed_at: string | null
          converted_to_deal_at: string | null
          created_at: string
          deal_id: string | null
          expected_close_date: string | null
          expected_value: number | null
          id: string
          in_pipeline: boolean
          interest_level: string | null
          is_closed: boolean | null
          is_deal: boolean | null
          is_locked: boolean | null
          name: string
          notes: string | null
          project_id: string
          stage: string | null
          updated_at: string
          won: boolean | null
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          closed_at?: string | null
          converted_to_deal_at?: string | null
          created_at?: string
          deal_id?: string | null
          expected_close_date?: string | null
          expected_value?: number | null
          id?: string
          in_pipeline?: boolean
          interest_level?: string | null
          is_closed?: boolean | null
          is_deal?: boolean | null
          is_locked?: boolean | null
          name: string
          notes?: string | null
          project_id: string
          stage?: string | null
          updated_at?: string
          won?: boolean | null
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          closed_at?: string | null
          converted_to_deal_at?: string | null
          created_at?: string
          deal_id?: string | null
          expected_close_date?: string | null
          expected_value?: number | null
          id?: string
          in_pipeline?: boolean
          interest_level?: string | null
          is_closed?: boolean | null
          is_deal?: boolean | null
          is_locked?: boolean | null
          name?: string
          notes?: string | null
          project_id?: string
          stage?: string | null
          updated_at?: string
          won?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_materials: {
        Row: {
          created_at: string
          expected_delivery_date: string | null
          id: string
          material_name: string
          notes: string | null
          opportunity_id: string
          pricing_type: string
          quantity: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expected_delivery_date?: string | null
          id?: string
          material_name: string
          notes?: string | null
          opportunity_id: string
          pricing_type?: string
          quantity?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expected_delivery_date?: string | null
          id?: string
          material_name?: string
          notes?: string | null
          opportunity_id?: string
          pricing_type?: string
          quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_materials_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      project_documents: {
        Row: {
          category: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          project_id: string
          updated_at: string
          uploaded_by: string | null
          uploaded_by_name: string | null
        }
        Insert: {
          category: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          project_id: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          project_id?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          city: string | null
          client_id: string
          created_at: string
          current_phase: string | null
          district: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          project_size: string | null
          project_type: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          client_id: string
          created_at?: string
          current_phase?: string | null
          district?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          project_size?: string | null
          project_type?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          client_id?: string
          created_at?: string
          current_phase?: string | null
          district?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          project_size?: string | null
          project_type?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      quarterly_tasks: {
        Row: {
          area: string
          created_at: string
          end_week: number
          id: string
          name: string
          owner: string | null
          quarter: string
          start_week: number
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          area?: string
          created_at?: string
          end_week?: number
          id?: string
          name: string
          owner?: string | null
          quarter?: string
          start_week?: number
          status?: string
          updated_at?: string
          year?: number
        }
        Update: {
          area?: string
          created_at?: string
          end_week?: number
          id?: string
          name?: string
          owner?: string | null
          quarter?: string
          start_week?: number
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      quotation_items: {
        Row: {
          city: string | null
          communication_log_id: string
          created_at: string | null
          district: string | null
          id: string
          location: string | null
          material_id: string | null
          quantity: number | null
          supplier_id: string | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          communication_log_id: string
          created_at?: string | null
          district?: string | null
          id?: string
          location?: string | null
          material_id?: string | null
          quantity?: number | null
          supplier_id?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          communication_log_id?: string
          created_at?: string | null
          district?: string | null
          id?: string
          location?: string | null
          material_id?: string | null
          quantity?: number | null
          supplier_id?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_communication_log_id_fkey"
            columns: ["communication_log_id"]
            isOneToOne: false
            referencedRelation: "communication_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_target_activity_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          id: string
          sales_target_id: string | null
          target_metric: string | null
          user_id: string
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          id?: string
          sales_target_id?: string | null
          target_metric?: string | null
          user_id: string
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          id?: string
          sales_target_id?: string | null
          target_metric?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_target_activity_log_sales_target_id_fkey"
            columns: ["sales_target_id"]
            isOneToOne: false
            referencedRelation: "sales_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_targets: {
        Row: {
          created_at: string
          display_order: number
          explanation: string
          id: string
          metric: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          explanation: string
          id?: string
          metric: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          display_order?: number
          explanation?: string
          id?: string
          metric?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      scale_targets: {
        Row: {
          created_at: string
          explanation: string | null
          id: string
          kpi_name: string
          period_type: Database["public"]["Enums"]["period_type"]
          period_value: string
          target_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          explanation?: string | null
          id?: string
          kpi_name: string
          period_type: Database["public"]["Enums"]["period_type"]
          period_value: string
          target_value: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          explanation?: string | null
          id?: string
          kpi_name?: string
          period_type?: Database["public"]["Enums"]["period_type"]
          period_value?: string
          target_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      shipments: {
        Row: {
          actual_arrival: string | null
          actual_departure: string | null
          client_name: string
          created_at: string
          created_by: string | null
          delay_minutes: number | null
          delivery_status: string | null
          destination: string
          driver_name: string | null
          driver_phone: string | null
          id: string
          items_description: string | null
          notes: string | null
          origin: string
          progress_percent: number | null
          scheduled_arrival: string | null
          scheduled_departure: string | null
          shipment_code: string | null
          status: string
          supplier_id: string | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          actual_arrival?: string | null
          actual_departure?: string | null
          client_name: string
          created_at?: string
          created_by?: string | null
          delay_minutes?: number | null
          delivery_status?: string | null
          destination: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          items_description?: string | null
          notes?: string | null
          origin: string
          progress_percent?: number | null
          scheduled_arrival?: string | null
          scheduled_departure?: string | null
          shipment_code?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          actual_arrival?: string | null
          actual_departure?: string | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          delay_minutes?: number | null
          delivery_status?: string | null
          destination?: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          items_description?: string | null
          notes?: string | null
          origin?: string
          progress_percent?: number | null
          scheduled_arrival?: string | null
          scheduled_departure?: string | null
          shipment_code?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_blockers: {
        Row: {
          area: string
          created_at: string
          description: string | null
          id: string
          mitigation_owner: string | null
          priority: string
          status: string
          target_date: string | null
          title: string
          updated_at: string
          workflow_step: string | null
        }
        Insert: {
          area?: string
          created_at?: string
          description?: string | null
          id?: string
          mitigation_owner?: string | null
          priority?: string
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
          workflow_step?: string | null
        }
        Update: {
          area?: string
          created_at?: string
          description?: string | null
          id?: string
          mitigation_owner?: string | null
          priority?: string
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
          workflow_step?: string | null
        }
        Relationships: []
      }
      supplier_issues: {
        Row: {
          assigned_to: string | null
          attachments: string[] | null
          created_at: string
          description: string | null
          escalation_date: string | null
          final_outcome: string | null
          id: string
          is_resolved: boolean | null
          issue_type: string
          linked_renegotiation_id: string | null
          material_id: string | null
          order_reference: string | null
          reported_at: string | null
          reported_by: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          shipment_id: string | null
          source: string | null
          status: string | null
          supplier_id: string
          supplier_justification: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attachments?: string[] | null
          created_at?: string
          description?: string | null
          escalation_date?: string | null
          final_outcome?: string | null
          id?: string
          is_resolved?: boolean | null
          issue_type: string
          linked_renegotiation_id?: string | null
          material_id?: string | null
          order_reference?: string | null
          reported_at?: string | null
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          shipment_id?: string | null
          source?: string | null
          status?: string | null
          supplier_id: string
          supplier_justification?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attachments?: string[] | null
          created_at?: string
          description?: string | null
          escalation_date?: string | null
          final_outcome?: string | null
          id?: string
          is_resolved?: boolean | null
          issue_type?: string
          linked_renegotiation_id?: string | null
          material_id?: string | null
          order_reference?: string | null
          reported_at?: string | null
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          shipment_id?: string | null
          source?: string | null
          status?: string | null
          supplier_id?: string
          supplier_justification?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_issues_linked_renegotiation_id_fkey"
            columns: ["linked_renegotiation_id"]
            isOneToOne: false
            referencedRelation: "material_renegotiations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_issues_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_issues_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_issues_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_issues_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_materials: {
        Row: {
          created_at: string
          delivery_reliability: number | null
          id: string
          last_order_date: string | null
          material_id: string
          notes: string | null
          performance_rating: number | null
          quality_score: number | null
          status: string | null
          supplier_id: string
          total_orders: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_reliability?: number | null
          id?: string
          last_order_date?: string | null
          material_id: string
          notes?: string | null
          performance_rating?: number | null
          quality_score?: number | null
          status?: string | null
          supplier_id: string
          total_orders?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_reliability?: number | null
          id?: string
          last_order_date?: string | null
          material_id?: string
          notes?: string | null
          performance_rating?: number | null
          quality_score?: number | null
          status?: string | null
          supplier_id?: string
          total_orders?: number | null
          updated_at?: string
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
            foreignKeyName: "supplier_materials_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_materials_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_quotation_materials: {
        Row: {
          created_at: string
          id: string
          material_id: string
          quotation_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          quotation_id: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          quotation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quotation_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotation_materials_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "supplier_quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_quotations: {
        Row: {
          created_at: string
          file_name: string
          file_url: string
          id: string
          notes: string | null
          quotation_date: string
          supplier_id: string
          title: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_url: string
          id?: string
          notes?: string | null
          quotation_date: string
          supplier_id: string
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          notes?: string | null
          quotation_date?: string
          supplier_id?: string
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quotations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_zones: {
        Row: {
          created_at: string
          delivery_price: number
          id: string
          supplier_id: string
          updated_at: string
          zone_name: string
        }
        Insert: {
          created_at?: string
          delivery_price: number
          id?: string
          supplier_id: string
          updated_at?: string
          zone_name: string
        }
        Update: {
          created_at?: string
          delivery_price?: number
          id?: string
          supplier_id?: string
          updated_at?: string
          zone_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_zones_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_zones_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          at_risk_since: string | null
          city: string | null
          consecutive_on_time_count: number | null
          contact_person: string | null
          coverage: string[] | null
          created_at: string | null
          email: string | null
          id: string
          is_at_risk: boolean | null
          latitude: number | null
          lead_time_days: number | null
          location: string | null
          longitude: number | null
          name: string
          notes: string | null
          on_time_delivery_percent: number | null
          phone: string | null
          quotation_url: string | null
          rating: number | null
          secondary_phone: string | null
          status: string | null
          supplier_code: string | null
          supplier_type: string | null
          total_orders: number | null
          updated_at: string | null
        }
        Insert: {
          at_risk_since?: string | null
          city?: string | null
          consecutive_on_time_count?: number | null
          contact_person?: string | null
          coverage?: string[] | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_at_risk?: boolean | null
          latitude?: number | null
          lead_time_days?: number | null
          location?: string | null
          longitude?: number | null
          name: string
          notes?: string | null
          on_time_delivery_percent?: number | null
          phone?: string | null
          quotation_url?: string | null
          rating?: number | null
          secondary_phone?: string | null
          status?: string | null
          supplier_code?: string | null
          supplier_type?: string | null
          total_orders?: number | null
          updated_at?: string | null
        }
        Update: {
          at_risk_since?: string | null
          city?: string | null
          consecutive_on_time_count?: number | null
          contact_person?: string | null
          coverage?: string[] | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_at_risk?: boolean | null
          latitude?: number | null
          lead_time_days?: number | null
          location?: string | null
          longitude?: number | null
          name?: string
          notes?: string | null
          on_time_delivery_percent?: number | null
          phone?: string | null
          quotation_url?: string | null
          rating?: number | null
          secondary_phone?: string | null
          status?: string | null
          supplier_code?: string | null
          supplier_type?: string | null
          total_orders?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      system_tasks: {
        Row: {
          assigned_to_role: string | null
          assigned_to_user: string | null
          created_at: string
          description: string | null
          id: string
          related_entity_id: string | null
          related_entity_type: string | null
          status: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to_role?: string | null
          assigned_to_user?: string | null
          created_at?: string
          description?: string | null
          id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string
          task_type: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to_role?: string | null
          assigned_to_user?: string | null
          created_at?: string
          description?: string | null
          id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_role_changes: {
        Row: {
          changed_by: string
          created_at: string
          id: string
          new_role: Database["public"]["Enums"]["app_role"]
          previous_role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          changed_by: string
          created_at?: string
          id?: string
          new_role: Database["public"]["Enums"]["app_role"]
          previous_role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          id?: string
          new_role?: Database["public"]["Enums"]["app_role"]
          previous_role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
      zones: {
        Row: {
          city: string | null
          created_at: string
          id: string
          name: string
          region: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          name: string
          region?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      supplier_stats: {
        Row: {
          id: string | null
          name: string | null
          total_communications: number | null
          total_order_value: number | null
          total_quotations: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_user_role: {
        Args: {
          check_role: Database["public"]["Enums"]["app_role"]
          check_user_id: string
        }
        Returns: boolean
      }
      generate_deal_id: { Args: never; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      generate_shipment_code: { Args: never; Returns: string }
      generate_supplier_code: { Args: never; Returns: string }
      get_user_role: {
        Args: { check_user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      app_role: "admin" | "procurement_officer" | "viewer" | "operations"
      communication_status:
        | "Open"
        | "Closed"
        | "In Follow-up"
        | "Done"
        | "Cancelled"
      period_type: "Monthly" | "Quarterly" | "Yearly"
      renegotiation_approval_status:
        | "pending_supply_head"
        | "pending_management"
        | "approved"
        | "rejected"
        | "active"
      transportation_type:
        | "Flatbed"
        | "Mixer"
        | "Trailer"
        | "Box Truck"
        | "Van"
        | "Crane-assisted Flatbed"
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
      app_role: ["admin", "procurement_officer", "viewer", "operations"],
      communication_status: [
        "Open",
        "Closed",
        "In Follow-up",
        "Done",
        "Cancelled",
      ],
      period_type: ["Monthly", "Quarterly", "Yearly"],
      renegotiation_approval_status: [
        "pending_supply_head",
        "pending_management",
        "approved",
        "rejected",
        "active",
      ],
      transportation_type: [
        "Flatbed",
        "Mixer",
        "Trailer",
        "Box Truck",
        "Van",
        "Crane-assisted Flatbed",
      ],
    },
  },
} as const
