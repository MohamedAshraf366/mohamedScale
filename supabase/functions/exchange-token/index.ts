import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExchangeRequest {
  code: string;
  waba_id?: string;
  phone_number_id?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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
    const { code, waba_id, phone_number_id }: ExchangeRequest = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ error: "Authorization code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const META_APP_ID = Deno.env.get("META_APP_ID");
    const META_APP_SECRET = Deno.env.get("META_APP_SECRET");

    if (!META_APP_ID || !META_APP_SECRET) {
      console.error("Missing META_APP_ID or META_APP_SECRET");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange authorization code for access token
    console.log("Exchanging code for access token...");
    const tokenUrl = `https://graph.facebook.com/v22.0/oauth/access_token`;
    const tokenParams = new URLSearchParams({
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      code: code,
    });

    const tokenResponse = await fetch(`${tokenUrl}?${tokenParams}`, {
      method: "GET",
    });

    const tokenData = await tokenResponse.json();
    console.log("Token exchange response status:", tokenResponse.status);

    if (!tokenResponse.ok || tokenData.error) {
      console.error("Token exchange failed:", tokenData);
      return new Response(
        JSON.stringify({ 
          error: "Failed to exchange token", 
          details: tokenData.error?.message || tokenData 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in; // seconds until expiration

    // If we have waba_id from the session info, fetch WABA details
    let wabaDetails = null;
    if (waba_id) {
      console.log("Fetching WABA details for:", waba_id);
      const wabaResponse = await fetch(
        `https://graph.facebook.com/v22.0/${waba_id}?fields=id,name,currency,timezone_id,business_verification_status,account_review_status,on_behalf_of_business_info`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      wabaDetails = await wabaResponse.json();
      console.log("WABA details:", wabaDetails);
    }

    // Fetch phone number details if provided
    let phoneDetails = null;
    if (phone_number_id) {
      console.log("Fetching phone number details for:", phone_number_id);
      const phoneResponse = await fetch(
        `https://graph.facebook.com/v22.0/${phone_number_id}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      phoneDetails = await phoneResponse.json();
      console.log("Phone details:", phoneDetails);
    }

    // Calculate token expiration time
    const tokenExpiresAt = expiresIn 
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    // Store WABA account in database
    if (waba_id) {
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const wabaRecord = {
        waba_id: waba_id,
        business_id: wabaDetails?.on_behalf_of_business_info?.id || wabaDetails?.id || "unknown",
        phone_number_id: phone_number_id || null,
        display_phone_number: phoneDetails?.display_phone_number || null,
        verified_name: phoneDetails?.verified_name || wabaDetails?.name || null,
        quality_rating: phoneDetails?.quality_rating || null,
        access_token: accessToken,
        token_expires_at: tokenExpiresAt,
        status: "active",
        onboarded_by: userId,
        onboarded_at: new Date().toISOString(),
      };

      const { data: existingWaba } = await serviceClient
        .from("waba_accounts")
        .select("id")
        .eq("waba_id", waba_id)
        .single();

      if (existingWaba) {
        // Update existing record
        const { error: updateError } = await serviceClient
          .from("waba_accounts")
          .update(wabaRecord)
          .eq("waba_id", waba_id);

        if (updateError) {
          console.error("Failed to update WABA account:", updateError);
        }
      } else {
        // Insert new record
        const { error: insertError } = await serviceClient
          .from("waba_accounts")
          .insert(wabaRecord);

        if (insertError) {
          console.error("Failed to insert WABA account:", insertError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        waba_id: waba_id,
        phone_number_id: phone_number_id,
        waba_details: wabaDetails,
        phone_details: phoneDetails,
        token_expires_at: tokenExpiresAt,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: unknown) {
    console.error("Exchange token error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
