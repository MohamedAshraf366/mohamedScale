import * as turf from '@turf/turf';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

interface ZoneRecord {
  id: string;
  name: string | null;
  code: string | null; // full code like "RYD.01001"
  region_code: string | null;
  boundary_geojson: Json | null;
}

let cachedZones: ZoneRecord[] | null = null;

async function fetchZones(): Promise<ZoneRecord[]> {
  if (cachedZones) return cachedZones;

  const { data, error } = await supabase
    .from('zones')
    .select('id, name, code, region_code, boundary_geojson');

  if (error) {
    console.error('Failed to fetch zones for geo detection:', error);
    return [];
  }

  cachedZones = data || [];
  return cachedZones;
}

/** Invalidate the zone cache (call after zone import) */
export function invalidateZoneCache() {
  cachedZones = null;
}

export interface ZoneDetectionResult {
  zone_code: string;
  zone_name: string | null;
  region_code: string | null;
}

/**
 * Detect which zone a point belongs to using point-in-polygon.
 * Returns the matching zone or null if outside all zones.
 */
export async function detectZoneForPoint(
  lat: number,
  lng: number
): Promise<ZoneDetectionResult | null> {
  const zones = await fetchZones();
  const point = turf.point([lng, lat]); // GeoJSON uses [lng, lat]

  for (const zone of zones) {
    if (!zone.boundary_geojson) continue;

    try {
      const geojson = zone.boundary_geojson as unknown as GeoJSON.GeoJsonObject;
      if (!geojson || typeof geojson !== 'object') continue;

      // Handle both Feature and raw geometry
      let geometry: GeoJSON.Geometry;
      if ((geojson as GeoJSON.Feature).type === 'Feature') {
        geometry = (geojson as GeoJSON.Feature).geometry;
      } else if (
        (geojson as GeoJSON.Geometry).type === 'Polygon' ||
        (geojson as GeoJSON.Geometry).type === 'MultiPolygon'
      ) {
        geometry = geojson as GeoJSON.Geometry;
      } else {
        continue;
      }

      if (turf.booleanPointInPolygon(point, geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon)) {
        return {
          zone_code: zone.code || zone.id,
          zone_name: zone.name,
          region_code: zone.region_code,
        };
      }
    } catch {
      // Skip malformed geometry
      continue;
    }
  }

  return null;
}
