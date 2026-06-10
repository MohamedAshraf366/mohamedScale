import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-agent-key",
};

// Whitelist of tables the agent can read from (for legacy table+filters mode)
const ALLOWED_TABLES = new Set([
  "accounts", "contacts", "customers", "customer_list_v1",
  "projects", "opportunities", "communications", "tasks",
  "quotations", "quotation_items", "locations",
  "materials", "material_categories", "material_subcategories",
  "agent_actions", "agent_table_schema",
]);

// Max rows per query (legacy table mode only)
const MAX_LIMIT = 100;

// Write-keyword blocklist for SQL validation
const WRITE_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXECUTE)\b/i;

interface ReadRequest {
  table?: string;
  columns?: string;
  filters?: Array<{
    column: string;
    operator: string;
    value: unknown;
  }>;
  order_by?: { column: string; ascending?: boolean };
  limit?: number;
  smart_query?: string;
  entity_id?: string;
  document_type?: "quotation" | "pricelist";
  sql?: string;
}

function validateReadOnlySQL(sql: string): void {
  const trimmed = sql.trim();
  if (!/^\s*(SELECT|WITH)\b/i.test(trimmed)) {
    throw new Error("Only SELECT queries are allowed");
  }
  if (WRITE_KEYWORDS.test(trimmed)) {
    throw new Error("Write operations are not allowed in SQL queries");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: ReadRequest = await req.json();

    // ── Mode 1: Direct SQL ──
    if (body.sql) {
      validateReadOnlySQL(body.sql);
      const { data, error } = await supabase.rpc("execute_readonly_sql", { query: body.sql });
      if (error) throw error;
      const rows = data || [];
      return new Response(
        JSON.stringify({ data: rows, row_count: Array.isArray(rows) ? rows.length : 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Mode 2: Smart queries ──
    if (body.smart_query) {
      const result = await handleSmartQuery(supabase, body.smart_query, body.entity_id, body.document_type);
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Mode 3: Table + filters (legacy) ──
    if (!body.table || !ALLOWED_TABLES.has(body.table)) {
      return new Response(
        JSON.stringify({ error: `Table '${body.table}' not allowed. Allowed: ${[...ALLOWED_TABLES].join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const limit = Math.min(body.limit || 50, MAX_LIMIT);
    const columns = body.columns || "*";

    let query = supabase.from(body.table).select(columns);

    if (body.filters) {
      for (const f of body.filters) {
        const op = f.operator || "eq";
        switch (op) {
          case "eq": query = query.eq(f.column, f.value); break;
          case "neq": query = query.neq(f.column, f.value); break;
          case "gt": query = query.gt(f.column, f.value); break;
          case "gte": query = query.gte(f.column, f.value); break;
          case "lt": query = query.lt(f.column, f.value); break;
          case "lte": query = query.lte(f.column, f.value); break;
          case "like": query = query.like(f.column, f.value as string); break;
          case "ilike": query = query.ilike(f.column, f.value as string); break;
          case "is": query = query.is(f.column, f.value as null); break;
          case "in": query = query.in(f.column, f.value as unknown[]); break;
          default: break;
        }
      }
    }

    if (body.order_by) {
      query = query.order(body.order_by.column, { ascending: body.order_by.ascending ?? true });
    }

    query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;

    return new Response(
      JSON.stringify({ data, count: data?.length || 0, limit }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Smart query handlers (unchanged) ──

async function handleSmartQuery(supabase: any, query: string, entityId?: string, documentType?: string) {
  switch (query) {
    case "customer_summary": {
      if (!entityId) throw new Error("entity_id required for customer_summary");
      const [account, projects, opps, tasks] = await Promise.all([
        supabase.from("customer_list_v1").select("*").eq("account_id", entityId).single(),
        supabase.from("projects").select("id, name, code, current_phase, project_type").eq("customer_account_id", entityId).is("deleted_at", null),
        supabase.from("opportunities").select("id, title, code, stage, status, interest_level, expected_close_date").eq("customer_account_id", entityId).eq("status", "active").is("deleted_at", null),
        supabase.from("tasks").select("id, title, status, due_at, opportunity_id").eq("customer_account_id", entityId).eq("status", "open"),
      ]);
      return {
        customer: account.data,
        projects: projects.data || [],
        active_opportunities: opps.data || [],
        open_tasks: tasks.data || [],
      };
    }
    case "pipeline_status": {
      const { data } = await supabase
        .from("opportunities")
        .select("id, title, code, stage, status, interest_level, customer_account_id, expected_close_date, accounts!opportunities_customer_account_id_fkey(display_name)")
        .eq("status", "active")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      const stages: Record<string, unknown[]> = {};
      for (const opp of data || []) {
        const s = opp.stage || "discovery";
        if (!stages[s]) stages[s] = [];
        stages[s].push(opp);
      }
      return { pipeline: stages, total: data?.length || 0 };
    }
    case "overdue_tasks": {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, status, due_at, opportunity_id, customer_account_id")
        .eq("status", "open")
        .lt("due_at", new Date().toISOString())
        .order("due_at")
        .limit(50);
      return { overdue_tasks: data || [], count: data?.length || 0 };
    }
    case "recent_activity": {
      const { data } = await supabase
        .from("communications")
        .select("id, channel, summary, occurred_at, account_id, opportunity_id")
        .order("occurred_at", { ascending: false })
        .limit(20);
      return { recent_activity: data || [] };
    }
    case "get_document_v2": {
      if (!entityId) throw new Error("entity_id (opportunity_id) required for get_document_v2");
      const docType = documentType || "quotation";
      const isSoft = docType === "pricelist";

      const { data: quot } = await supabase
        .from("quotations")
        .select("id, code, version, sent_at, subtotal, delivery_total, total, is_soft, created_at, updated_at")
        .eq("opportunity_id", entityId)
        .eq("is_soft", isSoft)
        .limit(1)
        .maybeSingle();

      if (!quot) {
        return { error: `No ${docType} found for this opportunity`, document: null, items: [] };
      }

      const { data: items } = await supabase
        .from("quotation_items")
        .select("id, material_id, supplier_material_id, quantity, unit_price, delivery_price, line_total, status, materials(name, name_en, name_ar, code, uom)")
        .eq("quotation_id", quot.id)
        .eq("status", "active");

      const { data: opp } = await supabase
        .from("opportunities")
        .select("title, code, customer_account_id, project_id, accounts!opportunities_customer_account_id_fkey(display_name)")
        .eq("id", entityId)
        .single();

      const pdfUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-quotation-pdf?opportunity_id=${entityId}&is_soft=${isSoft}&draft=true`;

      return {
        document: quot,
        items: items || [],
        opportunity: opp,
        item_count: items?.length || 0,
        is_draft: !quot.sent_at,
        pdf_url: pdfUrl,
        message: quot.sent_at
          ? `${docType === "pricelist" ? "Price list" : "Quotation"} was sent on ${quot.sent_at}`
          : `Draft ${docType} with ${items?.length || 0} items. Total: ${quot.total || 0} SAR`,
      };
    }
    case "decode_code": {
      if (!entityId) throw new Error("entity_id (the code string) required for decode_code");
      const code = entityId.trim();

      const domainPrefix = code.split(".")[0];
      type CodeDomain = "MAT" | "SAL" | "SUP" | "unknown";
      const domain: CodeDomain = (["MAT", "SAL", "SUP"].includes(domainPrefix) ? domainPrefix : "unknown") as CodeDomain;

      const BLOCK_TYPE: Record<string, string> = { "1": "Regular", "2": "Steamed", "3": "Volcanic" };
      const INSULATION: Record<string, string> = { "1": "Uninsulated", "2": "Sandwich Blue", "3": "Sandwich White", "4": "Inserted Blue", "5": "Inserted White" };
      const HOLES: Record<string, string> = { "0": "Solid (0)", "1": "2 Holes", "2": "3 Holes", "3": "4 Holes", "4": "6 Holes", "5": "8 Holes", "6": "10 Holes", "7": "12 Holes" };
      const CATEGORY: Record<string, string> = { "BB": "Blocks & Bricks" };

      interface Segment { label: string; value: string; meaning: string }
      const segments: Segment[] = [];

      if (domain === "MAT") {
        const m = code.match(/^MAT\.([A-Z]{2})\.(\d{2})\.(\d)(\d)(\d)\.(\d{2})$/);
        if (!m) return { code, domain, valid: false, error: "Invalid MAT format. Expected MAT.XX.NN.NNN.NN" };
        segments.push(
          { label: "Domain", value: "MAT", meaning: "Materials" },
          { label: "Category", value: m[1], meaning: CATEGORY[m[1]] || m[1] },
          { label: "Subcategory", value: m[2], meaning: `Subcategory ${m[2]}` },
          { label: "Type", value: m[3], meaning: BLOCK_TYPE[m[3]] || "Unknown" },
          { label: "Insulation", value: m[4], meaning: INSULATION[m[4]] || "Unknown" },
          { label: "Holes", value: m[5], meaning: HOLES[m[5]] || "Unknown" },
          { label: "Size", value: m[6], meaning: `${parseInt(m[6])} cm` },
        );
      } else if (domain === "SAL") {
        const rest = code.substring(4);
        const docMatch = rest.match(/^(.+)_(QOT|PL|INV)\.(\d{3})$/);
        segments.push({ label: "Domain", value: "SAL", meaning: "Sales" });
        if (docMatch) {
          const parts = docMatch[1].split("_");
          segments.push({ label: "Customer", value: parts[0], meaning: `Customer #${parseInt(parts[0])}` });
          if (parts[1]) segments.push({ label: "Project", value: parts[1], meaning: `Project #${parseInt(parts[1])}` });
          if (parts[2]) segments.push({ label: "Opportunity/Order", value: parts[2], meaning: `Entity #${parseInt(parts[2])}` });
          const docLabel = docMatch[2] === "QOT" ? "Quotation" : docMatch[2] === "PL" ? "Price List" : "Invoice";
          segments.push({ label: "Doc Type", value: docMatch[2], meaning: docLabel });
          segments.push({ label: "Doc #", value: docMatch[3], meaning: `${docLabel} #${parseInt(docMatch[3])}` });
        } else {
          const parts = rest.split("_");
          segments.push({ label: "Customer", value: parts[0], meaning: `Customer #${parseInt(parts[0])}` });
          if (parts[1]) segments.push({ label: "Project", value: parts[1], meaning: `Project #${parseInt(parts[1])}` });
          if (parts[2]) segments.push({ label: "Opportunity/Order", value: parts[2], meaning: `Entity #${parseInt(parts[2])}` });
        }
      } else if (domain === "SUP") {
        const m = code.match(/^SUP\.([A-Z]{3})\.(\d{3})$/);
        if (!m) return { code, domain, valid: false, error: "Invalid SUP format. Expected SUP.XXX.NNN" };
        segments.push(
          { label: "Domain", value: "SUP", meaning: "Supplier" },
          { label: "Region", value: m[1], meaning: `Region: ${m[1]}` },
          { label: "Sequence", value: m[2], meaning: `Supplier #${parseInt(m[2])}` },
        );
      } else {
        return { code, domain: "unknown", valid: false, error: "Code must start with MAT., SAL., or SUP." };
      }

      return { code, domain, valid: true, segments };
    }
    default:
      throw new Error(`Unknown smart_query: ${query}. Available: customer_summary, pipeline_status, overdue_tasks, recent_activity, get_document_v2, decode_code`);
  }
}
