import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Accept optional limit (default 10 to avoid timeout)
    let limit = 10;
    try {
      const body = await req.json();
      if (body?.limit && typeof body.limit === "number") limit = Math.min(body.limit, 20);
    } catch { /* no body is fine */ }

    // Get zones with numeric-only names in RYD region
    const { data: zones, error } = await sb
      .from("zones")
      .select("id, code, name, boundary_geojson")
      .eq("region_code", "RYD")
      .order("code");

    if (error) throw error;

    // Filter to nameless zones (numeric-only or null)
    const nameless = (zones || []).filter(
      (z: any) => !z.name || /^\d+$/.test(z.name)
    );

    if (nameless.length === 0) {
      return new Response(
        JSON.stringify({ updated: 0, remaining: 0, message: "All zones already named" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only process `limit` zones per invocation to avoid timeout
    const batch = nameless.slice(0, limit);
    let updated = 0;
    const errors: string[] = [];
    const results: { code: string; name: string; name_ar?: string }[] = [];

    for (const zone of batch) {
      try {
        const geo = zone.boundary_geojson;
        if (!geo) continue;

        const centroid = computeCentroid(geo);
        if (!centroid) continue;

        // Rate limit: 1 req/sec for Nominatim
        await new Promise((r) => setTimeout(r, 1100));

        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${centroid.lat}&lon=${centroid.lng}&format=json&accept-language=en,ar&zoom=16`,
          {
            headers: {
              "User-Agent": "ScalePlatform/1.0 (admin@scale.sa)",
            },
          }
        );

        if (!res.ok) {
          errors.push(`${zone.code}: HTTP ${res.status}`);
          continue;
        }

        const data = await res.json();

        const nameEn =
          data.address?.suburb ||
          data.address?.neighbourhood ||
          data.address?.city_district ||
          data.address?.town ||
          data.address?.village ||
          data.address?.hamlet ||
          data.address?.county ||
          // Fallback: extract from display_name (take first meaningful segment)
          (data.display_name ? extractFirstSegment(data.display_name) : null);

        if (!nameEn) {
          errors.push(`${zone.code}: no name found in response`);
          continue;
        }

        // Get Arabic name
        let nameAr: string | null = null;
        try {
          await new Promise((r) => setTimeout(r, 1100));
          const arRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${centroid.lat}&lon=${centroid.lng}&format=json&accept-language=ar&zoom=16`,
            {
              headers: {
                "User-Agent": "ScalePlatform/1.0 (admin@scale.sa)",
              },
            }
          );
          if (arRes.ok) {
            const arData = await arRes.json();
            nameAr =
              arData.address?.suburb ||
              arData.address?.neighbourhood ||
              arData.address?.city_district ||
              arData.address?.town ||
              arData.address?.village ||
              arData.address?.hamlet ||
              arData.address?.county ||
              (arData.display_name ? extractFirstSegment(arData.display_name) : null);
          }
        } catch {
          // skip Arabic name
        }

        const { error: updateError } = await sb
          .from("zones")
          .update({ name: nameEn, ...(nameAr ? { name_ar: nameAr } : {}) })
          .eq("id", zone.id);

        if (updateError) {
          errors.push(`${zone.code}: ${updateError.message}`);
        } else {
          updated++;
          results.push({ code: zone.code, name: nameEn, ...(nameAr ? { name_ar: nameAr } : {}) });
        }
      } catch (e: any) {
        errors.push(`${zone.code}: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        total: nameless.length,
        processed: batch.length,
        updated,
        remaining: nameless.length - batch.length,
        results,
        errors: errors.slice(0, 20),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function extractFirstSegment(displayName: string): string | null {
  const parts = displayName.split(',').map(s => s.trim());
  for (const part of parts) {
    if (part.length > 2 && !/^\d+$/.test(part) && !['Saudi Arabia', 'Riyadh Region', 'Riyadh'].includes(part)) {
      return part;
    }
  }
  return parts[0] || null;
}

function computeCentroid(
  geo: any
): { lat: number; lng: number } | null {
  try {
    const coords = extractCoordinates(geo);
    if (coords.length === 0) return null;

    let sumLat = 0;
    let sumLng = 0;
    for (const [lng, lat] of coords) {
      sumLat += lat;
      sumLng += lng;
    }
    return { lat: sumLat / coords.length, lng: sumLng / coords.length };
  } catch {
    return null;
  }
}

function extractCoordinates(geo: any): number[][] {
  if (!geo) return [];
  if (geo.type === "FeatureCollection") {
    return (geo.features || []).flatMap((f: any) =>
      extractCoordinates(f.geometry || f)
    );
  }
  if (geo.type === "Feature") {
    return extractCoordinates(geo.geometry);
  }
  if (geo.type === "Polygon") {
    return (geo.coordinates?.[0] || []) as number[][];
  }
  if (geo.type === "MultiPolygon") {
    return (geo.coordinates || []).flatMap(
      (poly: any) => (poly[0] || []) as number[][]
    );
  }
  return [];
}
