/**
 * process-notifications — cron edge function
 * Drains notification_logs rows with status='queued'
 * Dispatches via WhatsApp (existing send-whatsapp-message) or email (Resend)
 * Schedule: invoke every 60s via Supabase Cron
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Fetch queued rows
  const { data: rows, error } = await supabase
    .from("notification_logs")
    .select(`
      id, order_id, delivery_id, event_key, channel, recipient,
      template_id, rendered_body, attempts, payload,
      notification_templates ( body_template, subject, whatsapp_template_name, whatsapp_template_language, variables ),
      orders ( code, customer_contact_e164, customer_email, preferred_channel,
               customer_account_id, total, currency,
               deliveries ( id, scheduled_at, driver_id, vehicle_plate,
                 drivers ( full_name )
               )
             )
    `)
    .eq("status", "queued")
    .lte("attempts", MAX_ATTEMPTS - 1)
    .or("next_retry_at.is.null,next_retry_at.lte." + new Date().toISOString())
    .order("created_at")
    .limit(BATCH_SIZE);

  if (error) {
    console.error("Fetch error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  const results: { id: string; status: string; error?: string }[] = [];

  for (const row of (rows ?? [])) {
    // Mark as processing (inc attempts)
    await supabase
      .from("notification_logs")
      .update({ attempts: (row.attempts ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq("id", row.id);

    try {
      const order = (row as any).orders;
      const tpl   = (row as any).notification_templates;

      // ── Build template variables ──────────────────────────────
      const latestDelivery = order?.deliveries?.slice(-1)[0];
      const vars: Record<string, string> = {
        customer_name:          order?.customer_account_id ?? "",
        order_code:             order?.code ?? "",
        order_total_incl_vat:   order?.total != null ? String(Math.round(order.total * 1.15)) : "",
        currency:               order?.currency ?? "SAR",
        tracking_url:           "", // filled by issue_tracking_token if needed
        scheduled_at:           latestDelivery?.scheduled_at
                                  ? new Date(latestDelivery.scheduled_at).toLocaleDateString("ar-SA")
                                  : "",
        driver_name:            latestDelivery?.drivers?.full_name ?? "",
        vehicle_plate:          latestDelivery?.vehicle_plate ?? "",
        eta_window:             "خلال ساعتين",
        pod_url:                "",
        cancellation_reason:    (row as any).payload?.cancellation_reason ?? "",
      };

      // Fetch customer name from accounts (denorm not stored on orders)
      if (order?.customer_account_id) {
        const { data: acct } = await supabase
          .from("accounts")
          .select("display_name")
          .eq("id", order.customer_account_id)
          .single();
        if (acct?.display_name) vars.customer_name = acct.display_name;
      }

      // Fetch tracking token
      const { data: tkn } = await supabase
        .from("order_tracking_tokens")
        .select("token")
        .eq("order_id", row.order_id)
        .single();
      if (tkn?.token) {
        vars.tracking_url = `${Deno.env.get("PUBLIC_APP_URL") ?? "https://app.scale.sa"}/t/${tkn.token}`;
      }

      // Render body
      let body = row.rendered_body || tpl?.body_template || "";
      for (const [k, v] of Object.entries(vars)) {
        body = body.replaceAll(`{{${k}}}`, v);
      }

      let providerMessageId: string | undefined;

      if (row.channel === "whatsapp") {
        // ── WhatsApp: use existing send-whatsapp-message fn ──────
        const { data: wabaAcct } = await supabase
          .from("waba_accounts")
          .select("id, phone_number_id, waba_id")
          .eq("status", "active")
          .limit(1)
          .single();

        if (!wabaAcct) throw new Error("No active WABA account");

        const waPayload = tpl?.whatsapp_template_name
          ? {
              phone_number_id: wabaAcct.phone_number_id,
              waba_id:         wabaAcct.waba_id,
              to:              row.recipient,
              type:            "template",
              content: {
                template_name:     tpl.whatsapp_template_name,
                template_language: tpl.whatsapp_template_language ?? "ar",
                components:        buildTemplateComponents(vars),
              },
            }
          : {
              phone_number_id: wabaAcct.phone_number_id,
              waba_id:         wabaAcct.waba_id,
              to:              row.recipient,
              type:            "text",
              content: { body },
            };

        const waRes = await supabase.functions.invoke("send-whatsapp-message", {
          body: waPayload,
        });
        if (waRes.error) throw new Error(waRes.error.message ?? "WA send failed");
        providerMessageId = waRes.data?.message_id;

      } else if (row.channel === "email") {
        // ── Email: Resend ─────────────────────────────────────────
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (!resendKey) throw new Error("RESEND_API_KEY not configured");

        const subject = (tpl?.subject ?? "رسالة من Scale")
          .replaceAll("{{order_code}}", vars.order_code);

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from:    Deno.env.get("EMAIL_FROM") ?? "Scale <no-reply@scale.sa>",
            to:      [row.recipient],
            subject,
            text:    body,
          }),
        });

        const emailData = await emailRes.json();
        if (!emailRes.ok) throw new Error(emailData.message ?? "Email send failed");
        providerMessageId = emailData.id;
      }

      // Mark sent
      await supabase.from("notification_logs").update({
        status: "sent",
        provider_message_id: providerMessageId ?? null,
        rendered_body: body,
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);

      results.push({ id: row.id, status: "sent" });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const nextAttempts = (row.attempts ?? 0) + 1;
      const failed = nextAttempts >= MAX_ATTEMPTS;
      const nextRetry = failed ? null : new Date(Date.now() + Math.pow(2, nextAttempts) * 60_000).toISOString();

      await supabase.from("notification_logs").update({
        status:         failed ? "failed" : "queued",
        error:          msg,
        next_retry_at:  nextRetry,
        updated_at:     new Date().toISOString(),
      }).eq("id", row.id);

      results.push({ id: row.id, status: failed ? "failed" : "retrying", error: msg });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

function buildTemplateComponents(vars: Record<string, string>) {
  // Build WhatsApp template body components from variables
  const params = Object.values(vars).filter(Boolean).map(v => ({ type: "text", text: v }));
  return params.length ? [{ type: "body", parameters: params }] : [];
}
