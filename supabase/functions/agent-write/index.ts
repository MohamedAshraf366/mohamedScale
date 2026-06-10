import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-agent-key",
};

// Task type labels (mirroring UI's TASK_TYPES)
const TASK_TYPE_LABELS: Record<string, string> = {
  call_client: "Call Client",
  send_quote: "Send Quotation",
  schedule_meeting: "Schedule Meeting",
  site_visit: "Site Visit",
  send_samples: "Send Samples",
  follow_up_whatsapp: "Follow Up (WhatsApp)",
  internal_review: "Internal Review",
};

interface WritePayload {
  intent: string;
  step: "prepare" | "commit";
  token?: string;
  actor_user_id?: string;
  actor_phone?: string;
  customer?: {
    mode: "create" | "select" | "edit";
    selectedId?: string;
    displayName?: string;
    customerType?: string;
    contactName?: string;
    contactPhone?: string;
  };
  project?: {
    mode: "create" | "select" | "default";
    selectedId?: string;
    name?: string;
    projectType?: string;
    currentPhase?: string;
  };
  opportunity?: {
    mode: "create" | "select" | "edit";
    selectedId?: string;
    title?: string;
    interestLevel?: string;
    priority?: string;
    notes?: string;
    lostReason?: string;
  };
  context?: {
    contextType?: string;
    channel?: string;
    summary: string;
  };
  actions?: Array<{
    taskType: string;
    dueDate: string;
    customTitle?: string;
  }>;
  // send_document_v2 specific
  document_type?: "quotation" | "pricelist";
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

    const body: WritePayload = await req.json();
    const { intent, step } = body;

    if (!intent) throw new Error("intent is required");

    if (step === "commit") {
      return await handleCommit(supabase, body);
    }

    return await handlePrepare(supabase, body);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handlePrepare(supabase: any, body: WritePayload) {
  const { intent, customer, project, opportunity, context, actions, document_type } = body;

  // Load intent profile
  const { data: intentData } = await supabase
    .from("agent_actions")
    .select("main_fields, title_en")
    .eq("intent_key", intent)
    .eq("status", "active")
    .single();

  if (!intentData) throw new Error(`Unknown or inactive intent: ${intent}`);

  const profile = intentData.main_fields;
  const sections = profile.sections || {};
  const errors: string[] = [];

  // ── send_document_v2 validations ──
  if (intent === "send_document_v2") {
    if (!opportunity?.selectedId) {
      errors.push("Opportunity selection is required");
    }
    if (!document_type || !["quotation", "pricelist"].includes(document_type)) {
      errors.push("document_type must be 'quotation' or 'pricelist'");
    }
    if (!context?.summary?.trim()) {
      errors.push("Context summary is required (how was the document sent?)");
    }
    if (!actions || actions.length === 0 || !actions[0]?.taskType || !actions[0]?.dueDate) {
      errors.push("At least one next action with type and due date is required");
    }

    // Validate quotation exists and items are ready
    if (opportunity?.selectedId && document_type) {
      const { data: quot } = await supabase
        .from("quotations")
        .select("id, sent_at")
        .eq("opportunity_id", opportunity.selectedId)
        .eq("is_soft", document_type === "pricelist")
        .limit(1)
        .maybeSingle();

      if (!quot) {
        errors.push(`No ${document_type} found for this opportunity`);
      } else if (document_type === "quotation") {
        // Check all items have supplier_material_id and quantity
        const { data: items } = await supabase
          .from("quotation_items")
          .select("id, supplier_material_id, quantity")
          .eq("quotation_id", quot.id)
          .eq("status", "active");
        if (!items || items.length === 0) {
          errors.push("Quotation has no active items");
        } else {
          const incomplete = items.filter((i: any) => !i.supplier_material_id || !i.quantity || i.quantity <= 0);
          if (incomplete.length > 0) {
            errors.push(`${incomplete.length} item(s) missing supplier price or quantity`);
          }
        }
      } else {
        // Pricelist: just need at least one item
        const { data: items } = await supabase
          .from("quotation_items")
          .select("id")
          .eq("quotation_id", quot.id)
          .eq("status", "active")
          .limit(1);
        if (!items || items.length === 0) {
          errors.push("Price list has no active items");
        }
      }
    }

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ status: "validation_error", errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build summary for send_document
    const summaryParts = [`Intent: ${intentData.title_en}`, `Document: ${document_type}`];
    if (context?.summary) summaryParts.push(`Note: ${context.summary.substring(0, 100)}`);

    const { data: conf, error: confErr } = await supabase
      .from("agent_confirmations")
      .insert({
        tool: "agent-write",
        actor_user_id: body.actor_user_id || "00000000-0000-0000-0000-000000000000",
        payload: body,
      })
      .select("token, expires_at")
      .single();
    if (confErr) throw confErr;

    return new Response(
      JSON.stringify({
        status: "ready",
        token: conf.token,
        expires_at: conf.expires_at,
        summary: summaryParts.join("\n"),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── Standard validations for create_entity_v2, log_update_v2, mark_won/lost ──
  if (sections.context?.required && (!context?.summary?.trim())) {
    errors.push("Context summary is required");
  }
  if (sections.next_action?.required && !sections.next_action?.auto_generate) {
    if (!actions || actions.length === 0 || !actions[0]?.taskType || !actions[0]?.dueDate) {
      errors.push("At least one next action with type and due date is required");
    }
  }

  if (sections.customer?.required) {
    if (customer?.mode === "create" && !customer?.displayName?.trim()) {
      errors.push("Customer name is required");
    }
    if (customer?.mode === "select" && !customer?.selectedId) {
      errors.push("Customer selection is required");
    }
    // create_entity_v2: customer required but mode is flexible
    if (sections.customer.mode === "create_or_select" && !customer?.displayName?.trim() && !customer?.selectedId) {
      errors.push("Customer name or selection is required");
    }
  }

  if (sections.project?.required) {
    if (project?.mode === "create" && !project?.name?.trim()) {
      errors.push("Project name is required");
    }
    if (project?.mode === "select" && !project?.selectedId) {
      errors.push("Project selection is required");
    }
  }

  if (sections.opportunity?.required) {
    if (opportunity?.mode === "create" && !opportunity?.title?.trim()) {
      errors.push("Opportunity title is required");
    }
    if (opportunity?.mode === "select" && !opportunity?.selectedId) {
      errors.push("Opportunity selection is required");
    }
  }

  // Intent-specific validations
  if (intent === "mark_lost_v2" && !opportunity?.lostReason?.trim()) {
    errors.push("Lost reason is required");
  }
  if (intent === "mark_won_v2" && opportunity?.selectedId) {
    const { data: q } = await supabase
      .from("quotations")
      .select("id")
      .eq("opportunity_id", opportunity.selectedId)
      .not("sent_at", "is", null)
      .eq("is_soft", false)
      .limit(1);
    if (!q || q.length === 0) {
      errors.push("Cannot mark as won: no official quotation has been sent");
    }
  }

  if (errors.length > 0) {
    return new Response(
      JSON.stringify({ status: "validation_error", errors }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Auto-resolve: if opportunity selected, resolve customer + project
  let resolvedCustomerId = customer?.selectedId;
  let resolvedProjectId = project?.selectedId;
  if (opportunity?.selectedId && (!resolvedCustomerId || !resolvedProjectId)) {
    const { data: opp } = await supabase
      .from("opportunities")
      .select("customer_account_id, project_id")
      .eq("id", opportunity.selectedId)
      .single();
    if (opp) {
      resolvedCustomerId = resolvedCustomerId || opp.customer_account_id;
      resolvedProjectId = resolvedProjectId || opp.project_id;
    }
  }

  // Build summary
  const summaryParts: string[] = [`Intent: ${intentData.title_en}`];
  if (customer?.displayName) summaryParts.push(`Customer: ${customer.displayName} (new)`);
  if (resolvedCustomerId && !customer?.displayName) {
    const { data: acc } = await supabase.from("accounts").select("display_name").eq("id", resolvedCustomerId).single();
    if (acc) summaryParts.push(`Customer: ${acc.display_name}`);
  }
  if (project?.name) summaryParts.push(`Project: ${project.name} (new)`);
  if (opportunity?.title) summaryParts.push(`Opportunity: ${opportunity.title} (new)`);
  if (context?.summary) summaryParts.push(`Note: ${context.summary.substring(0, 100)}`);

  const { data: conf, error: confErr } = await supabase
    .from("agent_confirmations")
    .insert({
      tool: "agent-write",
      actor_user_id: body.actor_user_id || "00000000-0000-0000-0000-000000000000",
      payload: body,
    })
    .select("token, expires_at")
    .single();
  if (confErr) throw confErr;

  return new Response(
    JSON.stringify({
      status: "ready",
      token: conf.token,
      expires_at: conf.expires_at,
      summary: summaryParts.join("\n"),
      resolved: { customerId: resolvedCustomerId, projectId: resolvedProjectId },
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleCommit(supabase: any, body: WritePayload) {
  const { token } = body;
  if (!token) throw new Error("token is required for commit step");

  const { data: conf, error: confErr } = await supabase
    .from("agent_confirmations")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .single();
  if (confErr || !conf) throw new Error("Invalid or expired confirmation token");
  if (new Date(conf.expires_at) < new Date()) throw new Error("Confirmation token expired");

  const payload: WritePayload = conf.payload;
  const { intent, customer, project, opportunity, context, actions, document_type } = payload;

  try {
    // ── send_document_v2 commit ──
    if (intent === "send_document_v2") {
      return await commitSendDocument(supabase, payload, token);
    }

    // ── Standard entity/update commits ──

    // 1. Resolve customer
    let accountId = customer?.selectedId || "";

    if (customer?.mode === "create" && customer?.displayName?.trim()) {
      const { data: newAcc, error } = await supabase
        .from("accounts")
        .insert({ display_name: customer.displayName.trim() })
        .select("id")
        .single();
      if (error) throw error;
      accountId = newAcc.id;

      await supabase.from("customers").insert({
        account_id: accountId,
        customer_type: customer.customerType || "SME",
      });

      if (customer.contactPhone?.trim() || customer.contactName?.trim()) {
        const { data: contact } = await supabase.from("contacts").insert({
          account_id: accountId,
          full_name: customer.contactName?.trim() || customer.displayName.trim(),
          phone: customer.contactPhone?.trim() || null,
          is_primary: true,
        }).select("id").single();
        if (contact) {
          await supabase.from("accounts").update({ poc_contact_id: contact.id }).eq("id", accountId);
        }
      }
    }

    // Auto-resolve from opportunity if needed
    if (opportunity?.selectedId && !accountId) {
      const { data: opp } = await supabase
        .from("opportunities")
        .select("customer_account_id, project_id")
        .eq("id", opportunity.selectedId)
        .single();
      if (opp) accountId = opp.customer_account_id;
    }

    // 2. Resolve project
    let projectId = project?.selectedId || "";

    if (project?.mode === "create" && project?.name?.trim() && accountId) {
      const { data: newProj, error } = await supabase
        .from("projects")
        .insert({
          customer_account_id: accountId,
          name: project.name.trim(),
          project_type: project.projectType || null,
          current_phase: project.currentPhase || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      projectId = newProj.id;
    } else if ((project?.mode === "default" || (!projectId && (opportunity?.mode === "create"))) && accountId) {
      const { data: existing } = await supabase
        .from("projects")
        .select("id")
        .eq("customer_account_id", accountId)
        .eq("name", "General")
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      if (existing) {
        projectId = existing.id;
      } else {
        const { data: newProj } = await supabase
          .from("projects")
          .insert({ customer_account_id: accountId, name: "General" })
          .select("id")
          .single();
        if (newProj) projectId = newProj.id;
      }
    }

    // Auto-resolve project from opportunity
    if (opportunity?.selectedId && !projectId) {
      const { data: opp } = await supabase
        .from("opportunities")
        .select("project_id")
        .eq("id", opportunity.selectedId)
        .single();
      if (opp) projectId = opp.project_id;
    }

    // 3. Resolve opportunity
    let opportunityId = opportunity?.selectedId || null;

    if (opportunity?.mode === "create" && opportunity?.title?.trim() && projectId && accountId) {
      const isNotInterested = opportunity.interestLevel === "Not interested";
      const { data: newOpp, error } = await supabase
        .from("opportunities")
        .insert({
          customer_account_id: accountId,
          project_id: projectId,
          title: opportunity.title.trim(),
          interest_level: opportunity.interestLevel || null,
          priority: opportunity.priority || "medium",
          notes: opportunity.notes || null,
          stage: isNotInterested ? "lost" : "discovery",
          ...(isNotInterested ? { lost_at: new Date().toISOString(), lost_reason: opportunity.lostReason || "Not interested" } : {}),
        })
        .select("id")
        .single();
      if (error) throw error;
      opportunityId = newOpp.id;
    }

    // Handle mark_won / mark_lost
    if (intent === "mark_won_v2" && opportunityId) {
      await supabase.from("opportunities").update({
        stage: "won", status: "closed", won_at: new Date().toISOString(),
      }).eq("id", opportunityId);
      await supabase.from("tasks").update({
        status: "done", completed_at: new Date().toISOString(), outcome: "Opportunity won",
      }).eq("opportunity_id", opportunityId).in("status", ["open", "in_progress"]);
    }

    if (intent === "mark_lost_v2" && opportunityId) {
      await supabase.from("opportunities").update({
        stage: "lost", status: "closed", lost_at: new Date().toISOString(),
        lost_reason: opportunity?.lostReason || "Unknown",
      }).eq("id", opportunityId);
      await supabase.from("tasks").update({
        status: "done", completed_at: new Date().toISOString(), outcome: "Opportunity lost",
      }).eq("opportunity_id", opportunityId).in("status", ["open", "in_progress"]);
    }

    // 4. Log context
    const contextSummary = context?.summary?.trim() || 
      (intent === "mark_won_v2" ? "Opportunity marked as WON" : 
       intent === "mark_lost_v2" ? "Opportunity marked as LOST" : "Agent update");

    const { data: comm, error: commErr } = await supabase.from("communications").insert({
      account_id: accountId || null,
      project_id: projectId || null,
      opportunity_id: opportunityId,
      channel: context?.contextType === "internal_note" ? "internal" : (context?.channel || "whatsapp"),
      summary: contextSummary,
      direction: context?.contextType === "communication" ? "outbound" : null,
      occurred_at: new Date().toISOString(),
      metadata: { source: "agent", intent },
    }).select("id").single();
    if (commErr) throw commErr;

    // 5. Auto-complete open tasks (for existing opportunities on update)
    if (opportunityId && (opportunity?.mode === "select" || opportunity?.mode === "edit") && intent === "log_update_v2") {
      await supabase.from("tasks").update({
        status: "done", completed_at: new Date().toISOString(),
        outcome: contextSummary.substring(0, 200),
      }).eq("opportunity_id", opportunityId).in("status", ["open", "in_progress"]);
    }

    // 6. Create next actions
    const isNotInterested = opportunity?.interestLevel === "Not interested";
    const isTerminal = intent === "mark_won_v2" || intent === "mark_lost_v2";

    if (!isNotInterested && !isTerminal && actions && actions.length > 0) {
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
          channel: context?.channel || null,
        });
      }
    } else if (intent === "mark_won_v2") {
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
    }

    // 7. Log agent action
    await supabase.from("agent_logs").insert({
      actor_phone: payload.actor_phone || "system",
      actor_user_id: payload.actor_user_id || null,
      event_type: `write.${intent}`,
      payload: {
        account_id: accountId,
        project_id: projectId,
        opportunity_id: opportunityId,
        communication_id: comm.id,
      },
    });

    // Mark confirmation as committed
    await supabase.from("agent_confirmations").update({
      status: "committed",
      committed_at: new Date().toISOString(),
      result: { accountId, projectId, opportunityId, commId: comm.id },
    }).eq("token", token);

    return new Response(
      JSON.stringify({
        status: "committed",
        result: { accountId, projectId, opportunityId, commId: comm.id },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    await supabase.from("agent_confirmations").update({
      status: "error", error: err.message,
    }).eq("token", token);
    throw err;
  }
}

async function commitSendDocument(supabase: any, payload: WritePayload, token: string) {
  const { opportunity, context, actions, document_type } = payload;
  const opportunityId = opportunity!.selectedId!;
  const isSoft = document_type === "pricelist";

  try {
    // 1. Get the quotation
    const { data: quot, error: qErr } = await supabase
      .from("quotations")
      .select("id")
      .eq("opportunity_id", opportunityId)
      .eq("is_soft", isSoft)
      .limit(1)
      .single();
    if (qErr || !quot) throw new Error(`No ${document_type} found for this opportunity`);

    // 2. Mark as sent
    await supabase.from("quotations").update({
      sent_at: new Date().toISOString(),
    }).eq("id", quot.id);

    // 3. Resolve customer/project from opportunity
    const { data: opp } = await supabase
      .from("opportunities")
      .select("customer_account_id, project_id")
      .eq("id", opportunityId)
      .single();

    const accountId = opp?.customer_account_id || null;
    const projectId = opp?.project_id || null;

    // 4. If official quotation, advance stage to negotiation
    if (!isSoft) {
      await supabase.from("opportunities").update({
        stage: "negotiation",
      }).eq("id", opportunityId).eq("stage", "rfp");
    }

    // 5. Log communication
    const { data: comm, error: commErr } = await supabase.from("communications").insert({
      account_id: accountId,
      project_id: projectId,
      opportunity_id: opportunityId,
      channel: context?.channel || "whatsapp",
      summary: context?.summary?.trim() || `${document_type === "pricelist" ? "Price list" : "Quotation"} sent`,
      direction: "outbound",
      occurred_at: new Date().toISOString(),
      metadata: {
        source: "agent",
        intent: "send_document_v2",
        document_type: document_type === "pricelist" ? "pricelist_sent" : "quotation_sent",
        quotation_id: quot.id,
      },
    }).select("id").single();
    if (commErr) throw commErr;

    // 6. Auto-complete open tasks
    await supabase.from("tasks").update({
      status: "done", completed_at: new Date().toISOString(),
      outcome: `${document_type === "pricelist" ? "Price list" : "Quotation"} sent`,
    }).eq("opportunity_id", opportunityId).in("status", ["open", "in_progress"]);

    // 7. Create next actions
    if (actions && actions.length > 0) {
      for (const action of actions) {
        if (!action.taskType || !action.dueDate) continue;
        const title = action.taskType === "custom"
          ? (action.customTitle || "Custom task")
          : (TASK_TYPE_LABELS[action.taskType] || action.taskType);

        await supabase.from("tasks").insert({
          customer_account_id: accountId,
          project_id: projectId,
          opportunity_id: opportunityId,
          communication_id: comm.id,
          title,
          task_type: "follow_up",
          status: "open",
          due_at: action.dueDate,
          channel: context?.channel || null,
        });
      }
    }

    // 8. Log
    await supabase.from("agent_logs").insert({
      actor_phone: payload.actor_phone || "system",
      actor_user_id: payload.actor_user_id || null,
      event_type: "write.send_document_v2",
      payload: {
        opportunity_id: opportunityId,
        quotation_id: quot.id,
        document_type,
        communication_id: comm.id,
      },
    });

    // 9. Mark confirmation committed
    await supabase.from("agent_confirmations").update({
      status: "committed",
      committed_at: new Date().toISOString(),
      result: { opportunityId, quotationId: quot.id, commId: comm.id, document_type },
    }).eq("token", token);

    return new Response(
      JSON.stringify({
        status: "committed",
        result: {
          opportunityId,
          quotationId: quot.id,
          commId: comm.id,
          document_type,
          message: `${document_type === "pricelist" ? "Price list" : "Quotation"} marked as sent successfully`,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    await supabase.from("agent_confirmations").update({
      status: "error", error: err.message,
    }).eq("token", token);
    throw err;
  }
}
