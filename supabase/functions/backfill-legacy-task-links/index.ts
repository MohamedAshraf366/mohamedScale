// Backfill legacy follow-up task linkage (customer / project / opportunity / assignee)
// + tag every touched row with metadata.legacy_migration = true
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(";");
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => (row[h] = (cols[idx] ?? "").trim()));
    rows.push(row);
  }
  return rows;
}

const norm = (v: string | null | undefined) => (v && v.length > 0 ? v : null);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json().catch(() => ({}));
    const tasksCsv: string | undefined = body.tasks_csv;
    const clientsCsv: string | undefined = body.clients_csv;
    const profilesCsv: string | undefined = body.profiles_csv;
    if (!tasksCsv || !clientsCsv) {
      return new Response(JSON.stringify({ error: "tasks_csv and clients_csv required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tasksRows = parseCsv(tasksCsv);
    const clientsRows = parseCsv(clientsCsv);
    const legacyProfilesRows = profilesCsv ? parseCsv(profilesCsv) : [];

    // legacy_client_id -> client_code (e.g. "SAL-0077")
    const clientCodeByLegacyId = new Map<string, string>();
    for (const c of clientsRows) {
      if (c.id && c.client_code) clientCodeByLegacyId.set(c.id, c.client_code);
    }

    // Build lookup maps from DB
    const [oppRes, projRes, projPkRes, accCodeRes] = await Promise.all([
      supabase.from("opportunities").select("id, customer_account_id, project_id, metadata"),
      supabase.from("projects").select("id, customer_account_id, metadata"),
      supabase.from("projects").select("id, customer_account_id"),
      supabase.from("accounts").select("id, code"),
    ]);

    const oppByLegacy = new Map<string, { id: string; customer_account_id: string; project_id: string | null }>();
    for (const o of oppRes.data ?? []) {
      const legacyId = (o.metadata as any)?.legacy_id;
      if (legacyId) oppByLegacy.set(legacyId, { id: o.id, customer_account_id: o.customer_account_id, project_id: o.project_id });
    }

    const projByLegacy = new Map<string, { id: string; customer_account_id: string }>();
    const projByPk = new Map<string, { id: string; customer_account_id: string }>();
    for (const p of projRes.data ?? []) {
      const legacyId = (p.metadata as any)?.legacy_id;
      if (legacyId) projByLegacy.set(legacyId, { id: p.id, customer_account_id: p.customer_account_id });
    }
    for (const p of projPkRes.data ?? []) {
      projByPk.set(p.id, { id: p.id, customer_account_id: p.customer_account_id });
    }

    // accounts.code "SAL.0077" — match against transformed client_code "SAL-0077" -> "SAL.0077"
    const accByCode = new Map<string, string>();
    for (const a of accCodeRes.data ?? []) {
      if (a.code) accByCode.set(a.code, a.id);
    }
    const accountIdByLegacyCode = (legacyCode: string) => {
      const transformed = legacyCode.replace(/-/g, ".");
      return accByCode.get(transformed) ?? null;
    };

    // Build profile resolver: legacy user_id -> current profile id
    // Uses 3 strategies: direct UUID match, then name-based via legacy profiles CSV
    const { data: profilesFull } = await supabase.from("profiles").select("id, full_name");
    const profileIds = new Set<string>((profilesFull ?? []).map((p) => p.id));

    const normName = (s: string | null | undefined) =>
      (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    const profileIdByName = new Map<string, string>();
    for (const p of profilesFull ?? []) {
      if (p.full_name) profileIdByName.set(normName(p.full_name), p.id);
    }
    // Hand-curated aliases for known name variations between legacy and new profiles
    const NAME_ALIASES: Record<string, string> = {
      "faisal alhumaidi": "faisal humaidi",
    };
    const legacyNameByLegacyId = new Map<string, string>();
    for (const p of legacyProfilesRows) {
      if (p.id && p.full_name) legacyNameByLegacyId.set(p.id, p.full_name);
    }
    const resolveProfileId = (legacyUserId: string | null): { id: string | null; method: string } => {
      if (!legacyUserId) return { id: null, method: "unresolved" };
      if (profileIds.has(legacyUserId)) return { id: legacyUserId, method: "direct_uuid" };
      const legacyName = legacyNameByLegacyId.get(legacyUserId);
      if (!legacyName) return { id: null, method: "unresolved" };
      const key = normName(legacyName);
      const aliased = NAME_ALIASES[key] ?? key;
      const matched = profileIdByName.get(aliased) ?? profileIdByName.get(key);
      return matched ? { id: matched, method: "name_match" } : { id: null, method: "unresolved" };
    };

    // Index CSV tasks by legacy id
    const csvByLegacyId = new Map<string, Record<string, string>>();
    for (const t of tasksRows) if (t.id) csvByLegacyId.set(t.id, t);

    // Load all legacy tasks from DB
    const { data: dbTasks, error: tasksErr } = await supabase
      .from("tasks")
      .select("id, customer_account_id, project_id, opportunity_id, communication_id, assigned_to, metadata, legacy_follow_up_id")
      .not("legacy_follow_up_id", "is", null);

    if (tasksErr) throw tasksErr;

    // Preload parent communications referenced by tasks (for waterfall fallback)
    const commIds = Array.from(new Set((dbTasks ?? []).map((t) => t.communication_id).filter(Boolean) as string[]));
    const commsById = new Map<string, { id: string; account_id: string | null; project_id: string | null; opportunity_id: string | null }>();
    if (commIds.length > 0) {
      // chunk to avoid URL length limits
      const chunkSize = 200;
      for (let i = 0; i < commIds.length; i += chunkSize) {
        const slice = commIds.slice(i, i + chunkSize);
        const { data: comms } = await supabase
          .from("communications")
          .select("id, account_id, project_id, opportunity_id")
          .in("id", slice);
        for (const c of comms ?? []) commsById.set(c.id, c);
      }
    }

    const report = {
      total: dbTasks?.length ?? 0,
      updated: 0,
      already_complete: 0,
      resolution: {
        opportunity: { csv_legacy_id: 0, via_communication: 0, unresolved: 0, already: 0 },
        project: { csv_legacy_id: 0, csv_pk: 0, via_opportunity: 0, via_communication: 0, unresolved: 0, already: 0 },
        customer: { via_opportunity: 0, via_project: 0, via_communication: 0, via_client_code: 0, unresolved: 0, already: 0 },
        assignee: { direct_uuid: 0, name_match: 0, unresolved: 0, already: 0 },
      },
      errors: [] as string[],
      orphans: [] as { task_id: string; legacy_id: string; reason: string }[],
    };

    for (const task of dbTasks ?? []) {
      const legacyId = task.legacy_follow_up_id as string;
      const csv = csvByLegacyId.get(legacyId);
      if (!csv) {
        report.errors.push(`No CSV row for legacy_follow_up_id=${legacyId}`);
        continue;
      }

      const parentComm = task.communication_id ? commsById.get(task.communication_id) : null;
      const update: Record<string, any> = {};
      const method = {
        opportunity: "unresolved" as string,
        project: "unresolved" as string,
        customer: "unresolved" as string,
        assignee: "unresolved" as string,
      };

      // ---- opportunity
      let oppId: string | null = task.opportunity_id ?? null;
      let resolvedOpp = oppId ? oppByLegacy.get([...oppByLegacy.entries()].find(([, v]) => v.id === oppId)?.[0] ?? "") ?? null : null;
      if (oppId) {
        method.opportunity = "already";
        report.resolution.opportunity.already++;
        // try to find the resolved opp record for downstream waterfalls
        for (const [, v] of oppByLegacy) {
          if (v.id === oppId) { resolvedOpp = v; break; }
        }
      } else {
        const csvOpp = norm(csv.opportunity_id);
        if (csvOpp && oppByLegacy.has(csvOpp)) {
          resolvedOpp = oppByLegacy.get(csvOpp)!;
          oppId = resolvedOpp.id;
          update.opportunity_id = oppId;
          method.opportunity = "csv_legacy_id";
          report.resolution.opportunity.csv_legacy_id++;
        } else if (parentComm?.opportunity_id) {
          oppId = parentComm.opportunity_id;
          update.opportunity_id = oppId;
          method.opportunity = "via_communication";
          report.resolution.opportunity.via_communication++;
          for (const [, v] of oppByLegacy) {
            if (v.id === oppId) { resolvedOpp = v; break; }
          }
        } else {
          report.resolution.opportunity.unresolved++;
        }
      }

      // ---- project
      let projId: string | null = task.project_id ?? null;
      let resolvedProj: { id: string; customer_account_id: string } | null = null;
      if (projId) {
        method.project = "already";
        report.resolution.project.already++;
        resolvedProj = projByPk.get(projId) ?? null;
      } else {
        const csvProj = norm(csv.project_id);
        if (csvProj && projByLegacy.has(csvProj)) {
          resolvedProj = projByLegacy.get(csvProj)!;
          projId = resolvedProj.id;
          update.project_id = projId;
          method.project = "csv_legacy_id";
          report.resolution.project.csv_legacy_id++;
        } else if (csvProj && projByPk.has(csvProj)) {
          resolvedProj = projByPk.get(csvProj)!;
          projId = resolvedProj.id;
          update.project_id = projId;
          method.project = "csv_pk";
          report.resolution.project.csv_pk++;
        } else if (resolvedOpp?.project_id) {
          projId = resolvedOpp.project_id;
          update.project_id = projId;
          method.project = "via_opportunity";
          report.resolution.project.via_opportunity++;
          resolvedProj = projByPk.get(projId) ?? null;
        } else if (parentComm?.project_id) {
          projId = parentComm.project_id;
          update.project_id = projId;
          method.project = "via_communication";
          report.resolution.project.via_communication++;
          resolvedProj = projByPk.get(projId) ?? null;
        } else {
          report.resolution.project.unresolved++;
        }
      }

      // ---- customer
      let custId: string | null = task.customer_account_id ?? null;
      if (custId) {
        method.customer = "already";
        report.resolution.customer.already++;
      } else if (resolvedOpp?.customer_account_id) {
        custId = resolvedOpp.customer_account_id;
        update.customer_account_id = custId;
        method.customer = "via_opportunity";
        report.resolution.customer.via_opportunity++;
      } else if (resolvedProj?.customer_account_id) {
        custId = resolvedProj.customer_account_id;
        update.customer_account_id = custId;
        method.customer = "via_project";
        report.resolution.customer.via_project++;
      } else if (parentComm?.account_id) {
        custId = parentComm.account_id;
        update.customer_account_id = custId;
        method.customer = "via_communication";
        report.resolution.customer.via_communication++;
      } else {
        // legacy client_id from CSV -> client_code -> accounts.code (dash → dot)
        const legacyClientId = norm(csv.client_id) || norm((csv as any).legacy_client_id);
        const legacyCode = legacyClientId ? clientCodeByLegacyId.get(legacyClientId) : null;
        const accId = legacyCode ? accountIdByLegacyCode(legacyCode) : null;
        if (accId) {
          custId = accId;
          update.customer_account_id = custId;
          method.customer = "via_client_code";
          report.resolution.customer.via_client_code++;
        } else {
          report.resolution.customer.unresolved++;
        }
      }

      // ---- assignee
      let assigneeId: string | null = task.assigned_to ?? null;
      if (assigneeId) {
        method.assignee = "already";
        report.resolution.assignee.already++;
      } else {
        const legacyUserId = norm(csv.user_id);
        const resolved = resolveProfileId(legacyUserId);
        if (resolved.id) {
          assigneeId = resolved.id;
          update.assigned_to = assigneeId;
          method.assignee = resolved.method;
          if (resolved.method === "direct_uuid") report.resolution.assignee.direct_uuid++;
          else report.resolution.assignee.name_match++;
        } else {
          report.resolution.assignee.unresolved++;
        }
      }

      // ---- metadata merge
      const existingMeta = (task.metadata as any) || {};
      const mergedMeta = {
        ...existingMeta,
        legacy_migration: true,
        legacy_id: legacyId,
        legacy_user_id: norm(csv.user_id),
        legacy_client_id: norm(csv.client_id),
        legacy_project_id: norm(csv.project_id),
        legacy_opportunity_id: norm(csv.opportunity_id),
        legacy_communication_id: norm(csv.communication_log_id),
        legacy_outcome: norm(csv.outcome),
        legacy_status_after: norm(csv.status_after),
        legacy_tags: csv.tags && csv.tags !== "[]" ? csv.tags : null,
        legacy_attachments: csv.attachments && csv.attachments !== "[]" ? csv.attachments : null,
        legacy_created_at: norm(csv.created_at),
        linkage_resolved_at: new Date().toISOString(),
        linkage_resolution_method: method,
      };
      update.metadata = mergedMeta;

      // Track orphans (no parent at all after waterfall)
      if (!update.opportunity_id && !task.opportunity_id && !update.project_id && !task.project_id && !update.customer_account_id && !task.customer_account_id) {
        report.orphans.push({ task_id: task.id, legacy_id: legacyId, reason: "no_parent_resolvable" });
      }

      const { error: updErr } = await supabase.from("tasks").update(update).eq("id", task.id);
      if (updErr) {
        report.errors.push(`task ${task.id}: ${updErr.message}`);
      } else {
        report.updated++;
      }
    }

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
