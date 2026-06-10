import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Robust semicolon-delimited CSV parser handling quoted fields with newlines
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ';') { current.push(field); field = ""; }
      else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        current.push(field); field = "";
        if (current.some(f => f.length > 0)) rows.push(current);
        current = [];
        if (ch === '\r') i++;
      } else field += ch;
    }
  }
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    if (current.some(f => f.length > 0)) rows.push(current);
  }
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (row[i] || "").trim(); });
    return obj;
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();


    // ============ CLEAR MATERIALS INTEREST MODE ============
    if (body.action === "clear_materials_interest") {
      console.log("Clearing all materials_interest on migrated opportunities...");
      const { data: allOpps } = await supabase
        .from("opportunities")
        .select("id")
        .filter("metadata->>legacy_migration", "eq", "true");

      let cleared = 0;
      const errors: string[] = [];
      for (const opp of allOpps || []) {
        const { error } = await supabase
          .from("opportunities")
          .update({ materials_interest: [] })
          .eq("id", opp.id);
        if (error) errors.push(`${opp.id}: ${error.message}`);
        else cleared++;
      }

      const result = { cleared, errors, total: (allOpps || []).length };
      console.log("Clear result:", JSON.stringify(result));
      return new Response(JSON.stringify(result, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ FIX MATERIALS INTEREST MODE ============
    if (body.action === "fix_materials_interest") {
      console.log("Running fix_materials_interest...");
      
      // Old legacy material ID -> new material ID mapping
      const materialMapping: Record<string, string> = {
        "2c0d584c-8acb-4282-8f40-4223778aa719": "b0d5a1d2-23cd-4048-8519-8c824d7350d5", // 10cm
        "5f05ca28-c119-470e-90eb-aef692be550a": "e15f9111-c211-492f-9a0b-616c7ac3bccf", // 15cm
        "3ff01f2f-e95d-444e-8297-58908e8ea5eb": "ec359e6f-a2f1-4016-8807-476819dd856b", // 20cm
      };

      // Fetch material names for the new IDs
      const newMatIds = Object.values(materialMapping);
      const { data: newMats } = await supabase
        .from("materials")
        .select("id, name, name_ar, code")
        .in("id", newMatIds);
      const newMatLookup = new Map((newMats || []).map((m: any) => [m.id, m]));

      // Get all legacy-migrated opportunities
      const { data: allOpps } = await supabase
        .from("opportunities")
        .select("id, materials_interest, metadata")
        .filter("metadata->>legacy_migration", "eq", "true");

      let cleared = 0, mapped = 0, errors: string[] = [];

      for (const opp of allOpps || []) {
        const items = (opp.materials_interest as any[]) || [];
        const hasQuoteItems = items.some((i: any) => i.source === "legacy_quotation_item");

        if (!hasQuoteItems) {
          // Clear text-only entries
          const { error } = await supabase
            .from("opportunities")
            .update({ materials_interest: [] })
            .eq("id", opp.id);
          if (error) errors.push(`Clear ${opp.id}: ${error.message}`);
          else cleared++;
        } else {
          // Map legacy_quotation_item entries to real material IDs
          const mappedItems = items
            .filter((i: any) => i.source === "legacy_quotation_item" && i.legacy_material_id)
            .map((i: any) => {
              const newId = materialMapping[i.legacy_material_id];
              const mat = newId ? newMatLookup.get(newId) : null;
              return {
                material_id: newId || null,
                name: mat?.name || i.text,
                name_ar: mat?.name_ar || null,
                code: mat?.code || null,
                quantity: i.quantity,
                unit_price: i.unit_price,
                source: "legacy_quotation_item",
                legacy_material_id: i.legacy_material_id,
                needs_review: !newId,
              };
            });

          const { error } = await supabase
            .from("opportunities")
            .update({ materials_interest: mappedItems })
            .eq("id", opp.id);
          if (error) errors.push(`Map ${opp.id}: ${error.message}`);
          else mapped++;
        }
      }

      const result = { cleared, mapped, errors, total: (allOpps || []).length };
      console.log("Fix result:", JSON.stringify(result));
      return new Response(JSON.stringify(result, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ ORIGINAL MIGRATION MODE ============
    // Accept either inline CSV data or base_url
    let oppsText: string, commsText: string, tasksText: string, qiText: string, matsText: string;
    
    if (body.opportunities_csv) {
      oppsText = body.opportunities_csv;
      commsText = body.communications_csv || "";
      tasksText = body.tasks_csv || "";
      qiText = body.quotation_items_csv || "";
      matsText = body.materials_csv || "";
      console.log("Using inline CSV data");
    } else if (body.base_url) {
      const base_url = body.base_url;
      console.log("Fetching CSVs from:", base_url);
      [oppsText, commsText, tasksText, qiText, matsText] = await Promise.all([
        fetch(`${base_url}/migration/opportunities.csv`).then(r => r.text()),
        fetch(`${base_url}/migration/communications.csv`).then(r => r.text()),
        fetch(`${base_url}/migration/tasks.csv`).then(r => r.text()),
        fetch(`${base_url}/migration/quotation_items.csv`).then(r => r.text()),
        fetch(`${base_url}/migration/materials.csv`).then(r => r.text()),
      ]);
    } else {
      throw new Error("Either opportunities_csv, base_url, or action required");
    }

    console.log("Opps length:", oppsText.length);

    const opportunities = parseCsv(oppsText);
    const communications = parseCsv(commsText);
    const tasks = parseCsv(tasksText);
    const quotationItems = parseCsv(qiText);
    const materials = parseCsv(matsText);

    console.log(`Parsed: ${opportunities.length} opps, ${communications.length} comms, ${tasks.length} tasks, ${quotationItems.length} qi, ${materials.length} mats`);

    // Build set of valid auth user IDs to avoid FK violations
    const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const validUserIds = new Set((authUsers?.users || []).map((u: any) => u.id));
    console.log(`Valid auth users: ${validUserIds.size}`);
    const safeUserId = (id: string | null | undefined) => (id && validUserIds.has(id)) ? id : null;

    const report = {
      opportunities_inserted: 0,
      opportunities_skipped: 0,
      communications_inserted: 0,
      synthetic_comms_created: 0,
      tasks_inserted: 0,
      tasks_skipped: 0,
      materials_interest_updated: 0,
      errors: [] as string[],
    };

    // Build material name lookup
    const materialNames = new Map<string, string>();
    for (const m of materials) {
      materialNames.set(m.id, m.name);
    }

    // Mappings
    const oppMap = new Map<string, { newId: string; projectId: string; clientId: string; accountId: string }>();
    const commMap = new Map<string, string>();
    const clientToOpp = new Map<string, string[]>();

    // ================================================================
    // STEP 1: OPPORTUNITIES (200 records)
    // ================================================================
    console.log("Step 1: Inserting opportunities...");
    
    // Batch: lookup all project IDs first
    const projectIds = [...new Set(opportunities.map((o: any) => o.project_id).filter(Boolean))];
    const { data: projects } = await supabase
      .from("projects")
      .select("id, customer_account_id, name")
      .in("id", projectIds);
    
    const projectLookup = new Map<string, { customer_account_id: string; name: string }>();
    for (const p of projects || []) {
      projectLookup.set(p.id, { customer_account_id: p.customer_account_id, name: p.name });
    }

    // Prepare opportunity inserts
    const oppInserts = [];
    for (const opp of opportunities as any[]) {
      const project = projectLookup.get(opp.project_id);
      if (!project) {
        report.opportunities_skipped++;
        report.errors.push(`Opp ${opp.id}: project ${opp.project_id} not found`);
        continue;
      }

      // Smart title: extract material text from notes
      let materialText = (opp.notes || "")
        .replace(/^Material Category:\s*/i, "")
        .replace(/<br\/>.*$/s, "")
        .replace(/\n.*$/s, "")
        .trim();
      
      let title: string;
      if (materialText && materialText.length > 0 && materialText !== opp.notes) {
        title = `${materialText} - ${project.name}`;
      } else {
        const code = (opp.opportunity_code || "").replace(/SAL-/, "SAL.").replace(/-/g, "_");
        title = `Deal ${code}`;
      }

      // Map stage
      const stageMap: Record<string, string> = {
        discovery: "discovery", rfp: "rfp",
        "closed lost": "lost", "closed won": "won",
      };
      const stage = stageMap[(opp.stage || "").toLowerCase()] || "discovery";

      // Map status
      let status = "active";
      const inPipeline = opp.in_pipeline === "true" || opp.in_pipeline === true;
      if ((opp.interest_level || "").toLowerCase() === "not interested" || !inPipeline) {
        status = "lost";
      } else if ((opp.stage || "").toLowerCase() === "closed won") {
        status = "won";
      }

      // Map interest
      const interestMap: Record<string, string> = {
        high: "High", medium: "Medium", low: "Low", "not interested": "Not interested",
      };
      const interest = interestMap[(opp.interest_level || "").toLowerCase()] || "Medium";

      // Normalize code: SAL-NNNN-NNN-NNN -> SAL.NNNN_NNN_NNN
      const code = (opp.opportunity_code || "").replace(/^SAL-/, "SAL.").replace(/-/g, "_");

      // Materials interest from notes
      const materialsInterest: any[] = [];
      if ((opp.notes || "").includes("Material Category:")) {
        materialsInterest.push({ text: materialText, source: "legacy_notes" });
      }

      // Metadata
      const metadata: any = { legacy_migration: true, legacy_id: opp.id };
      if (materialsInterest.length === 0) {
        metadata.needs_review = "materials_not_mapped";
      }

      // Won/lost timestamps
      let wonAt = null;
      let lostAt = null;
      if (status === "won" && opp.closed_at) wonAt = opp.closed_at;
      if (status === "lost") lostAt = opp.updated_at;

      // Lost reason from notes
      let lostReason = null;
      if (status === "lost" && (opp.notes || "").includes("Objection:")) {
        const objMatch = (opp.notes || "").match(/Objection:\s*(.+?)$/m);
        if (objMatch) lostReason = objMatch[1].trim();
      }

      const newId = crypto.randomUUID();
      oppInserts.push({
        id: newId,
        project_id: opp.project_id,
        customer_account_id: project.customer_account_id,
        title,
        stage,
        status,
        interest_level: interest,
        notes: opp.notes || null,
        code,
        assigned_to: safeUserId(opp.assigned_to),
        created_by: safeUserId(opp.assigned_to),
        created_at: opp.created_at,
        materials_interest: materialsInterest,
        metadata,
        won_at: wonAt,
        lost_at: lostAt,
        lost_reason: lostReason,
      });

      oppMap.set(opp.id, {
        newId,
        projectId: opp.project_id,
        clientId: opp.client_id,
        accountId: project.customer_account_id,
      });

      if (!clientToOpp.has(opp.client_id)) clientToOpp.set(opp.client_id, []);
      clientToOpp.get(opp.client_id)!.push(opp.id);
    }

    // Batch insert opportunities (chunks of 50)
    for (let i = 0; i < oppInserts.length; i += 50) {
      const chunk = oppInserts.slice(i, i + 50);
      const { error } = await supabase.from("opportunities").insert(chunk);
      if (error) {
        report.errors.push(`Opp batch ${i}: ${error.message}`);
        report.opportunities_skipped += chunk.length;
      } else {
        report.opportunities_inserted += chunk.length;
      }
    }
    console.log(`Opportunities: ${report.opportunities_inserted} inserted, ${report.opportunities_skipped} skipped`);

    // ================================================================
    // STEP 2: COMMUNICATIONS (175 records)
    // ================================================================
    console.log("Step 2: Inserting communications...");
    
    const oppsWithComms = new Set<string>();
    const commInserts = [];

    for (const comm of communications as any[]) {
      // Match to opportunity via client_id
      const matchedOppIds = clientToOpp.get(comm.client_id) || [];
      const matchedOppId = matchedOppIds.length > 0 ? matchedOppIds[0] : null;
      const oppInfo = matchedOppId ? oppMap.get(matchedOppId) : null;

      // Map channel
      const channelMap: Record<string, string> = {
        site_visit: "in_person", "phone call": "call", wa: "whatsapp",
        "in person": "in_person", other: "internal", meeting: "meeting",
        email: "email",
      };
      const rawChannel = (comm.communication_channels || "internal").toLowerCase();
      const channel = channelMap[rawChannel] || "internal";

      const metadata: any = { legacy_migration: true, legacy_id: comm.id };
      if (!channelMap[rawChannel] && rawChannel !== "internal") {
        metadata.needs_review = "channel_unknown";
        metadata.original_channel = comm.communication_channels;
      }

      // Ensure has_target constraint: at least one of account_id, project_id, contact_id must be set
      const accountId = oppInfo?.accountId || null;
      const projectId = oppInfo?.projectId || null;
      
      // Skip comms that have no target at all
      if (!accountId && !projectId) {
        report.errors.push(`Comm ${comm.id}: no target (account/project), skipping`);
        continue;
      }

      const newId = crypto.randomUUID();
      commInserts.push({
        id: newId,
        account_id: accountId,
        project_id: projectId,
        opportunity_id: oppInfo?.newId || null,
        channel,
        occurred_at: comm.communication_date || comm.created_at,
        summary: comm.summary || null,
        raw_notes: comm.notes || null,
        subject: comm.topic || null,
        created_at: comm.created_at,
        created_by: safeUserId(comm.owner_id),
        metadata,
      });

      commMap.set(comm.id, newId);
      if (matchedOppId) oppsWithComms.add(matchedOppId);
    }

    // Batch insert communications
    for (let i = 0; i < commInserts.length; i += 50) {
      const chunk = commInserts.slice(i, i + 50);
      const { error } = await supabase.from("communications").insert(chunk);
      if (error) {
        report.errors.push(`Comm batch ${i}: ${error.message}`);
      } else {
        report.communications_inserted += chunk.length;
      }
    }
    console.log(`Communications: ${report.communications_inserted} inserted`);

    // ================================================================
    // STEP 3: SYNTHETIC COMMS for unmatched opportunities
    // ================================================================
    console.log("Step 3: Creating synthetic comms...");
    
    const syntheticInserts = [];
    for (const [legacyOppId, info] of oppMap) {
      if (oppsWithComms.has(legacyOppId)) continue;

      const origOpp = (opportunities as any[]).find((o: any) => o.id === legacyOppId);
      syntheticInserts.push({
        account_id: info.accountId,
        project_id: info.projectId,
        opportunity_id: info.newId,
        channel: "internal",
        occurred_at: origOpp?.created_at || new Date().toISOString(),
        summary: origOpp?.notes || "Migrated opportunity - no original communication",
        subject: "Migration: Initial Record",
        metadata: { legacy_migration: true, synthetic: true, needs_review: "no_original_communication" },
      });
    }

    if (syntheticInserts.length > 0) {
      for (let i = 0; i < syntheticInserts.length; i += 50) {
        const chunk = syntheticInserts.slice(i, i + 50);
        const { error } = await supabase.from("communications").insert(chunk);
        if (error) {
          report.errors.push(`Synthetic comm batch ${i}: ${error.message}`);
        } else {
          report.synthetic_comms_created += chunk.length;
        }
      }
    }
    console.log(`Synthetic comms: ${report.synthetic_comms_created} created`);

    // ================================================================
    // STEP 4: TASKS (292 records)
    // ================================================================
    console.log("Step 4: Inserting tasks...");
    
    // Need project -> account lookup for tasks without opportunity
    const taskProjectIds = [...new Set((tasks as any[]).map((t: any) => t.project_id).filter(Boolean))];
    const missingProjectIds = taskProjectIds.filter(pid => !projectLookup.has(pid));
    if (missingProjectIds.length > 0) {
      const { data: extraProjects } = await supabase
        .from("projects")
        .select("id, customer_account_id, name")
        .in("id", missingProjectIds);
      for (const p of extraProjects || []) {
        projectLookup.set(p.id, { customer_account_id: p.customer_account_id, name: p.name });
      }
    }

    const taskInserts = [];
    for (const task of tasks as any[]) {
      const newCommId = task.communication_log_id ? commMap.get(task.communication_log_id) : null;
      const newOppInfo = task.opportunity_id ? oppMap.get(task.opportunity_id) : null;

      // Resolve account
      let accountId: string | null = null;
      if (newOppInfo) {
        accountId = newOppInfo.accountId;
      } else if (task.project_id) {
        const proj = projectLookup.get(task.project_id);
        accountId = proj?.customer_account_id || null;
      }

      // Map status
      const statusLower = (task.status_after || "open").toLowerCase();
      const status = statusLower === "closed" || statusLower === "done" ? "done" : "open";

      // Map channel
      const taskChannelMap: Record<string, string> = {
        "phone call": "call", wa: "whatsapp", whatsapp: "whatsapp",
        "in person": "in_person", meeting: "meeting", email: "email",
      };
      const channel = taskChannelMap[(task.follow_up_channel || "").toLowerCase()] || null;

      const metadata: any = { legacy_migration: true, legacy_id: task.id };

      taskInserts.push({
        title: task.action || "Legacy follow-up",
        description: task.notes || null,
        task_type: "follow_up",
        status,
        priority: (task.priority || "medium").toLowerCase(),
        channel,
        due_at: task.follow_up_date || null,
        completed_at: status === "done" ? (task.follow_up_date || task.created_at) : null,
        assigned_to: safeUserId(task.user_id),
        created_by: safeUserId(task.user_id),
        created_at: task.created_at,
        communication_id: newCommId || null,
        opportunity_id: newOppInfo?.newId || null,
        project_id: task.project_id || null,
        customer_account_id: accountId,
        client_response: task.client_response || null,
        legacy_follow_up_id: task.id || null,
        metadata,
      });
    }

    // Batch insert tasks
    for (let i = 0; i < taskInserts.length; i += 50) {
      const chunk = taskInserts.slice(i, i + 50);
      const { error } = await supabase.from("tasks").insert(chunk);
      if (error) {
        report.errors.push(`Task batch ${i}: ${error.message}`);
        report.tasks_skipped += chunk.length;
      } else {
        report.tasks_inserted += chunk.length;
      }
    }
    console.log(`Tasks: ${report.tasks_inserted} inserted, ${report.tasks_skipped} skipped`);

    // ================================================================
    // STEP 5: QUOTATION ITEMS -> MATERIALS INTEREST
    // ================================================================
    console.log("Step 5: Updating materials interest from quotation items...");
    
    // Group quotation items by communication_log_id
    const qiByComm = new Map<string, any[]>();
    for (const qi of quotationItems as any[]) {
      if (!qi.communication_log_id) continue;
      if (!qiByComm.has(qi.communication_log_id)) qiByComm.set(qi.communication_log_id, []);
      qiByComm.get(qi.communication_log_id)!.push(qi);
    }

    // For each comm group, find matching opportunity and update
    for (const [legacyCommId, items] of qiByComm) {
      const newCommId = commMap.get(legacyCommId);
      if (!newCommId) {
        report.errors.push(`QI: comm ${legacyCommId} not mapped`);
        continue;
      }

      // Find opportunity via the new communication
      const { data: commData } = await supabase
        .from("communications")
        .select("opportunity_id")
        .eq("id", newCommId)
        .single();

      if (!commData?.opportunity_id) {
        report.errors.push(`QI: no opportunity for comm ${legacyCommId}`);
        continue;
      }

      // Get current materials_interest
      const { data: oppData } = await supabase
        .from("opportunities")
        .select("materials_interest, metadata")
        .eq("id", commData.opportunity_id)
        .single();

      if (!oppData) continue;

      const currentInterest = (oppData.materials_interest as any[]) || [];
      for (const qi of items) {
        const materialName = materialNames.get(qi.material_id) || qi.material_id;
        currentInterest.push({
          text: materialName,
          source: "legacy_quotation_item",
          quantity: qi.quantity ? parseFloat(qi.quantity) : null,
          unit_price: qi.unit_price ? parseFloat(qi.unit_price) : null,
          legacy_material_id: qi.material_id,
          needs_review: true,
        });
      }

      const existingMeta = (oppData.metadata as any) || {};
      const { error } = await supabase
        .from("opportunities")
        .update({
          materials_interest: currentInterest,
          metadata: { ...existingMeta, has_legacy_quote_items: true },
        })
        .eq("id", commData.opportunity_id);

      if (!error) report.materials_interest_updated++;
      else report.errors.push(`QI update: ${error.message}`);
    }
    console.log(`Materials interest: ${report.materials_interest_updated} opportunities updated`);

    console.log("Migration complete!", JSON.stringify(report));

    return new Response(JSON.stringify(report, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Migration error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message, stack: (err as Error).stack }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
