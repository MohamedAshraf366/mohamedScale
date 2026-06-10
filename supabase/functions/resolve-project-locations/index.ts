import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function extractCoords(url: string): { lat: number; lng: number } | null {
  const patterns = [
    /@([-\d.]+),([-\d.]+)/,
    /\/place\/([-\d.]+),([-\d.]+)/,
    /[?&]q=([-\d.]+),([-\d.]+)/,
    /!3d([-\d.]+)!4d([-\d.]+)/,
    /\/dir\/([-\d.]+),([-\d.]+)/,
    /\/search\/([-\d.]+),\+?([-\d.]+)/,
  ]
  // Also try decoding the URL in case coords are URL-encoded
  const urls = [url, decodeURIComponent(url)]
  for (const u of urls) {
    for (const pattern of patterns) {
      const match = u.match(pattern)
      if (match) {
        const lat = parseFloat(match[1])
        const lng = parseFloat(match[2])
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return { lat, lng }
        }
      }
    }
  }
  return null
}

async function resolveShortLink(url: string): Promise<string | null> {
  try {
    // Follow redirects manually up to 5 hops
    let currentUrl = url
    for (let i = 0; i < 5; i++) {
      const res = await fetch(currentUrl, { redirect: 'manual' })
      const location = res.headers.get('location')
      if (!location) {
        // No more redirects, try following all redirects from original
        const res2 = await fetch(url, { redirect: 'follow' })
        console.log(`resolveShortLink final (follow): ${res2.url}`)
        return res2.url
      }
      console.log(`resolveShortLink hop ${i}: ${location}`)
      // Check if we can extract coords from this hop
      const coords = extractCoords(location)
      if (coords) return location
      currentUrl = location
    }
    // After all hops, try a full follow
    const res = await fetch(url, { redirect: 'follow' })
    console.log(`resolveShortLink final (follow after hops): ${res.url}`)
    return res.url
  } catch (e) {
    console.error(`Failed to resolve ${url}:`, e)
    return null
  }
}

async function processLocation(supabase: any, locationId: string, addressLink: string) {
  const expandedUrl = await resolveShortLink(addressLink)
  if (!expandedUrl) {
    console.error(`${locationId}: could not resolve link`)
    return { success: false, reason: 'could not resolve link' }
  }

  const coords = extractCoords(expandedUrl)
  if (!coords) {
    console.error(`${locationId}: no coords in resolved URL: ${expandedUrl}`)
    return { success: false, reason: 'no coords in resolved URL' }
  }

  const { error: updateError } = await supabase
    .from('locations')
    .update({ lat: coords.lat, lng: coords.lng })
    .eq('id', locationId)

  if (updateError) {
    console.error(`${locationId}: update failed - ${updateError.message}`)
    return { success: false, reason: updateError.message }
  }

  // Clear needs_review on linked projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, metadata')
    .eq('location_id', locationId)

  if (projects) {
    for (const p of projects) {
      const meta = (p.metadata as any) || {}
      if (meta.needs_review) {
        delete meta.needs_review
        await supabase.from('projects').update({ metadata: meta }).eq('id', p.id)
      }
    }
  }

  return { success: true, coords }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json().catch(() => ({}))
    const { location_id, resolve_only, address_link } = body

    // Resolve-only mode: just resolve a URL and return coords without touching DB
    if (resolve_only && address_link) {
      const isShort = /maps\.app\.goo\.gl|goo\.gl/i.test(address_link)
      let expandedUrl = address_link
      if (isShort) {
        const resolved = await resolveShortLink(address_link)
        if (!resolved) {
          return new Response(JSON.stringify({ success: false, reason: 'could not resolve link' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        expandedUrl = resolved
      }
      console.log(`resolve_only expandedUrl: ${expandedUrl}`)
      const coords = extractCoords(expandedUrl)
      if (!coords) {
        return new Response(JSON.stringify({ success: false, reason: 'no coords in resolved URL', expandedUrl }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ success: true, coords }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Single location mode (called from DB trigger via pg_net)
    if (location_id) {
      const { data: loc } = await supabase
        .from('locations')
        .select('id, address_link')
        .eq('id', location_id)
        .single()

      if (!loc?.address_link) {
        return new Response(JSON.stringify({ message: 'No address link' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const result = await processLocation(supabase, loc.id, loc.address_link)
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Batch mode: process all unresolved locations
    const { data: locations, error: queryError } = await supabase
      .from('locations')
      .select('id, address_link')
      .is('zone_code', null)
      .is('lat', null)
      .not('address_link', 'is', null)
      .like('address_link', '%maps.app.goo.gl%')

    if (queryError) throw queryError

    const results = { total: locations?.length || 0, resolved: 0, failed: 0, errors: [] as string[] }

    if (!locations || locations.length === 0) {
      return new Response(JSON.stringify({ ...results, message: 'No locations to resolve' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    for (const loc of locations) {
      await new Promise(r => setTimeout(r, 200))
      const result = await processLocation(supabase, loc.id, loc.address_link!)
      if (result.success) {
        results.resolved++
      } else {
        results.failed++
        results.errors.push(`${loc.id}: ${result.reason}`)
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
