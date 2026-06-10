import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const phone_number_id = formData.get("phone_number_id") as string | null;
    const waba_id = formData.get("waba_id") as string | null;

    if (!file || !phone_number_id || !waba_id) {
      return new Response(
        JSON.stringify({ error: "file, phone_number_id, and waba_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file type
    const supportedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/3gpp",
      "audio/aac",
      "audio/mp4",
      "audio/mpeg",
      "audio/amr",
      "audio/ogg",
      "application/pdf",
      "application/vnd.ms-powerpoint",
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
    ];

    if (!supportedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ 
          error: "Unsupported file type", 
          supported: supportedTypes,
          received: file.type 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get access token
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: wabaAccount } = await serviceClient
      .from("waba_accounts")
      .select("access_token")
      .eq("waba_id", waba_id)
      .single();

    if (!wabaAccount?.access_token) {
      return new Response(
        JSON.stringify({ error: "WABA account not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read file content
    const fileBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);

    // Upload to WhatsApp Media API
    console.log(`Uploading media: ${file.name} (${file.type}, ${fileBytes.length} bytes)`);

    const uploadFormData = new FormData();
    uploadFormData.append("messaging_product", "whatsapp");
    uploadFormData.append("file", new Blob([fileBytes], { type: file.type }), file.name);
    uploadFormData.append("type", file.type);

    const response = await fetch(
      `https://graph.facebook.com/v22.0/${phone_number_id}/media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${wabaAccount.access_token}`,
        },
        body: uploadFormData,
      }
    );

    const responseData = await response.json();
    console.log("Media upload response:", response.status, responseData);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          error: "Failed to upload media", 
          details: responseData.error || responseData 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also store in Supabase Storage for reference
    const storagePath = `${waba_id}/${responseData.id}_${file.name}`;
    await serviceClient.storage
      .from("whatsapp-media")
      .upload(storagePath, fileBytes, {
        contentType: file.type,
        upsert: true,
      });

    return new Response(
      JSON.stringify({
        success: true,
        media_id: responseData.id,
        storage_path: storagePath,
        file_name: file.name,
        file_type: file.type,
        file_size: fileBytes.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Upload media error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
