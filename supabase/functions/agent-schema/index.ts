import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-agent-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all data sources in parallel
    const [actionsResult, schemasResult, fullSchemaResult] = await Promise.all([
      // 1. Active intents
      supabase
        .from("agent_actions")
        .select("intent_key, title_en, title_ar, tool_name, tables, main_fields, keywords, example_phrases_en, example_phrases_ar")
        .eq("status", "active")
        .order("menu_order"),
      // 2. Curated table schemas
      supabase
        .from("agent_table_schema")
        .select("*")
        .eq("module", "sales"),
      // 3. Dynamic full DB schema
      supabase.rpc("get_full_schema"),
    ]);

    if (actionsResult.error) throw actionsResult.error;
    if (schemasResult.error) throw schemasResult.error;

    const actions = actionsResult.data;
    const schemas = schemasResult.data;
    const database_schema = fullSchemaResult.data || { tables: {}, foreign_keys: [], enums: {} };

    // 3. Enum values (static, matching the UI)
    const enums = {
      interest_levels: ["Very interested", "Interested", "Medium", "Low interest", "Not interested"],
      opportunity_stages: ["discovery", "rfp", "negotiation", "won", "lost"],
      opportunity_status: ["active", "closed"],
      priority: ["low", "medium", "high", "urgent"],
      customer_types: ["SME", "Enterprise", "Government", "Individual"],
      lifecycle_stages: ["lead", "prospect", "active", "churned"],
      communication_channels: ["whatsapp", "phone", "email", "meeting", "site_visit", "internal"],
      project_types: ["residential", "commercial", "industrial", "infrastructure", "government"],
      project_phases: ["design", "tender", "foundation", "structure", "finishing", "handover"],
      project_sizes: ["small", "medium", "large", "mega"],
      task_types: {
        values: [
          { value: "call_client", label: "Call Client" },
          { value: "send_quote", label: "Send Quotation" },
          { value: "schedule_meeting", label: "Schedule Meeting" },
          { value: "site_visit", label: "Site Visit" },
          { value: "send_samples", label: "Send Samples" },
          { value: "follow_up_whatsapp", label: "Follow Up (WhatsApp)" },
          { value: "internal_review", label: "Internal Review" },
          { value: "custom", label: "Custom" },
        ],
        note: "Virtual labels for the agent. All map to DB task_type='follow_up'. The value is stored in the task title.",
      },
      quotation_statuses: ["draft", "sent", "accepted", "rejected", "expired"],
      lost_reasons: [
        "Price too high",
        "Already has a supplier",
        "Project delayed / on hold",
        "Project cancelled",
        "No budget",
        "Bad past experience",
        "Competitor won the deal",
        "Materials not available",
        "Location not serviced",
        "No response / unreachable",
        "Other",
      ],
    };

    // 4. Smart queries contract
    const smart_queries = {
      customer_summary: {
        required_params: ["entity_id"],
        optional_params: [],
        entity_type: "account",
        description: "Account + projects + active opportunities + open tasks",
        when_to_use: "Only when one exact account is already resolved",
        fallback: "raw_table_query",
      },
      pipeline_status: {
        required_params: [],
        optional_params: [],
        entity_type: null,
        description: "All active opportunities grouped by stage",
      },
      overdue_tasks: {
        required_params: [],
        optional_params: [],
        entity_type: null,
        description: "Open tasks past due date",
      },
      recent_activity: {
        required_params: [],
        optional_params: [],
        entity_type: null,
        description: "Recent communications",
      },
      get_document_v2: {
        required_params: ["entity_id", "document_type"],
        optional_params: [],
        entity_type: "opportunity",
        description: "Draft quotation/pricelist preview",
      },
      decode_code: {
        required_params: ["entity_id"],
        optional_params: [],
        entity_type: null,
        description: "Decode a Scale code (MAT.*/SAL.*/SUP.*) into labelled segments with human-readable meanings. Pass the code string as entity_id.",
        example: { smart_query: "decode_code", entity_id: "MAT.BB.01.110.20" },
      },
    };

    // 5. Schema guide
    const schema_guide = {
      tables: {
        customers: {
          identifier_column: "account_id",
          count_column: "account_id",
          display_column: "account_id",
          searchable_columns: ["account_id", "customer_type", "lifecycle_stage"],
          filterable_columns: ["account_id", "customer_type", "lifecycle_stage", "assigned_to"],
          default_select: ["account_id", "customer_type", "lifecycle_stage"],
          default_order_by: null,
        },
        accounts: {
          identifier_column: "id",
          count_column: "id",
          display_column: "display_name",
          searchable_columns: ["id", "code", "display_name", "display_name_ar", "legal_name", "tax_number"],
          filterable_columns: ["id", "code", "display_name", "display_name_ar", "legal_name", "status", "tax_number"],
          default_select: ["id", "display_name", "code", "status"],
          default_order_by: { column: "display_name", ascending: true },
        },
        projects: {
          identifier_column: "id",
          count_column: "id",
          display_column: "name",
          searchable_columns: ["id", "name", "name_ar", "code"],
          filterable_columns: ["id", "customer_account_id", "project_type", "current_phase", "code"],
          default_select: ["id", "name", "code", "customer_account_id", "current_phase"],
          default_order_by: { column: "name", ascending: true },
        },
        opportunities: {
          identifier_column: "id",
          count_column: "id",
          display_column: "title",
          searchable_columns: ["id", "title", "code"],
          filterable_columns: ["id", "customer_account_id", "project_id", "stage", "status", "interest_level", "assigned_to"],
          default_select: ["id", "title", "code", "stage", "status", "interest_level"],
          default_order_by: { column: "created_at", ascending: false },
        },
        communications: {
          identifier_column: "id",
          count_column: "id",
          display_column: "subject",
          searchable_columns: ["id", "subject", "summary"],
          filterable_columns: ["id", "account_id", "opportunity_id", "project_id", "channel", "direction"],
          default_select: ["id", "channel", "subject", "summary", "occurred_at"],
          default_order_by: { column: "occurred_at", ascending: false },
        },
        communication_action_items: {
          identifier_column: "id",
          count_column: "id",
          display_column: "title",
          searchable_columns: ["id", "title"],
          filterable_columns: ["id", "communication_id", "status", "priority", "assigned_to"],
          default_select: ["id", "title", "status", "priority", "due_at"],
          default_order_by: { column: "due_at", ascending: true },
        },
        contacts: {
          identifier_column: "id",
          count_column: "id",
          display_column: "full_name",
          searchable_columns: ["id", "full_name", "full_name_ar", "phone", "email"],
          filterable_columns: ["id", "account_id", "is_primary"],
          default_select: ["id", "full_name", "phone", "email", "is_primary"],
          default_order_by: { column: "full_name", ascending: true },
        },
        quotations: {
          identifier_column: "id",
          count_column: "id",
          display_column: "code",
          searchable_columns: ["id", "code"],
          filterable_columns: ["id", "opportunity_id", "status", "version"],
          default_select: ["id", "code", "status", "version", "total"],
          default_order_by: { column: "version", ascending: false },
        },
        customer_list_v1: {
          identifier_column: "account_id",
          count_column: "account_id",
          display_column: "display_name",
          searchable_columns: ["account_id", "display_name", "legal_name", "primary_contact_full_name", "primary_contact_phone"],
          filterable_columns: ["account_id", "customer_type", "lifecycle_stage", "location_city"],
          default_select: ["account_id", "display_name", "customer_type", "lifecycle_stage", "primary_contact_full_name", "primary_contact_phone"],
          default_order_by: { column: "display_name", ascending: true },
          note: "Read-only view. Preferred for customer listing and search.",
        },
      },
    };

    // 6. Entity resolution guide
    const entity_resolution = {
      customer: {
        lookup_table: "accounts",
        id_column: "id",
        display_column: "display_name",
        search_columns: ["display_name", "display_name_ar", "code", "legal_name"],
        preferred_read_path: {
          table: "accounts",
          columns: "id,display_name,code",
          limit: 10,
        },
      },
      opportunity: {
        lookup_table: "opportunities",
        id_column: "id",
        display_column: "title",
        search_columns: ["title", "code"],
        preferred_read_path: {
          table: "opportunities",
          columns: "id,title,code,stage,status",
          limit: 10,
        },
      },
      project: {
        lookup_table: "projects",
        id_column: "id",
        display_column: "name",
        search_columns: ["name", "name_ar", "code"],
        preferred_read_path: {
          table: "projects",
          columns: "id,name,code,customer_account_id",
          limit: 10,
        },
      },
    };

    // 7. Write contracts
    const write_contracts = {
      create_entity_v2: {
        step: "prepare",
        requires_actor: true,
        payload_shape: {
          customer: { display_name: "string", customer_type: "enum:customer_types", contact_phone: "string" },
          project: { name: "string", project_type: "enum:project_types", current_phase: "enum:project_phases", location: "LocationResult | null" },
          opportunity: { title: "string", interest_level: "enum:interest_levels", notInterestedReason: "enum:lost_reasons (required if interest_level='Not interested')", est_order_date: "date | null", contact_id: "uuid | null" },
          context: { channel: "enum:communication_channels", summary: "string", occurred_at: "timestamp | null" },
          actions: [{ taskType: "enum:task_types.value", customTitle: "string (if taskType=custom)", dueDate: "date" }],
        },
        required_paths: [
          "customer",
          "context.summary",
          "context.channel",
          "actions[0].taskType",
          "actions[0].dueDate",
        ],
        notes: "Project location is mandatory. If interest_level='Not interested', actions[] can be empty but notInterestedReason is required.",
      },
      log_update_v2: {
        step: "prepare",
        requires_actor: true,
        payload_shape: {
          entity_type: "customer | project | opportunity",
          entity_id: "uuid",
          updates: "object (fields to patch; includes notInterestedReason: enum:lost_reasons when setting interest_level='Not interested')",
          context: { channel: "enum:communication_channels", summary: "string" },
          actions: [{ taskType: "enum:task_types.value", dueDate: "date" }],
        },
        required_paths: ["entity_type", "entity_id", "context.summary", "context.channel"],
        notes: "Actions required unless interest_level='Not interested'.",
      },
      mark_won_v2: {
        step: "prepare",
        requires_actor: true,
        payload_shape: {
          opportunity_id: "uuid",
          context: { summary: "string" },
        },
        required_paths: ["opportunity_id", "context.summary"],
        prerequisites: "Opportunity must have a sent quotation (stage >= negotiation).",
      },
      mark_lost_v2: {
        step: "prepare",
        requires_actor: true,
        payload_shape: {
          opportunity_id: "uuid",
          lost_reason: "enum:lost_reasons",
          context: { summary: "string" },
        },
        required_paths: ["opportunity_id", "lost_reason", "context.summary"],
      },
      send_document_v2: {
        step: "prepare",
        requires_actor: true,
        payload_shape: {
          opportunity_id: "uuid",
          document_type: "quotation | pricelist",
          contact_id: "uuid",
          channel: "whatsapp | email",
        },
        required_paths: ["opportunity_id", "document_type", "contact_id", "channel"],
      },
    };

    // 8. Coding system reference (comprehensive)
    const coding_system = {
      overview: "All entity codes are auto-generated by 8 INSERT triggers. Codes are READ-ONLY for users/agents.",
      separators: {
        ".": "Structural separator (internal, non-detachable). E.g. MAT.BB.01.110.20",
        "_": "Hierarchical separator (detachable relationship). E.g. SAL.0178_001_001",
      },
      domains: {
        MAT: {
          pattern: "MAT.{cat2}.{subcat2}.{type1}{insul1}{holes1}.{size2}",
          example: "MAT.BB.01.110.20",
          description: "Material code. Each segment encodes a physical property.",
          segments: {
            cat2: { label: "Category (2-char)", values: { BB: "Blocks & Bricks" } },
            subcat2: { label: "Subcategory (2-digit)", note: "Maps to material_subcategories.subcategory_no" },
            type1: {
              label: "Block Type (1-digit)",
              values: { "1": "Regular", "2": "Steamed", "3": "Volcanic" },
            },
            insul1: {
              label: "Insulation (1-digit)",
              values: { "1": "Uninsulated", "2": "Sandwich Blue", "3": "Sandwich White", "4": "Inserted Blue", "5": "Inserted White" },
            },
            holes1: {
              label: "Holes (1-digit)",
              values: { "0": "Solid (0)", "1": "2 Holes", "2": "3 Holes", "3": "4 Holes", "4": "6 Holes", "5": "8 Holes", "6": "10 Holes", "7": "12 Holes" },
            },
            size2: { label: "Size (2-digit, cm)", note: "E.g. 10, 15, 20, 25, 30" },
          },
        },
        SAL: {
          pattern: "SAL.{cust4}_{proj3}_{opp3}",
          pattern_with_doc: "SAL.{cust4}_{proj3}_{opp3}_{QOT|PL|INV}.{seq3}",
          example: "SAL.0178_001_001",
          example_with_doc: "SAL.0178_001_001_QOT.001",
          description: "Sales code. Hierarchical: customer → project → opportunity → document.",
          segments: {
            cust4: { label: "Customer sequence (4-digit)", note: "Auto-incremented per account" },
            proj3: { label: "Project sequence (3-digit)", note: "Auto-incremented per customer" },
            opp3: { label: "Opportunity sequence (3-digit)", note: "Auto-incremented per project" },
            doc_type: { label: "Document type", values: { QOT: "Quotation", PL: "Price List", INV: "Invoice" } },
            seq3: { label: "Document sequence (3-digit)", note: "Auto-incremented per opportunity/type" },
          },
        },
        SUP: {
          pattern: "SUP.{region3}.{seq3}",
          example: "SUP.RIY.001",
          description: "Supplier code. Region-based with sequence.",
          segments: {
            region3: { label: "Region code (3-char)", note: "Matches regions.code (e.g. RIY, JED, DMM)" },
            seq3: { label: "Supplier sequence (3-digit)", note: "Auto-incremented per region" },
          },
        },
      },
    };

    // 9. Read modes documentation
    const read_modes = {
      sql: {
        description: "Direct SQL mode — send any SELECT query. No row limit. 10s timeout.",
        safety: "Only SELECT/WITH allowed. INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, GRANT, REVOKE, EXECUTE are blocked at both edge function and DB function level.",
        example: { sql: "SELECT a.display_name, COUNT(o.id) as opp_count FROM accounts a LEFT JOIN opportunities o ON o.customer_account_id = a.id WHERE a.status = 'active' GROUP BY a.display_name ORDER BY opp_count DESC" },
      },
      smart_query: {
        description: "Pre-built queries for common patterns. See smart_queries section for details.",
        example: { smart_query: "customer_summary", entity_id: "<account_id>" },
      },
      table_filters: {
        description: "Legacy mode — query whitelisted tables with column filters. Max 100 rows.",
        example: { table: "accounts", columns: "id, display_name, code", filters: [{ column: "status", operator: "eq", value: "active" }], limit: 10 },
      },
    };

    // 10. Write engine v3 (new canonical endpoints)
    const write_engine = {
      prepare_endpoint: "/global-activity",
      commit_endpoint: "/global-activity",
      resolver_endpoint: "/resolve-entity",
      notes: [
        "Write behavior mirrors the platform's GlobalActivitySheet exactly.",
        "prepare response returns one of: needs_input, choose_one, ready, or blocked.",
        "buttons in API response are intended for WhatsApp interactive replies.",
        "commit uses the token from a 'ready' prepare response.",
        "All business rules enforced server-side (stage gates, required fields, Not interested logic).",
      ],
      statuses: {
        needs_input: "Required info is missing. Response includes exact missing fields with bilingual labels, reasons, and examples.",
        choose_one: "User input is ambiguous. Response includes choices[] and buttons[] for disambiguation.",
        ready: "All validated. Response includes token, summary, and can_commit=true.",
        blocked: "Action not allowed by business rules. Response includes warnings with clear reason.",
      },
      intents: ["create_entity_v2", "log_update_v2", "mark_won_v2", "mark_lost_v2", "send_document_v2"],
      entity_modes: {
        chip: "Collapsed read-only chip (entity already resolved, no changes needed)",
        select: "Dropdown to pick existing entity",
        create: "Form to create new entity",
        edit: "Form to edit existing entity",
        default: "Auto-create/use 'General' project (project only)",
        none: "Hidden, not applicable to this operation",
      },
      resolve_entity: {
        description: "Fuzzy entity search with confidence scoring. Returns exact code matches first, then fuzzy matches.",
        input: { entity_type: "customer | project | opportunity", query: "user text or SAL/MAT/SUP code", limit: "number (max 10)", session_context: "optional scoping IDs" },
        output: "{ matches: [{ id, label, code, subtitle, confidence }] }",
      },
    };

    const version = "2026-03-11.v4";

    return new Response(
      JSON.stringify({
        version,
        actions,
        schemas,
        enums,
        smart_queries,
        schema_guide,
        entity_resolution,
        write_contracts,
        database_schema,
        coding_system,
        read_modes,
        write_engine,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
