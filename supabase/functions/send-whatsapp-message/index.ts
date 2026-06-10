import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendMessageRequest {
  phone_number_id: string;
  to: string;
  type: "text" | "template" | "image" | "document" | "audio" | "video" | "location";
  content: {
    body?: string;
    template_name?: string;
    template_language?: string;
    components?: object[];
    media_id?: string;
    media_url?: string;
    caption?: string;
    filename?: string;
    latitude?: number;
    longitude?: number;
    name?: string;
    address?: string;
  };
  waba_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: SendMessageRequest = await req.json();
    const { phone_number_id, to, type, content, waba_id } = body;

    if (!phone_number_id || !to || !type || !waba_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get access token for this WABA
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: wabaAccount, error: wabaError } = await serviceClient
      .from("waba_accounts")
      .select("access_token")
      .eq("waba_id", waba_id)
      .single();

    if (wabaError || !wabaAccount?.access_token) {
      console.error("Failed to get WABA access token:", wabaError);
      return new Response(
        JSON.stringify({ error: "WABA account not found or no access token" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the message payload based on type
    let messagePayload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/[^0-9+]/g, "") // Keep + sign
    };

    switch (type) {
      case "text":
        messagePayload.type = "text";
        messagePayload.text = { 
          preview_url: true,
          body: content.body || "" 
        };
        break;

      case "template":
        messagePayload.type = "template";
        messagePayload.template = {
          name: content.template_name,
          language: { code: content.template_language || "en" },
          components: content.components || [],
        };
        break;

      case "image":
        messagePayload.type = "image";
        messagePayload.image = content.media_id 
          ? { id: content.media_id, caption: content.caption }
          : { link: content.media_url, caption: content.caption };
        break;

      case "document":
        messagePayload.type = "document";
        messagePayload.document = content.media_id
          ? { id: content.media_id, caption: content.caption, filename: content.filename }
          : { link: content.media_url, caption: content.caption, filename: content.filename };
        break;

      case "audio":
        messagePayload.type = "audio";
        messagePayload.audio = content.media_id
          ? { id: content.media_id }
          : { link: content.media_url };
        break;

      case "video":
        messagePayload.type = "video";
        messagePayload.video = content.media_id
          ? { id: content.media_id, caption: content.caption }
          : { link: content.media_url, caption: content.caption };
        break;

      case "location":
        messagePayload.type = "location";
        messagePayload.location = {
          latitude: content.latitude,
          longitude: content.longitude,
          name: content.name,
          address: content.address,
        };
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unsupported message type: ${type}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log("Sending message:", JSON.stringify(messagePayload, null, 2));

    // Send message via WhatsApp Cloud API
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${wabaAccount.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messagePayload),
      }
    );

    const responseData = await response.json();
    console.log("WhatsApp API response:", response.status, responseData);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          error: "Failed to send message", 
          details: responseData.error || responseData 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store outgoing message in database
    const messageId = responseData.messages?.[0]?.id;
    if (messageId) {
      // Find or create conversation
      const { data: conversation } = await serviceClient
        .from("whatsapp_conversations")
        .select("id")
        .eq("their_phone", to.replace(/\D/g, ""))
        .single();

      const conversationId = conversation?.id;

      // Insert message record
      await serviceClient.from("whatsapp_messages").insert({
        meta_message_id: messageId,
        conversation_id: conversationId,
        direction: "outbound",
        message_type: type,
        from_phone: phone_number_id,
        to_phone: to.replace(/\D/g, ""),
        text_body: type === "text" ? content.body : null,
        template_name: type === "template" ? content.template_name : null,
        media_id: content.media_id,
        media_caption: content.caption,
        happened_at: new Date().toISOString(),
        payload: messagePayload,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageId,
        response: responseData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Send message error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
