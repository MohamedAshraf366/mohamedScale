import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-agent-key",
};

// ── Task type labels (mirroring NextActionsSection TASK_TYPES) ──
const TASK_TYPE_LABELS: Record<string, string> = {
  follow_up: "Follow up",
  ask_quantities: "Ask quantities",
  send_quote: "Send quote",
  complete_onboarding: "Complete onboarding",
  site_visit: "Site visit",
  send_documents: "Send documents",
  internal_review: "Internal review",
  schedule_meeting: "Schedule meeting",
};

const LOST_REASONS = [
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
];

// ── Types ──
type EntityMode = "chip" | "select" | "create" | "edit" | "default" | "none";
type PrepareStatus = "needs_input" | "choose_one" | "ready" | "blocked";
type Intent = "create_entity_v2" | "log_update_v2" | "mark_won_v2" | "mark_lost_v2" | "send_document_v2";

interface MissingField {
  key: string;
  label_ar: string;
  label_en: string;
  reason_ar: string;
  reason_en: string;
  example_ar?: string;
  example_en?: string;
}

interface ChoiceItem {
  type: string;
  id: string;
  label: string;
  code: string;
  subtitle: string;
}

interface ButtonItem {
  id: string;
  title: string;
}

interface PrepareResponse {
  status: PrepareStatus;
  intent: Intent;
  token: string | null;
  resolved: {
    customer_id: string | null;
    project_id: string | null;
    opportunity_id: string | null;
  };
  normalized_draft: any;
  missing: MissingField[];
  choices: ChoiceItem[];
  buttons: ButtonItem[];
  warnings: string[];
  summary: string;
  can_commit: boolean;
}

interface PrepareRequest {
  intent: Intent;
  actor_user_id?: string;
  actor_phone?: string;
  target_level?: string;
  customer?: { mode?: EntityMode; selectedId?: string | null; draft?: any };
  project?: { mode?: EntityMode; selectedId?: string | null; draft?: any };
  opportunity?: { mode?: EntityMode; selectedId?: string | null; draft?: any };
  context?: { type?: string; channel?: string; summary?: string; occurred_at?: string | null };
  actions?: Array<{ taskType?: string; customTitle?: string; dueDate?: string | null }>;
  document_type?: "quotation" | "pricelist" | null;
  session_context?: {
    resolved_customer_id?: string | null;
    resolved_project_id?: string | null;
    resolved_opportunity_id?: string | null;
  };
}

interface CommitRequest {
  token: string;
}

// ── Route handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop(); // prepare-v3, commit-v3

  if (req.method !== "POST")
    return json({ error: "POST only" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();

    if (path === "commit-v3") {
      return await handleCommitV3(supabase, body as CommitRequest);
    }

    // Default: prepare-v3
    return await handlePrepareV3(supabase, body as PrepareRequest);
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ════════════════════════════════════════════════
// PREPARE V3
// ════════════════════════════════════════════════
async function handlePrepareV3(supabase: any, body: PrepareRequest): Promise<Response> {
  const { intent } = body;
  if (!intent) return json({ error: "intent is required" }, 400);

  const missing: MissingField[] = [];
  const choices: ChoiceItem[] = [];
  const buttons: ButtonItem[] = [];
  const warnings: string[] = [];

  // Use session_context for pre-resolved IDs
  const sc = body.session_context || {};
  let resolvedCustomerId = body.customer?.selectedId || sc.resolved_customer_id || null;
  let resolvedProjectId = body.project?.selectedId || sc.resolved_project_id || null;
  let resolvedOpportunityId = body.opportunity?.selectedId || sc.resolved_opportunity_id || null;

  const customerMode = body.customer?.mode || (resolvedCustomerId ? "chip" : "none");
  const projectMode = body.project?.mode || (resolvedProjectId ? "chip" : "none");
  const oppMode = body.opportunity?.mode || (resolvedOpportunityId ? "chip" : "none");

  const oppDraft = body.opportunity?.draft || {};
  const custDraft = body.customer?.draft || {};
  const projDraft = body.project?.draft || {};
  const ctx = body.context || {};
  const actions = body.actions || [];

  const isNotInterested = oppDraft.interestLevel === "Not interested" || oppDraft.interest_level === "Not interested";

  // ── Auto-resolve from opportunity ──
  if (resolvedOpportunityId && (!resolvedCustomerId || !resolvedProjectId)) {
    const { data: opp } = await supabase
      .from("opportunities")
      .select("customer_account_id, project_id, title, code, stage, status")
      .eq("id", resolvedOpportunityId)
      .single();
    if (opp) {
      resolvedCustomerId = resolvedCustomerId || opp.customer_account_id;
      resolvedProjectId = resolvedProjectId || opp.project_id;
    }
  }

  // ── Auto-resolve from project ──
  if (resolvedProjectId && !resolvedCustomerId) {
    const { data: proj } = await supabase
      .from("projects")
      .select("customer_account_id")
      .eq("id", resolvedProjectId)
      .single();
    if (proj) resolvedCustomerId = proj.customer_account_id;
  }

  // ── Intent-specific validation ──
  switch (intent) {
    case "create_entity_v2":
      await validateCreate(supabase, body, missing, warnings, { resolvedCustomerId, resolvedProjectId, resolvedOpportunityId, customerMode, projectMode, oppMode, isNotInterested, custDraft, projDraft, oppDraft, ctx, actions });
      break;

    case "log_update_v2":
      await validateLogUpdate(supabase, body, missing, choices, buttons, warnings, { resolvedCustomerId, resolvedProjectId, resolvedOpportunityId, oppMode, isNotInterested, ctx, actions });
      break;

    case "mark_won_v2":
      await validateMarkWon(supabase, missing, warnings, { resolvedOpportunityId });
      break;

    case "mark_lost_v2":
      validateMarkLost(body, missing, warnings, { resolvedOpportunityId, oppDraft });
      break;

    case "send_document_v2":
      await validateSendDocument(supabase, body, missing, warnings, { resolvedOpportunityId, ctx, actions });
      break;

    default:
      return json({ error: `Unknown intent: ${intent}` }, 400);
  }

  // ── Determine status ──
  let status: PrepareStatus;
  if (warnings.some(w => w.startsWith("BLOCKED:"))) {
    status = "blocked";
  } else if (choices.length > 0) {
    status = "choose_one";
  } else if (missing.length > 0) {
    status = "needs_input";
  } else {
    status = "ready";
  }

  // ── Build normalized draft ──
  const normalizedDraft = {
    customer: {
      mode: customerMode,
      selectedId: resolvedCustomerId,
      ...(customerMode === "create" ? custDraft : {}),
    },
    project: {
      mode: projectMode,
      selectedId: resolvedProjectId,
      ...(projectMode === "create" ? projDraft : {}),
    },
    opportunity: {
      mode: oppMode,
      selectedId: resolvedOpportunityId,
      ...oppDraft,
    },
    context: {
      type: ctx.type || "communication",
      channel: ctx.type === "internal_note" ? "internal" : (ctx.channel || null),
      summary: ctx.summary || null,
      occurred_at: ctx.occurred_at || null,
    },
    actions: actions.map(a => ({
      taskType: a.taskType || null,
      customTitle: a.customTitle || null,
      dueDate: a.dueDate || null,
    })),
  };

  // ── Build summary ──
  let summary = "";
  if (status === "ready") {
    summary = await buildSummary(supabase, intent, {
      resolvedCustomerId, resolvedProjectId, resolvedOpportunityId,
      custDraft, projDraft, oppDraft, ctx, actions, customerMode, projectMode, oppMode,
      document_type: body.document_type,
    });
  }

  // ── Create token if ready ──
  let token: string | null = null;
  if (status === "ready") {
    const { data: conf, error: confErr } = await supabase
      .from("agent_confirmations")
      .insert({
        tool: "global-activity",
        actor_user_id: body.actor_user_id || "00000000-0000-0000-0000-000000000000",
        payload: { ...body, _resolved: { customer_id: resolvedCustomerId, project_id: resolvedProjectId, opportunity_id: resolvedOpportunityId } },
      })
      .select("token, expires_at")
      .single();
    if (confErr) throw confErr;
    token = conf.token;
  }

  const response: PrepareResponse = {
    status,
    intent,
    token,
    resolved: {
      customer_id: resolvedCustomerId,
      project_id: resolvedProjectId,
      opportunity_id: resolvedOpportunityId,
    },
    normalized_draft: normalizedDraft,
    missing,
    choices,
    buttons,
    warnings: warnings.filter(w => !w.startsWith("BLOCKED:")),
    summary,
    can_commit: status === "ready",
  };

  return json(response);
}

// ════════════════════════════════════════════════
// VALIDATION: create_entity_v2
// ════════════════════════════════════════════════
async function validateCreate(
  supabase: any, body: PrepareRequest, missing: MissingField[], warnings: string[],
  r: any
) {
  // Customer required
  if (r.customerMode === "create") {
    if (!r.custDraft.displayName && !r.custDraft.display_name) {
      missing.push({
        key: "customer.draft.displayName",
        label_ar: "اسم العميل", label_en: "Customer name",
        reason_ar: "لا يمكن إنشاء عميل بدون اسم",
        reason_en: "A customer name is required to create a new customer",
        example_ar: "شركة الأبنية الحديثة", example_en: "Modern Buildings Co.",
      });
    }
  } else if (r.customerMode === "select" || r.customerMode === "none") {
    if (!r.resolvedCustomerId) {
      missing.push({
        key: "customer.selectedId",
        label_ar: "العميل", label_en: "Customer",
        reason_ar: "يجب اختيار أو إنشاء عميل",
        reason_en: "A customer must be selected or created",
        example_ar: "SAL.0178 أو اسم العميل", example_en: "SAL.0178 or customer name",
      });
    }
  }

  // Project: if mode is create, need name
  if (r.projectMode === "create") {
    if (!r.projDraft.name) {
      missing.push({
        key: "project.draft.name",
        label_ar: "اسم المشروع", label_en: "Project name",
        reason_ar: "يجب تحديد اسم المشروع",
        reason_en: "Project name is required when creating a new project",
        example_ar: "فيلا الرياض - المرحلة 1", example_en: "Riyadh Villa - Phase 1",
      });
    }
  }
  // project.mode = "default" is always valid (auto-creates "General")

  // Opportunity: if create, need title
  if (r.oppMode === "create") {
    if (!r.oppDraft.title) {
      missing.push({
        key: "opportunity.draft.title",
        label_ar: "عنوان الفرصة", label_en: "Opportunity title",
        reason_ar: "يجب تحديد عنوان الفرصة",
        reason_en: "Opportunity title is required",
        example_ar: "طلب بلك للمشروع", example_en: "Block order for project",
      });
    }
    // If not interested, require reason
    if (r.isNotInterested && !r.oppDraft.notInterestedReason && !r.oppDraft.lost_reason) {
      missing.push({
        key: "opportunity.draft.notInterestedReason",
        label_ar: "سبب عدم الاهتمام", label_en: "Not interested reason",
        reason_ar: "يجب تحديد سبب عدم الاهتمام",
        reason_en: "A reason is required when marking as 'Not interested'",
        example_ar: "السعر مرتفع", example_en: "Price too high",
      });
    }
  }

  // Context required
  if (!r.ctx.summary?.trim()) {
    missing.push({
      key: "context.summary",
      label_ar: "ملخص التواصل", label_en: "Context summary",
      reason_ar: "يجب كتابة ملخص للتواصل أو الملاحظة",
      reason_en: "A summary of the communication or note is required",
      example_ar: "تواصل العميل يسأل عن أسعار البلك", example_en: "Client called asking about block prices",
    });
  }

  if (r.ctx.type === "communication" && !r.ctx.channel) {
    missing.push({
      key: "context.channel",
      label_ar: "قناة التواصل", label_en: "Communication channel",
      reason_ar: "يجب تحديد قناة التواصل",
      reason_en: "Communication channel is required",
      example_ar: "whatsapp, call, email", example_en: "whatsapp, call, email",
    });
  }

  // Next actions required unless Not interested
  if (!r.isNotInterested) {
    const validActions = r.actions.filter((a: any) => a.taskType && a.dueDate);
    if (validActions.length === 0) {
      missing.push({
        key: "actions",
        label_ar: "الإجراء التالي", label_en: "Next action",
        reason_ar: "يجب تحديد إجراء تالي واحد على الأقل مع تاريخ",
        reason_en: "At least one next action with a due date is required",
        example_ar: "متابعة واتساب بعد 3 أيام", example_en: "Follow up via WhatsApp in 3 days",
      });
    }
  }
}

// ════════════════════════════════════════════════
// VALIDATION: log_update_v2
// ════════════════════════════════════════════════
async function validateLogUpdate(
  supabase: any, body: PrepareRequest, missing: MissingField[],
  choices: ChoiceItem[], buttons: ButtonItem[], warnings: string[],
  r: any
) {
  // Opportunity required
  if (!r.resolvedOpportunityId) {
    // If there's a draft with a title, try to fuzzy-match
    const oppQuery = body.opportunity?.draft?.title || body.opportunity?.draft?.query;
    if (oppQuery) {
      const matches = await fuzzySearch(supabase, "opportunities", oppQuery, r.resolvedCustomerId);
      if (matches.length === 1) {
        r.resolvedOpportunityId = matches[0].id;
        // Auto-resolve customer/project
        const { data: opp } = await supabase.from("opportunities")
          .select("customer_account_id, project_id")
          .eq("id", matches[0].id).single();
        if (opp) {
          r.resolvedCustomerId = r.resolvedCustomerId || opp.customer_account_id;
          r.resolvedProjectId = r.resolvedProjectId || opp.project_id;
        }
      } else if (matches.length > 1) {
        for (const m of matches) {
          choices.push(m);
          buttons.push({ id: `choose:opportunity:${m.id}`, title: m.code || m.label });
        }
        return; // choose_one status
      }
    }

    if (!r.resolvedOpportunityId) {
      missing.push({
        key: "opportunity.selectedId",
        label_ar: "الفرصة", label_en: "Opportunity",
        reason_ar: "لا يمكن تسجيل التحديث بدون فرصة محددة",
        reason_en: "An update cannot be logged without selecting an opportunity",
        example_ar: "SAL.0178_001_001 أو اسم الفرصة", example_en: "SAL.0178_001_001 or opportunity name",
      });
    }
  }

  // Context required
  if (!r.ctx.summary?.trim()) {
    missing.push({
      key: "context.summary",
      label_ar: "ملخص التواصل", label_en: "Context summary",
      reason_ar: "يجب كتابة ملخص للتواصل",
      reason_en: "A summary of the communication is required",
      example_ar: "العميل طلب عرض سعر جديد", example_en: "Client requested a new quotation",
    });
  }

  if (r.ctx.type === "communication" && !r.ctx.channel) {
    missing.push({
      key: "context.channel",
      label_ar: "قناة التواصل", label_en: "Communication channel",
      reason_ar: "يجب تحديد قناة التواصل",
      reason_en: "Communication channel is required",
      example_ar: "whatsapp, call, email", example_en: "whatsapp, call, email",
    });
  }

  // Next actions required unless Not interested
  if (!r.isNotInterested) {
    const validActions = r.actions.filter((a: any) => a.taskType && a.dueDate);
    if (validActions.length === 0) {
      missing.push({
        key: "actions",
        label_ar: "الإجراء التالي", label_en: "Next action",
        reason_ar: "يجب تحديد إجراء تالي واحد على الأقل مع تاريخ",
        reason_en: "At least one next action with a due date is required",
        example_ar: "متابعة بعد يومين", example_en: "Follow up in 2 days",
      });
    }
  }
}

// ════════════════════════════════════════════════
// VALIDATION: mark_won_v2
// ════════════════════════════════════════════════
async function validateMarkWon(supabase: any, missing: MissingField[], warnings: string[], r: any) {
  if (!r.resolvedOpportunityId) {
    missing.push({
      key: "opportunity.selectedId",
      label_ar: "الفرصة", label_en: "Opportunity",
      reason_ar: "يجب تحديد الفرصة لتعليمها كفائزة",
      reason_en: "An opportunity must be selected to mark as won",
      example_ar: "SAL.0178_001_001", example_en: "SAL.0178_001_001",
    });
    return;
  }

  // Check sent official quotation
  const { data: q } = await supabase
    .from("quotations")
    .select("id")
    .eq("opportunity_id", r.resolvedOpportunityId)
    .not("sent_at", "is", null)
    .eq("is_soft", false)
    .limit(1);

  if (!q || q.length === 0) {
    warnings.push("BLOCKED: Cannot mark as won — no official quotation has been sent for this opportunity. The quotation must be sent first using 'send_document_v2'.");
  }
}

// ════════════════════════════════════════════════
// VALIDATION: mark_lost_v2
// ════════════════════════════════════════════════
function validateMarkLost(body: PrepareRequest, missing: MissingField[], warnings: string[], r: any) {
  if (!r.resolvedOpportunityId) {
    missing.push({
      key: "opportunity.selectedId",
      label_ar: "الفرصة", label_en: "Opportunity",
      reason_ar: "يجب تحديد الفرصة لتعليمها كخاسرة",
      reason_en: "An opportunity must be selected to mark as lost",
      example_ar: "SAL.0178_001_001", example_en: "SAL.0178_001_001",
    });
  }

  const lostReason = r.oppDraft.lostReason || r.oppDraft.lost_reason;
  if (!lostReason?.trim()) {
    missing.push({
      key: "opportunity.draft.lostReason",
      label_ar: "سبب الخسارة", label_en: "Lost reason",
      reason_ar: "يجب تحديد سبب خسارة الفرصة",
      reason_en: "A reason for losing the opportunity is required",
      example_ar: "السعر مرتفع، المنافس فاز", example_en: "Price too high, Competitor won",
    });
  }
}

// ════════════════════════════════════════════════
// VALIDATION: send_document_v2
// ════════════════════════════════════════════════
async function validateSendDocument(
  supabase: any, body: PrepareRequest, missing: MissingField[], warnings: string[],
  r: any
) {
  if (!r.resolvedOpportunityId) {
    missing.push({
      key: "opportunity.selectedId",
      label_ar: "الفرصة", label_en: "Opportunity",
      reason_ar: "يجب تحديد الفرصة لإرسال المستند",
      reason_en: "An opportunity must be selected to send a document",
      example_ar: "SAL.0178_001_001", example_en: "SAL.0178_001_001",
    });
  }

  if (!body.document_type || !["quotation", "pricelist"].includes(body.document_type)) {
    missing.push({
      key: "document_type",
      label_ar: "نوع المستند", label_en: "Document type",
      reason_ar: "يجب تحديد نوع المستند (عرض سعر أو قائمة أسعار)",
      reason_en: "Document type must be 'quotation' or 'pricelist'",
      example_ar: "quotation أو pricelist", example_en: "quotation or pricelist",
    });
  }

  if (!r.ctx.summary?.trim()) {
    missing.push({
      key: "context.summary",
      label_ar: "ملخص الإرسال", label_en: "Send summary",
      reason_ar: "يجب كتابة ملخص عن طريقة الإرسال",
      reason_en: "A summary of how the document was sent is required",
      example_ar: "تم إرسال العرض عبر واتساب", example_en: "Quotation sent via WhatsApp",
    });
  }

  if (!r.isNotInterested) {
    const validActions = r.actions.filter((a: any) => a.taskType && a.dueDate);
    if (validActions.length === 0) {
      missing.push({
        key: "actions",
        label_ar: "الإجراء التالي", label_en: "Next action",
        reason_ar: "يجب تحديد إجراء تالي بعد إرسال المستند",
        reason_en: "A follow-up action is required after sending the document",
        example_ar: "متابعة بعد 3 أيام", example_en: "Follow up in 3 days",
      });
    }
  }

  // Validate document readiness
  if (r.resolvedOpportunityId && body.document_type) {
    const isSoft = body.document_type === "pricelist";
    const { data: quot } = await supabase
      .from("quotations")
      .select("id, sent_at")
      .eq("opportunity_id", r.resolvedOpportunityId)
      .eq("is_soft", isSoft)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!quot) {
      warnings.push(`BLOCKED: No ${body.document_type} found for this opportunity. Create one first using the quotation builder.`);
    } else {
      // Check items
      const { data: items } = await supabase
        .from("quotation_items")
        .select("id, supplier_material_id, quantity")
        .eq("quotation_id", quot.id)
        .eq("status", "active");

      if (!items || items.length === 0) {
        warnings.push(`BLOCKED: ${body.document_type === "pricelist" ? "Price list" : "Quotation"} has no active items.`);
      } else if (!isSoft) {
        const incomplete = items.filter((i: any) => !i.supplier_material_id || !i.quantity || i.quantity <= 0);
        if (incomplete.length > 0) {
          warnings.push(`BLOCKED: ${incomplete.length} item(s) missing supplier price or quantity. Complete the quotation builder first.`);
        }
      }
    }
  }
}

// ════════════════════════════════════════════════
// FUZZY SEARCH helper
// ════════════════════════════════════════════════
async function fuzzySearch(
  supabase: any, entity: string, query: string, scopeCustomerId?: string | null
): Promise<ChoiceItem[]> {
  const q = query.trim();
  if (!q) return [];

  let dbQuery;
  if (entity === "opportunities") {
    dbQuery = supabase
      .from("opportunities")
      .select("id, title, code, stage, status, customer_account_id, accounts:customer_account_id(display_name)")
      .is("deleted_at", null)
      .or(`title.ilike.%${q}%,code.ilike.%${q}%`);
    if (scopeCustomerId) dbQuery = dbQuery.eq("customer_account_id", scopeCustomerId);
    dbQuery = dbQuery.limit(5);
  } else if (entity === "projects") {
    dbQuery = supabase
      .from("projects")
      .select("id, name, code, customer_account_id")
      .is("deleted_at", null)
      .or(`name.ilike.%${q}%,code.ilike.%${q}%`);
    if (scopeCustomerId) dbQuery = dbQuery.eq("customer_account_id", scopeCustomerId);
    dbQuery = dbQuery.limit(5);
  } else {
    dbQuery = supabase
      .from("accounts")
      .select("id, display_name, code, status")
      .is("deleted_at", null)
      .or(`display_name.ilike.%${q}%,code.ilike.%${q}%,display_name_ar.ilike.%${q}%`)
      .limit(5);
  }

  const { data } = await dbQuery;
  if (!data) return [];

  return data.map((row: any) => {
    if (entity === "opportunities") {
      const custName = row.accounts?.display_name || "";
      return {
        type: "opportunity",
        id: row.id,
        label: row.title,
        code: row.code || "",
        subtitle: `${row.stage} • ${row.status} • ${custName}`,
      };
    }
    if (entity === "projects") {
      return {
        type: "project",
        id: row.id,
        label: row.name,
        code: row.code || "",
        subtitle: "",
      };
    }
    return {
      type: "customer",
      id: row.id,
      label: row.display_name || "",
      code: row.code || "",
      subtitle: row.status || "",
    };
  });
}

// ════════════════════════════════════════════════
// BUILD SUMMARY
// ════════════════════════════════════════════════
async function buildSummary(supabase: any, intent: Intent, r: any): Promise<string> {
  const parts: string[] = [];

  // Resolve names
  if (r.resolvedCustomerId) {
    if (r.customerMode === "create") {
      parts.push(`Customer: ${r.custDraft.displayName || r.custDraft.display_name} (new)`);
    } else {
      const { data: acc } = await supabase.from("accounts").select("display_name, code").eq("id", r.resolvedCustomerId).single();
      if (acc) parts.push(`Customer: ${acc.display_name} [${acc.code || ""}]`);
    }
  }

  if (r.resolvedProjectId) {
    if (r.projectMode === "create") {
      parts.push(`Project: ${r.projDraft.name} (new)`);
    } else if (r.projectMode === "default") {
      parts.push(`Project: General (auto)`);
    } else {
      const { data: proj } = await supabase.from("projects").select("name, code").eq("id", r.resolvedProjectId).single();
      if (proj) parts.push(`Project: ${proj.name} [${proj.code || ""}]`);
    }
  }

  if (r.resolvedOpportunityId) {
    if (r.oppMode === "create") {
      parts.push(`Opportunity: ${r.oppDraft.title} (new)`);
    } else {
      const { data: opp } = await supabase.from("opportunities").select("title, code").eq("id", r.resolvedOpportunityId).single();
      if (opp) parts.push(`Opportunity: ${opp.title} [${opp.code || ""}]`);
    }
  }

  switch (intent) {
    case "create_entity_v2":
      parts.unshift("Create entity");
      break;
    case "log_update_v2":
      parts.unshift("Log update");
      break;
    case "mark_won_v2":
      parts.unshift("Mark opportunity as WON ✅");
      break;
    case "mark_lost_v2":
      parts.unshift(`Mark opportunity as LOST ❌ — Reason: ${r.oppDraft.lostReason || r.oppDraft.lost_reason || "?"}`);
      break;
    case "send_document_v2":
      parts.unshift(`Send ${r.document_type === "pricelist" ? "price list" : "quotation"} 📄`);
      break;
  }

  if (r.ctx.summary) parts.push(`Context: "${r.ctx.summary.substring(0, 80)}"`);

  const validActions = (r.actions || []).filter((a: any) => a.taskType && a.dueDate);
  if (validActions.length > 0) {
    const firstAction = validActions[0];
    const label = TASK_TYPE_LABELS[firstAction.taskType] || firstAction.customTitle || firstAction.taskType;
    parts.push(`Next: ${label} — ${firstAction.dueDate}`);
  }

  return parts.join("\n");
}

// ════════════════════════════════════════════════
// COMMIT V3
// ════════════════════════════════════════════════
async function handleCommitV3(supabase: any, body: CommitRequest): Promise<Response> {
  const { token } = body;
  if (!token) return json({ error: "token is required" }, 400);

  const { data: conf, error: confErr } = await supabase
    .from("agent_confirmations")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .single();
  if (confErr || !conf) return json({ error: "Invalid or expired confirmation token" }, 400);
  if (new Date(conf.expires_at) < new Date()) return json({ error: "Confirmation token expired" }, 400);

  const payload: PrepareRequest = conf.payload;
  const resolved = payload._resolved || {};
  const intent = payload.intent;

  try {
    const result = await executeCommit(supabase, intent, payload, resolved);

    // Mark committed
    await supabase.from("agent_confirmations").update({
      status: "committed",
      committed_at: new Date().toISOString(),
      result,
    }).eq("token", token);

    // Log
    await supabase.from("agent_logs").insert({
      actor_phone: payload.actor_phone || "system",
      actor_user_id: payload.actor_user_id || null,
      event_type: `write.${intent}`,
      payload: result,
    });

    return json({ status: "committed", result });
  } catch (err: any) {
    await supabase.from("agent_confirmations").update({
      status: "error", error: err.message,
    }).eq("token", token);
    return json({ error: err.message }, 500);
  }
}

async function executeCommit(supabase: any, intent: Intent, payload: PrepareRequest, resolved: any): Promise<any> {
  let accountId = resolved.customer_id;
  let projectId = resolved.project_id;
  let opportunityId = resolved.opportunity_id;

  const custDraft = payload.customer?.draft || {};
  const projDraft = payload.project?.draft || {};
  const oppDraft = payload.opportunity?.draft || {};
  const ctx = payload.context || {};
  const actions = payload.actions || [];
  const customerMode = payload.customer?.mode || "chip";
  const projectMode = payload.project?.mode || "chip";
  const oppMode = payload.opportunity?.mode || "chip";

  // ── 1. Resolve/Create Customer ──
  if (customerMode === "create") {
    const displayName = custDraft.displayName || custDraft.display_name;
    if (!displayName?.trim()) throw new Error("Customer name is required");

    const { data: newAcc, error } = await supabase
      .from("accounts")
      .insert({ display_name: displayName.trim() })
      .select("id").single();
    if (error) throw error;
    accountId = newAcc.id;

    await supabase.from("customers").insert({
      account_id: accountId,
      customer_type: custDraft.customerType || custDraft.customer_type || "SME",
    });

    const contactPhone = custDraft.contactPhone || custDraft.contact_phone;
    const contactName = custDraft.contactName || custDraft.contact_name;
    if (contactPhone?.trim() || contactName?.trim()) {
      const { data: contact } = await supabase.from("contacts").insert({
        account_id: accountId,
        full_name: contactName?.trim() || displayName.trim(),
        phone: contactPhone?.trim() || null,
        is_primary: true,
      }).select("id").single();
      if (contact) {
        await supabase.from("accounts").update({ poc_contact_id: contact.id }).eq("id", accountId);
      }
    }
  } else if (customerMode === "edit" && accountId) {
    const updates: any = {};
    if (custDraft.displayName || custDraft.display_name) updates.display_name = (custDraft.displayName || custDraft.display_name).trim();
    if (custDraft.legalName || custDraft.legal_name) updates.legal_name = custDraft.legalName || custDraft.legal_name;
    if (Object.keys(updates).length > 0) {
      await supabase.from("accounts").update(updates).eq("id", accountId);
    }
  }

  if (!accountId && intent !== "mark_won_v2" && intent !== "mark_lost_v2") {
    throw new Error("Customer could not be resolved");
  }

  // ── 2. Resolve/Create Project ──
  if (projectMode === "create") {
    const projectName = projDraft.name;
    if (!projectName?.trim()) throw new Error("Project name is required");
    const { data: newProj, error } = await supabase.from("projects").insert({
      customer_account_id: accountId,
      name: projectName.trim(),
      project_type: projDraft.projectType || projDraft.project_type || null,
      current_phase: projDraft.currentPhase || projDraft.current_phase || null,
    }).select("id").single();
    if (error) throw error;
    projectId = newProj.id;
  } else if (projectMode === "default") {
    // Get-or-create "General" project
    const { data: existing } = await supabase
      .from("projects")
      .select("id")
      .eq("customer_account_id", accountId)
      .eq("name", "General")
      .is("deleted_at", null)
      .limit(1).maybeSingle();
    if (existing) {
      projectId = existing.id;
    } else {
      const { data: newProj } = await supabase.from("projects")
        .insert({ customer_account_id: accountId, name: "General" })
        .select("id").single();
      if (newProj) projectId = newProj.id;
    }
  } else if (projectMode === "edit" && projectId) {
    const updates: any = {};
    if (projDraft.name) updates.name = projDraft.name.trim();
    if (projDraft.projectType || projDraft.project_type) updates.project_type = projDraft.projectType || projDraft.project_type;
    if (projDraft.currentPhase || projDraft.current_phase) updates.current_phase = projDraft.currentPhase || projDraft.current_phase;
    if (Object.keys(updates).length > 0) {
      await supabase.from("projects").update(updates).eq("id", projectId);
    }
  }

  // ── 3. Resolve/Create Opportunity ──
  const isNotInterested = oppDraft.interestLevel === "Not interested" || oppDraft.interest_level === "Not interested";

  if (oppMode === "create") {
    const oppTitle = oppDraft.title;
    if (!oppTitle?.trim()) throw new Error("Opportunity title is required");
    if (!projectId) throw new Error("Project is required for opportunity");

    const { data: newOpp, error } = await supabase.from("opportunities").insert({
      customer_account_id: accountId,
      project_id: projectId,
      title: oppTitle.trim(),
      interest_level: oppDraft.interestLevel || oppDraft.interest_level || null,
      notes: oppDraft.notes || null,
      stage: isNotInterested ? "lost" : "discovery",
      ...(isNotInterested ? {
        lost_at: new Date().toISOString(),
        lost_reason: oppDraft.notInterestedReason || oppDraft.lost_reason || "Not interested",
      } : {}),
      ...(oppDraft.materialCategoryIds?.length ? { metadata: { material_category_ids: oppDraft.materialCategoryIds } } : {}),
    } as any).select("id").single();
    if (error) throw error;
    opportunityId = newOpp.id;
  } else if (oppMode === "edit" && opportunityId) {
    const updates: any = {};
    if (oppDraft.title) updates.title = oppDraft.title.trim();
    if (oppDraft.interestLevel || oppDraft.interest_level) updates.interest_level = oppDraft.interestLevel || oppDraft.interest_level;
    if (oppDraft.notes) updates.notes = oppDraft.notes;
    if (isNotInterested) {
      updates.stage = "lost";
      updates.lost_at = new Date().toISOString();
      updates.lost_reason = oppDraft.notInterestedReason || oppDraft.lost_reason || "Not interested";
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from("opportunities").update(updates).eq("id", opportunityId);
    }
  }

  // ── 4. Handle mark_won / mark_lost ──
  if (intent === "mark_won_v2" && opportunityId) {
    await supabase.from("opportunities").update({
      stage: "won", status: "closed", won_at: new Date().toISOString(),
    }).eq("id", opportunityId);
    // Close open tasks
    await supabase.from("tasks").update({
      status: "done", completed_at: new Date().toISOString(), outcome: "Opportunity won",
    }).eq("opportunity_id", opportunityId).in("status", ["open", "in_progress"]);
  }

  if (intent === "mark_lost_v2" && opportunityId) {
    const lostReason = oppDraft.lostReason || oppDraft.lost_reason || "Unknown";
    await supabase.from("opportunities").update({
      stage: "lost", status: "closed", lost_at: new Date().toISOString(), lost_reason: lostReason,
    }).eq("id", opportunityId);
    await supabase.from("tasks").update({
      status: "done", completed_at: new Date().toISOString(), outcome: "Opportunity lost",
    }).eq("opportunity_id", opportunityId).in("status", ["open", "in_progress"]);
  }

  // ── 5. Send document commit ──
  if (intent === "send_document_v2" && opportunityId) {
    const isSoft = payload.document_type === "pricelist";
    const { data: quot } = await supabase
      .from("quotations")
      .select("id")
      .eq("opportunity_id", opportunityId)
      .eq("is_soft", isSoft)
      .order("version", { ascending: false })
      .limit(1).single();
    if (!quot) throw new Error(`No ${payload.document_type} found`);

    await supabase.from("quotations").update({ sent_at: new Date().toISOString() }).eq("id", quot.id);

    // Advance stage for official quotation
    if (!isSoft) {
      await supabase.from("opportunities").update({ stage: "negotiation" })
        .eq("id", opportunityId).eq("stage", "rfp");
    }
  }

  // ── 6. Log Context / Communication ──
  const contextSummary = ctx.summary?.trim() ||
    (intent === "mark_won_v2" ? "Opportunity marked as WON" :
     intent === "mark_lost_v2" ? "Opportunity marked as LOST" :
     intent === "send_document_v2" ? `${payload.document_type === "pricelist" ? "Price list" : "Quotation"} sent` :
     "Agent update");

  const commMetadata: Record<string, any> = { source: "agent", intent };
  if (ctx.type === "internal_note") commMetadata.context_type = "internal_note";
  if (isNotInterested) {
    commMetadata.type = "status_change";
    commMetadata.new_stage = "lost";
    commMetadata.lost_reason = oppDraft.notInterestedReason || oppDraft.lost_reason || "Not interested";
  }
  if (intent === "mark_won_v2") {
    commMetadata.type = "status_change";
    commMetadata.new_stage = "won";
  }
  if (intent === "mark_lost_v2") {
    commMetadata.type = "status_change";
    commMetadata.new_stage = "lost";
    commMetadata.lost_reason = oppDraft.lostReason || oppDraft.lost_reason;
  }

  const { data: comm, error: commErr } = await supabase.from("communications").insert({
    account_id: accountId || null,
    project_id: projectId || null,
    opportunity_id: opportunityId,
    channel: ctx.type === "internal_note" ? "internal" : (ctx.channel || "whatsapp"),
    summary: contextSummary,
    direction: ctx.type === "communication" ? "outbound" : null,
    occurred_at: ctx.occurred_at || new Date().toISOString(),
    metadata: commMetadata,
  }).select("id").single();
  if (commErr) throw commErr;

  // ── 7. Auto-complete open tasks ──
  if (opportunityId && intent !== "create_entity_v2") {
    await supabase.from("tasks").update({
      status: "done", completed_at: new Date().toISOString(),
      outcome: contextSummary.substring(0, 200),
    }).eq("opportunity_id", opportunityId).in("status", ["open", "in_progress"]);
  }

  // ── 8. Create next actions ──
  const isTerminal = intent === "mark_lost_v2";
  if (!isNotInterested && !isTerminal) {
    if (intent === "mark_won_v2") {
      // Auto-create "Process order" task
      await supabase.from("tasks").insert({
        customer_account_id: accountId || null,
        project_id: projectId || null,
        opportunity_id: opportunityId,
        communication_id: comm.id,
        title: "Process order",
        task_type: "follow_up",
        status: "open",
        due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    } else if (actions.length > 0) {
      for (const action of actions) {
        if (!action.taskType || !action.dueDate) continue;
        const title = action.taskType === "custom"
          ? (action.customTitle || "Custom task")
          : (TASK_TYPE_LABELS[action.taskType] || action.taskType);

        await supabase.from("tasks").insert({
          customer_account_id: accountId || null,
          project_id: projectId || null,
          opportunity_id: opportunityId,
          communication_id: comm.id,
          title,
          task_type: "follow_up",
          status: "open",
          due_at: action.dueDate,
          channel: ctx.type === "communication" ? ctx.channel : null,
        });
      }
    }
  }

  return {
    account_id: accountId,
    project_id: projectId,
    opportunity_id: opportunityId,
    communication_id: comm.id,
    intent,
  };
}
