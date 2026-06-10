import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  example?: { header_text?: string[]; body_text?: string[][] };
  buttons?: Array<{
    type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

interface CreateTemplateRequest {
  waba_id: string;
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  components: TemplateComponent[];
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

    const userId = claims.claims.sub;
    const url = new URL(req.url);
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // GET - List templates
    if (req.method === "GET") {
      const waba_id = url.searchParams.get("waba_id");
      const sync = url.searchParams.get("sync") === "true";

      if (!waba_id) {
        return new Response(
          JSON.stringify({ error: "waba_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Optionally sync with Meta API
      if (sync) {
        const { data: wabaAccount } = await serviceClient
          .from("waba_accounts")
          .select("access_token")
          .eq("waba_id", waba_id)
          .single();

        if (wabaAccount?.access_token) {
          console.log("Syncing templates from Meta API...");
          const response = await fetch(
            `https://graph.facebook.com/v22.0/${waba_id}/message_templates?limit=100`,
            {
              headers: { Authorization: `Bearer ${wabaAccount.access_token}` },
            }
          );

          if (response.ok) {
            const data = await response.json();
            const templates = data.data || [];

            // Upsert templates to database
            for (const template of templates) {
              await serviceClient.from("message_templates").upsert(
                {
                  waba_id: waba_id,
                  template_id: template.id,
                  name: template.name,
                  language: template.language,
                  category: template.category,
                  status: template.status,
                  components: template.components || [],
                  rejection_reason: template.rejected_reason || null,
                },
                { onConflict: "waba_id,name,language" }
              );
            }
          }
        }
      }

      // Return templates from database
      const { data: templates, error } = await serviceClient
        .from("message_templates")
        .select("*")
        .eq("waba_id", waba_id)
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch templates", details: error }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ templates }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST - Create template
    if (req.method === "POST") {
      const body: CreateTemplateRequest = await req.json();
      const { waba_id, name, category, language, components } = body;

      if (!waba_id || !name || !category || !language || !components) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate template name (lowercase, underscores, numbers only)
      if (!/^[a-z0-9_]+$/.test(name)) {
        return new Response(
          JSON.stringify({ error: "Template name must be lowercase with underscores and numbers only" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get access token
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

      // Create template via Meta API
      console.log("Creating template via Meta API:", name);
      const response = await fetch(
        `https://graph.facebook.com/v22.0/${waba_id}/message_templates`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${wabaAccount.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            category,
            language,
            components,
          }),
        }
      );

      const responseData = await response.json();
      console.log("Meta API response:", response.status, responseData);

      if (!response.ok) {
        return new Response(
          JSON.stringify({ 
            error: "Failed to create template", 
            details: responseData.error || responseData 
          }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Store template in database
      const { data: template, error: insertError } = await serviceClient
        .from("message_templates")
        .insert({
          waba_id,
          template_id: responseData.id,
          name,
          language,
          category,
          status: responseData.status || "PENDING",
          components,
          created_by: userId,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Failed to store template:", insertError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          template_id: responseData.id,
          status: responseData.status,
          template 
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE - Delete template
    if (req.method === "DELETE") {
      const waba_id = url.searchParams.get("waba_id");
      const template_name = url.searchParams.get("template_name");

      if (!waba_id || !template_name) {
        return new Response(
          JSON.stringify({ error: "waba_id and template_name are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get access token
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

      // Delete template via Meta API
      const response = await fetch(
        `https://graph.facebook.com/v22.0/${waba_id}/message_templates?name=${template_name}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${wabaAccount.access_token}` },
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        return new Response(
          JSON.stringify({ 
            error: "Failed to delete template", 
            details: responseData.error || responseData 
          }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Remove from database
      await serviceClient
        .from("message_templates")
        .delete()
        .eq("waba_id", waba_id)
        .eq("name", template_name);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Manage templates error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
