import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-agent-key",
};

interface ResolveRequest {
  entity_type: "customer" | "project" | "opportunity";
  query: string;
  limit?: number;
  session_context?: {
    resolved_customer_id?: string | null;
    resolved_project_id?: string | null;
    resolved_opportunity_id?: string | null;
  };
}

interface MatchItem {
  id: string;
  label: string;
  code: string;
  subtitle: string;
  confidence: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: ResolveRequest = await req.json();
    const { entity_type, query, limit = 5, session_context } = body;

    if (!entity_type || !query?.trim()) {
      return new Response(
        JSON.stringify({ error: "entity_type and query are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const q = query.trim();
    const maxResults = Math.min(limit, 10);
    const matches: MatchItem[] = [];

    // ── Check for exact code match first ──
    const isCode = /^(SAL|MAT|SUP)\./i.test(q);

    if (entity_type === "customer") {
      // Exact code match
      if (isCode) {
        const { data: exact } = await supabase
          .from("accounts")
          .select("id, display_name, code, status")
          .ilike("code", q)
          .is("deleted_at", null)
          .limit(1);
        if (exact?.length) {
          matches.push({
            id: exact[0].id,
            label: exact[0].display_name || "",
            code: exact[0].code || "",
            subtitle: exact[0].status || "active",
            confidence: 1.0,
          });
        }
      }

      // Fuzzy search
      if (matches.length < maxResults) {
        const existingIds = new Set(matches.map(m => m.id));
        const { data: fuzzy } = await supabase
          .from("accounts")
          .select("id, display_name, display_name_ar, code, status")
          .is("deleted_at", null)
          .or(`display_name.ilike.%${q}%,display_name_ar.ilike.%${q}%,code.ilike.%${q}%,legal_name.ilike.%${q}%`)
          .limit(maxResults);
        
        for (const row of fuzzy || []) {
          if (existingIds.has(row.id)) continue;
          const nameMatch = row.display_name?.toLowerCase().includes(q.toLowerCase());
          const exactNameMatch = row.display_name?.toLowerCase() === q.toLowerCase();
          matches.push({
            id: row.id,
            label: row.display_name || "",
            code: row.code || "",
            subtitle: row.status || "active",
            confidence: exactNameMatch ? 0.95 : nameMatch ? 0.8 : 0.6,
          });
        }
      }
    } else if (entity_type === "project") {
      const scopeCustomerId = session_context?.resolved_customer_id;

      if (isCode) {
        const { data: exact } = await supabase
          .from("projects")
          .select("id, name, code, customer_account_id")
          .ilike("code", q)
          .is("deleted_at", null)
          .limit(1);
        if (exact?.length) {
          matches.push({
            id: exact[0].id,
            label: exact[0].name,
            code: exact[0].code || "",
            subtitle: "",
            confidence: 1.0,
          });
        }
      }

      if (matches.length < maxResults) {
        const existingIds = new Set(matches.map(m => m.id));
        let dbQuery = supabase
          .from("projects")
          .select("id, name, name_ar, code, customer_account_id, current_phase")
          .is("deleted_at", null)
          .or(`name.ilike.%${q}%,name_ar.ilike.%${q}%,code.ilike.%${q}%`);
        if (scopeCustomerId) dbQuery = dbQuery.eq("customer_account_id", scopeCustomerId);
        const { data: fuzzy } = await dbQuery.limit(maxResults);
        
        for (const row of fuzzy || []) {
          if (existingIds.has(row.id)) continue;
          const exactNameMatch = row.name?.toLowerCase() === q.toLowerCase();
          matches.push({
            id: row.id,
            label: row.name,
            code: row.code || "",
            subtitle: row.current_phase || "",
            confidence: exactNameMatch ? 0.95 : 0.7,
          });
        }
      }
    } else if (entity_type === "opportunity") {
      const scopeCustomerId = session_context?.resolved_customer_id;
      const scopeProjectId = session_context?.resolved_project_id;

      if (isCode) {
        const { data: exact } = await supabase
          .from("opportunities")
          .select("id, title, code, stage, status, customer_account_id, accounts:customer_account_id(display_name)")
          .ilike("code", q)
          .is("deleted_at", null)
          .limit(1);
        if (exact?.length) {
          const custName = (exact[0] as any).accounts?.display_name || "";
          matches.push({
            id: exact[0].id,
            label: exact[0].title,
            code: exact[0].code || "",
            subtitle: `${exact[0].stage} • ${exact[0].status} • ${custName}`,
            confidence: 1.0,
          });
        }
      }

      if (matches.length < maxResults) {
        const existingIds = new Set(matches.map(m => m.id));
        let dbQuery = supabase
          .from("opportunities")
          .select("id, title, code, stage, status, customer_account_id, accounts:customer_account_id(display_name)")
          .is("deleted_at", null)
          .or(`title.ilike.%${q}%,code.ilike.%${q}%`);
        if (scopeCustomerId) dbQuery = dbQuery.eq("customer_account_id", scopeCustomerId);
        if (scopeProjectId) dbQuery = dbQuery.eq("project_id", scopeProjectId);
        const { data: fuzzy } = await dbQuery.limit(maxResults);
        
        for (const row of fuzzy || []) {
          if (existingIds.has(row.id)) continue;
          const custName = (row as any).accounts?.display_name || "";
          const exactTitleMatch = row.title?.toLowerCase() === q.toLowerCase();
          matches.push({
            id: row.id,
            label: row.title,
            code: row.code || "",
            subtitle: `${row.stage} • ${row.status} • ${custName}`,
            confidence: exactTitleMatch ? 0.95 : 0.7,
          });
        }
      }
    }

    // Sort by confidence descending
    matches.sort((a, b) => b.confidence - a.confidence);

    return new Response(
      JSON.stringify({ matches: matches.slice(0, maxResults) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
