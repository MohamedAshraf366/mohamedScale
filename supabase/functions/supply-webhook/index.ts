import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-webhook-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // ── Log relevant headers ──
    const sigHeader = req.headers.get("x-webhook-signature");
    const secretHeader = req.headers.get("x-webhook-secret");
    console.log("[supply-webhook] Headers — x-webhook-signature:", sigHeader ? "present" : "absent",
      "x-webhook-secret:", secretHeader ? "present" : "absent",
      "content-type:", req.headers.get("content-type"));

    // ── Read raw body first (needed for HMAC) ──
    const rawBody = await req.text();
    console.log("[supply-webhook] Raw body:", rawBody.slice(0, 2000));

    // ── Verify webhook signature/secret ──
    const webhookSecret = Deno.env.get("SUPPLY_WEBHOOK_SECRET");
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (webhookSecret) {
      let verified = false;

      // Method 1: HMAC-SHA256 signature (per Fatai docs: X-Webhook-Signature)
      if (sigHeader) {
        const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
        verified = sigHeader === expected;
        console.log("[supply-webhook] HMAC verification:", verified ? "PASS" : "FAIL");
      }
      // Method 2: Simple secret header match (fallback for testing)
      else if (secretHeader) {
        verified = secretHeader === webhookSecret;
        console.log("[supply-webhook] Secret header verification:", verified ? "PASS" : "FAIL");
      }

      if (!verified) {
        console.warn("[supply-webhook] REJECTED: Auth failed");
        const { error: logErr } = await serviceClient.from("agent_logs").insert({
            event_type: "inbound",
            actor_phone: "system",
            channel: "supply_webhook",
            payload: {
              _auth_failed: true,
              sig_present: !!sigHeader,
              secret_header_present: !!secretHeader,
              timestamp: new Date().toISOString(),
            },
          });
        if (logErr) console.error("[supply-webhook] agent_logs insert error:", JSON.stringify(logErr));

        return json({ error: "Forbidden" }, 403);
      }
    } else {
      console.log("[supply-webhook] No SUPPLY_WEBHOOK_SECRET configured — skipping auth");
    }

    // ── Parse body ──
    let rawEvent: Record<string, unknown>;
    try {
      rawEvent = JSON.parse(rawBody);
    } catch {
      console.error("[supply-webhook] Invalid JSON body");
      return json({ error: "Invalid JSON" }, 400);
    }

    // ── Normalize Fatai webhook shape ──
    // Fatai sends: { "event": "message_received", "timestamp": "...", "data": { ... } }
    // NOT { "event_type": "..." }
    const eventType = (rawEvent.event || rawEvent.event_type || "unknown") as string;
    const eventData = (rawEvent.data || rawEvent) as Record<string, unknown>;
    const eventTimestamp = (rawEvent.timestamp || new Date().toISOString()) as string;

    // Extract fields per Fatai docs
    const waMessageId = (eventData.wa_message_id || null) as string | null;
    const fromPhone = ((eventData.from || "") as string).replace(/\D/g, "");
    const toPhone = ((eventData.to || "") as string).replace(/\D/g, "");
    // Fatai message_received uses "content" for text, not "text"
    const messageContent = (eventData.content || eventData.text || eventData.body || "") as string;
    const status = (eventData.status || null) as string | null;
    const messageType = (eventData.type || null) as string | null;
    const conversationId = (eventData.conversation_id || null) as string | null;

    console.log(`[supply-webhook] Parsed — event: ${eventType}, wa_message_id: ${waMessageId}, from: ${fromPhone}, status: ${status}, type: ${messageType}`);

    const senderPhone = fromPhone || toPhone || "unknown";
    let matchedTo: string | null = null;
    let classification: string | null = null;

    if (eventType === "message_status_updated") {
      const statusResult = await handleStatusUpdate(serviceClient, waMessageId, status, eventTimestamp);
      matchedTo = statusResult.matchedTo;

      const { error: logErr1 } = await serviceClient.from("agent_logs").insert({
          event_type: "inbound",
          actor_phone: senderPhone,
          channel: "supply_webhook",
          wa_message_id: waMessageId,
          wa_type: "status",
          payload: {
            event: eventType,
            data: eventData,
            _parsed: { waMessageId, status, fromPhone, toPhone },
            _matched_to: matchedTo,
          },
        });
      if (logErr1) console.error("[supply-webhook] agent_logs insert error:", JSON.stringify(logErr1));

      return json({ received: true, handled: true, status, matched_to: matchedTo });
    }

    if (eventType === "message_received") {
      const inboundResult = await handleInboundMessage(serviceClient, fromPhone, messageContent);
      matchedTo = inboundResult.matchedTo;
      classification = inboundResult.classification;

      const { error: logErr2 } = await serviceClient.from("agent_logs").insert({
          event_type: "inbound",
          actor_phone: senderPhone,
          channel: "supply_webhook",
          wa_message_id: waMessageId,
          wa_type: "inbound",
          payload: {
            event: eventType,
            data: eventData,
            _parsed: { waMessageId, fromPhone, content: messageContent.slice(0, 1000), type: messageType, conversationId },
            _matched_to: matchedTo,
            _classification: classification,
          },
        });
      if (logErr2) console.error("[supply-webhook] agent_logs insert error:", JSON.stringify(logErr2));

      return json({ received: true, handled: !!matchedTo, matched_to: matchedTo, classification });
    }

    // Unknown event type — still log it
    console.log("[supply-webhook] Unknown event:", eventType);
    const { error: logErr3 } = await serviceClient.from("agent_logs").insert({
        event_type: "inbound",
        actor_phone: senderPhone,
        channel: "supply_webhook",
        payload: { ...rawEvent, _parsed: { eventType, waMessageId, fromPhone } },
      });
    if (logErr3) console.error("[supply-webhook] agent_logs insert error:", JSON.stringify(logErr3));

    return json({ received: true, handled: false });
  } catch (err) {
    console.error("[supply-webhook] Error:", (err as Error).message, (err as Error).stack);
    return json({ error: (err as Error).message }, 500);
  }
});

// ── Status update handler ──
async function handleStatusUpdate(
  supabase: ReturnType<typeof createClient>,
  waMessageId: string | null,
  status: string | null,
  timestamp: string
): Promise<{ matchedTo: string | null }> {
  let matchedTo: string | null = null;
  if (!waMessageId || !status) return { matchedTo };

  const { data: validityRecords } = await supabase
    .from("supplier_quote_validity")
    .select("id, status, notes")
    .like("notes", `%${waMessageId}%`);

  if (validityRecords && validityRecords.length > 0) {
    matchedTo = "validity";
    for (const rec of validityRecords) {
      const currentNotes = rec.notes || "";
      const statusLine = `\nDelivery: ${status} at ${timestamp}`;
      if (!currentNotes.includes(`Delivery: ${status}`)) {
        await supabase
          .from("supplier_quote_validity")
          .update({ notes: currentNotes + statusLine })
          .eq("id", rec.id);
      }
    }
  }

  const { data: cases } = await supabase
    .from("renegotiation_cases")
    .select("id, notes")
    .like("notes", `%${waMessageId}%`);

  if (cases && cases.length > 0) {
    matchedTo = matchedTo ? "validity+renegotiation" : "renegotiation";
    for (const c of cases) {
      const currentNotes = c.notes || "";
      const statusLine = `\nDelivery: ${status} at ${timestamp}`;
      if (!currentNotes.includes(`Delivery: ${status}`)) {
        await supabase
          .from("renegotiation_cases")
          .update({ notes: currentNotes + statusLine })
          .eq("id", c.id);
      }
    }
  }

  console.log(`[supply-webhook] Status ${status} for msg ${waMessageId}: matched=${matchedTo}`);
  return { matchedTo };
}

// ── Inbound message handler ──
async function handleInboundMessage(
  supabase: ReturnType<typeof createClient>,
  senderPhone: string,
  messageText: string
): Promise<{ matchedTo: string | null; classification: string | null }> {
  if (!senderPhone) return { matchedTo: null, classification: null };

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, account_id, full_name, phone")
    .like("phone", `%${senderPhone.slice(-9)}%`)
    .limit(5);

  if (!contacts || contacts.length === 0) {
    console.log(`[supply-webhook] No contact found for phone ${senderPhone}`);
    return { matchedTo: null, classification: "unmatched" };
  }

  const accountIds = [...new Set(contacts.map((c) => c.account_id))];

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("account_id")
    .in("account_id", accountIds);

  if (!suppliers || suppliers.length === 0) {
    console.log(`[supply-webhook] Contact found but not a supplier: ${senderPhone}`);
    return { matchedTo: null, classification: "unmatched" };
  }

  const supplierAccountId = suppliers[0].account_id;

  const { data: openQuotes } = await supabase
    .from("supplier_quotes")
    .select("id")
    .eq("supplier_account_id", supplierAccountId)
    .eq("status", "approved");

  if (openQuotes && openQuotes.length > 0) {
    const quoteIds = openQuotes.map((q) => q.id);

    const { data: awaitingRecords } = await supabase
      .from("supplier_quote_validity")
      .select("id, supplier_quote_id, status")
      .in("supplier_quote_id", quoteIds)
      .eq("status", "outreach_sent")
      .order("created_at", { ascending: false })
      .limit(1);

    if (awaitingRecords && awaitingRecords.length > 0) {
      const record = awaitingRecords[0];
      const now = new Date().toISOString();

      const changeIndicators = ["تغيير", "تغير", "changed", "new price", "سعر جديد", "زيادة", "increase"];
      const isChanged = changeIndicators.some((indicator) =>
        messageText.toLowerCase().includes(indicator.toLowerCase())
      );

      if (isChanged) {
        await supabase
          .from("supplier_quote_validity")
          .update({
            status: "supplier_changed",
            supplier_responded_at: now,
            supplier_response: messageText.slice(0, 1000),
          })
          .eq("id", record.id);

        const { data: existingCase } = await supabase
          .from("renegotiation_cases")
          .select("id")
          .eq("original_quote_id", record.supplier_quote_id)
          .in("status", ["open", "outreach_sent", "quote_received", "under_review"])
          .limit(1);

        if (!existingCase || existingCase.length === 0) {
          await supabase.from("renegotiation_cases").insert({
            supplier_account_id: supplierAccountId,
            original_quote_id: record.supplier_quote_id,
            trigger_type: "validity_expiry",
            notes: `Supplier reported change via WhatsApp: "${messageText.slice(0, 500)}"`,
          });
        }

        return { matchedTo: "validity", classification: "changed" };
      } else {
        await supabase
          .from("supplier_quote_validity")
          .update({
            status: "supplier_confirmed",
            supplier_responded_at: now,
            supplier_response: messageText.slice(0, 1000),
          })
          .eq("id", record.id);

        return { matchedTo: "validity", classification: "no_change" };
      }
    }
  }

  return { matchedTo: null, classification: "unmatched" };
}
