import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hard-coded scope: the 3 missing parent comms + their resolved accounts
const PARENT_COMMS = [
  {
    legacy_id: "bbbf099a-d9e9-474b-a4ef-05c9c0626081",
    account_id: "115e115c-5fe4-4c81-b2f6-115e115c5fe4", // SAL.0077 — resolved below by code
    account_code: "SAL.0077",
  },
  {
    legacy_id: "170a1e3d-e498-4e63-b059-59a44434d4b6",
    account_code: "SAL.0079",
  },
  {
    legacy_id: "14883293-33ad-44d2-96db-0f9b8251a8f3",
    account_code: "SAL.0080",
  },
];

function parseCsvLine(line: string, sep = ";"): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === sep) { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { communications_csv, tasks_csv } = await req.json();
    if (!communications_csv || !tasks_csv) {
      return new Response(JSON.stringify({ error: "communications_csv and tasks_csv are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const comms = parseCsv(communications_csv);
    const tasks = parseCsv(tasks_csv);

    // Resolve account UUIDs by code
    const { data: accounts, error: accErr } = await supabase
      .from("accounts")
      .select("id, code")
      .in("code", PARENT_COMMS.map((p) => p.account_code));
    if (accErr) throw accErr;
    const accountByCode = new Map(accounts!.map((a) => [a.code, a.id]));

    const report = {
      communications_inserted: 0,
      communications_skipped_existing: 0,
      tasks_relinked: 0,
      tasks_not_found: [] as string[],
      errors: [] as string[],
      created: [] as { legacy_id: string; new_id: string; account_id: string }[],
    };

    // Map legacy_comm_id -> new communication_id
    const commIdMap = new Map<string, string>();

    for (const pc of PARENT_COMMS) {
      const accountId = accountByCode.get(pc.account_code);
      if (!accountId) {
        report.errors.push(`Account not found for code ${pc.account_code}`);
        continue;
      }

      // Check if already exists (idempotent)
      const { data: existing } = await supabase
        .from("communications")
        .select("id")
        .eq("metadata->>legacy_id", pc.legacy_id)
        .maybeSingle();

      if (existing) {
        commIdMap.set(pc.legacy_id, existing.id);
        report.communications_skipped_existing++;
        continue;
      }

      const csvRow = comms.find((r) => r.id === pc.legacy_id);
      if (!csvRow) {
        report.errors.push(`CSV row not found for legacy comm ${pc.legacy_id}`);
        continue;
      }

      const channelMap: Record<string, string> = {
        "In person": "in_person",
        "WA": "whatsapp",
        "Phone call": "phone",
        "Email": "email",
        "Meeting": "meeting",
        "Others": "other",
      };

      const metadata: Record<string, unknown> = {
        legacy_id: pc.legacy_id,
        legacy_migration: true,
        reconstructed_for_orphan_tasks: true,
        legacy_company_name: csvRow.company_name || null,
        legacy_person_name: csvRow.person_name || null,
        legacy_contact_info: csvRow.contact_info || null,
        legacy_topic: csvRow.topic || null,
        legacy_action: csvRow.action || null,
        legacy_status: csvRow.status || null,
        legacy_follow_up_date: csvRow.follow_up_date || null,
        legacy_category: csvRow.category || null,
        legacy_city: csvRow.city || null,
        legacy_location: csvRow.location || null,
        legacy_district: csvRow.district || null,
        legacy_project_type: csvRow.project_type || null,
        legacy_project_size: csvRow.project_size || null,
        legacy_current_phase: csvRow.current_phase || null,
        legacy_outcome_notes: csvRow.outcome_notes || null,
        legacy_interest_level: csvRow.interest_level || null,
        legacy_client_id: csvRow.client_id || null,
      };

      const { data: inserted, error: insErr } = await supabase
        .from("communications")
        .insert({
          account_id: accountId,
          channel: channelMap[csvRow.communication_channels] || "other",
          occurred_at: csvRow.communication_date || csvRow.created_at || new Date().toISOString(),
          summary: csvRow.summary || csvRow.topic || null,
          outcome: csvRow.action || null,
          raw_notes: csvRow.notes || null,
          metadata,
        })
        .select("id")
        .single();

      if (insErr) {
        report.errors.push(`Insert comm ${pc.legacy_id}: ${insErr.message}`);
        continue;
      }

      commIdMap.set(pc.legacy_id, inserted.id);
      report.communications_inserted++;
      report.created.push({ legacy_id: pc.legacy_id, new_id: inserted.id, account_id: accountId });
    }

    // Now relink orphan tasks. Find tasks from CSV where communication_log_id matches one of the 3 legacy comms
    const orphanLegacyTaskIds = tasks
      .filter((t) => commIdMap.has(t.communication_log_id))
      .map((t) => ({ legacy_task_id: t.id, legacy_comm_id: t.communication_log_id }));

    for (const ot of orphanLegacyTaskIds) {
      const newCommId = commIdMap.get(ot.legacy_comm_id)!;
      // Resolve account via the legacy comm
      const pc = PARENT_COMMS.find((p) => p.legacy_id === ot.legacy_comm_id)!;
      const accountId = accountByCode.get(pc.account_code)!;

      // Find the task by metadata.legacy_id
      const { data: taskRow, error: findErr } = await supabase
        .from("tasks")
        .select("id, metadata")
        .eq("metadata->>legacy_id", ot.legacy_task_id)
        .maybeSingle();

      if (findErr) {
        report.errors.push(`Find task ${ot.legacy_task_id}: ${findErr.message}`);
        continue;
      }
      if (!taskRow) {
        report.tasks_not_found.push(ot.legacy_task_id);
        continue;
      }

      const mergedMeta = {
        ...(taskRow.metadata as Record<string, unknown> ?? {}),
        legacy_migration: true,
        linkage_resolution_method: {
          ...((taskRow.metadata as any)?.linkage_resolution_method ?? {}),
          customer: "via_reconstructed_communication",
          opportunity: "unresolved_no_source",
          project: "unresolved_no_source",
        },
      };

      const { error: updErr } = await supabase
        .from("tasks")
        .update({
          communication_id: newCommId,
          customer_account_id: accountId,
          metadata: mergedMeta,
        })
        .eq("id", taskRow.id);

      if (updErr) {
        report.errors.push(`Update task ${ot.legacy_task_id}: ${updErr.message}`);
        continue;
      }
      report.tasks_relinked++;
    }

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
