import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface OutreachRequest {
  action: "validity_confirmation" | "renegotiation_outreach" | "follow_up";
  to: string;
  body?: string;
  template_name?: string;
  template_language?: string;
  template_components?: unknown[];
  supplier_quote_id?: string;
  validity_record_id?: string;
  renegotiation_case_id?: string;
  supplier_account_id?: string;
  send_mode?: "text" | "template";
  _debug?: boolean;
}

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
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    // ── Config ──
    const fataiBaseUrl = Deno.env.get("FATAI_BASE_URL");
    const fataiApiKey = Deno.env.get("FATAI_API_KEY");
    const defaultPhoneNumberId = Deno.env.get("FATAI_PHONE_NUMBER_ID") || "";

    if (!fataiBaseUrl || !fataiApiKey) {
      return json({ error: "Fatai not configured. Set FATAI_BASE_URL and FATAI_API_KEY." }, 500);
    }

    // ── Parse request ──
    const reqBody: OutreachRequest = await req.json();
    const {
      action,
      to,
      body: textBody,
      template_name,
      template_language,
      template_components,
      supplier_quote_id,
      validity_record_id,
      renegotiation_case_id,
      send_mode = "text",
      _debug = false,
    } = reqBody;

    if (!to) return json({ error: "Missing 'to' phone number" }, 400);
    if (!action) return json({ error: "Missing 'action'" }, 400);

    // Clean phone: digits only, then add + prefix for E.164
    const digitsOnly = to.replace(/\D/g, "");
    const cleanPhone = `+${digitsOnly}`;

    // ── Build default text if none provided ──
    let messageText = textBody;
    if (send_mode === "text" && !messageText) {
      switch (action) {
        case "validity_confirmation":
          messageText =
            "مرحباً، نود التأكد من صلاحية الأسعار المقدمة سابقاً. هل الأسعار والشروط لا تزال سارية؟ نرجو الرد بالتأكيد أو إبلاغنا بأي تغييرات. شكراً لتعاونكم.";
          break;
        case "renegotiation_outreach":
          messageText =
            "مرحباً، نود مناقشة تحديث الأسعار والشروط الخاصة بالعرض المقدم. هل يمكنكم تزويدنا بعرض محدث؟ شكراً.";
          break;
        case "follow_up":
          messageText =
            "مرحباً، هذه رسالة متابعة بخصوص طلبنا السابق. نرجو الرد في أقرب وقت. شكراً.";
          break;
      }
    }

    // ── Build Fatai URL ──
    // FATAI_BASE_URL may be the root (e.g. https://x.supabase.co/functions/v1/send-message)
    // or include a trailing path. We append the sub-path only if not already present.
    const baseClean = fataiBaseUrl.replace(/\/$/, "");
    let fataiUrl: string;
    let fataiBody: Record<string, unknown>;

    if (send_mode === "template" && template_name) {
      // If base already ends with the function name, just append /messages/send-template
      // If base is just a root, append full path
      fataiUrl = baseClean.endsWith("/messages/send-template")
        ? baseClean
        : baseClean + "/messages/send-template";
      fataiBody = {
        to: cleanPhone,
        template: {
          name: template_name,
          language: template_language || "ar",
          components: template_components || [],
        },
      };
      if (defaultPhoneNumberId) {
        fataiBody.phone_number_id = defaultPhoneNumberId;
      }
    } else {
      fataiUrl = baseClean.endsWith("/messages/send")
        ? baseClean
        : baseClean + "/messages/send";
      fataiBody = {
        to: cleanPhone,
        text: messageText,
      };
      if (defaultPhoneNumberId) {
        fataiBody.phone_number_id = defaultPhoneNumberId;
      }
    }

    console.log(`[supply-outreach] Sending ${action} via Fatai: ${fataiUrl}`);
    console.log(`[supply-outreach] Request payload:`, JSON.stringify(fataiBody));

    // Fatai is a Supabase Edge Function on another project.
    // The Supabase gateway needs the target project's anon key in the
    // "apikey" header (or Authorization Bearer) to let the request through,
    // even when verify_jwt=false. Fatai's own app-level auth uses x-api-key.
    const fataiHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": fataiApiKey,
    };

    const fataiRes = await fetch(fataiUrl, {
      method: "POST",
      headers: fataiHeaders,
      body: JSON.stringify(fataiBody),
    });

    const fataiData = await fataiRes.json();
    console.log("[supply-outreach] Fatai response:", fataiRes.status, JSON.stringify(fataiData));

    if (!fataiRes.ok) {
      const errorResult: Record<string, unknown> = {
        error: "Fatai send failed",
        status: fataiRes.status,
        details: fataiData,
      };
      if (_debug) {
        errorResult.debug = {
          fatai_request_payload: fataiBody,
          fatai_response_status: fataiRes.status,
          fatai_response_body: fataiData,
          fatai_url: fataiUrl,
          timestamp: new Date().toISOString(),
        };
      }
      return json(errorResult, 502);
    }

    // Fatai returns: { success, wa_message_id, conversation_id }
    const waMessageId = fataiData?.wa_message_id || null;
    const conversationId = fataiData?.conversation_id || null;

    // ── Update Supply tables ──
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();

    if (action === "validity_confirmation" && supplier_quote_id) {
      if (validity_record_id) {
        await serviceClient
          .from("supplier_quote_validity")
          .update({
            status: "outreach_sent",
            outreach_at: now,
            outreach_method: "whatsapp_fatai",
            notes: `wa_message_id: ${waMessageId || "unknown"}`,
          })
          .eq("id", validity_record_id);
      } else {
        await serviceClient.from("supplier_quote_validity").insert({
          supplier_quote_id,
          status: "outreach_sent",
          outreach_at: now,
          outreach_method: "whatsapp_fatai",
          notes: `wa_message_id: ${waMessageId || "unknown"}`,
        });
      }
    }

    if (action === "renegotiation_outreach" && renegotiation_case_id) {
      await serviceClient
        .from("renegotiation_cases")
        .update({
          status: "outreach_sent",
          assigned_to: user.id,
          notes: `Outreach sent via WhatsApp at ${now}. wa_message_id: ${waMessageId || "unknown"}`,
          updated_by: user.id,
        })
        .eq("id", renegotiation_case_id);
    }

    // ── Log to agent_logs ──
    const { error: logErr } = await serviceClient.from("agent_logs").insert({
      event_type: "outbound",
      actor_phone: digitsOnly,
      channel: "supply_webhook",
      wa_message_id: waMessageId,
      wa_type: send_mode,
      payload: {
        action,
        to: cleanPhone,
        send_mode,
        fatai_status: fataiRes.status,
        wa_message_id: waMessageId,
        conversation_id: conversationId,
        supplier_quote_id: supplier_quote_id || null,
        validity_record_id: validity_record_id || null,
        renegotiation_case_id: renegotiation_case_id || null,
      },
    });
    if (logErr) console.error("[supply-outreach] agent_logs insert error:", JSON.stringify(logErr));

    const result: Record<string, unknown> = {
      success: true,
      wa_message_id: waMessageId,
      conversation_id: conversationId,
      action,
      to: cleanPhone,
    };

    if (_debug) {
      result.debug = {
        fatai_request_payload: fataiBody,
        fatai_response_status: fataiRes.status,
        fatai_response_body: fataiData,
        fatai_url: fataiUrl,
        timestamp: now,
      };
    }

    return json(result);
  } catch (err) {
    console.error("[supply-outreach] Error:", err);
    return json({ error: "Internal error", details: (err as Error).message }, 500);
  }
});
