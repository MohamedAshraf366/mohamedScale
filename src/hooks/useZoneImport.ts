import { useState } from 'react';
import type { Region } from './useRegions';
import type { Json } from '@/integrations/supabase/types';

interface ImportFeature {
  region_id: string;
  zone_id: string;
  name_en: string;
  name_ar: string;
}

interface ImportResult {
  valid: boolean;
  zones: { 
    region_code: string; 
    code: string; 
    name: string; 
    name_ar: string | null;
    boundary_geojson: Json 
  }[];
  regions: Set<string>;
  summary: string;
  errors: string[];
}

export function useZoneImport() {
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const parseGeoJson = (fileContent: string): ImportResult => {
    const errors: string[] = [];

    let fc: GeoJSON.FeatureCollection;
    try {
      fc = JSON.parse(fileContent);
    } catch {
      return { valid: false, zones: [], regions: new Set(), summary: '', errors: ['Invalid JSON file'] };
    }

    if (fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
      return { valid: false, zones: [], regions: new Set(), summary: '', errors: ['File must be a GeoJSON FeatureCollection'] };
    }

    // Track unique regions
    const regionCodes = new Set<string>();
    const zones: ImportResult['zones'] = [];

    for (let i = 0; i < fc.features.length; i++) {
      const f = fc.features[i];
      const props = f.properties as unknown as ImportFeature | null;

      if (!props?.region_id || !props?.zone_id) {
        errors.push(`Feature ${i}: missing required properties (region_id, zone_id)`);
        continue;
      }

      if (f.geometry?.type !== 'Polygon' && f.geometry?.type !== 'MultiPolygon') {
        errors.push(`Feature ${i} (${props.zone_id}): geometry must be Polygon or MultiPolygon`);
        continue;
      }

      regionCodes.add(props.region_id);
      zones.push({
        region_code: props.region_id,
        code: props.zone_id,
        name: props.name_en || props.zone_id,
        name_ar: props.name_ar || props.name_en || props.zone_id,
        boundary_geojson: f.geometry as unknown as Json,
      });
    }

    const summary = `Found ${zones.length} zones across ${regionCodes.size} regions`;
    return { valid: errors.length === 0 && zones.length > 0, zones, regions: regionCodes, summary, errors };
  };

  const processContent = (content: string) => {
    const result = parseGeoJson(content);
    setImportResult(result);
    return result;
  };

  const handleFile = async (file: File): Promise<ImportResult> => {
    const content = await file.text();
    return processContent(content);
  };

  const clearResult = () => setImportResult(null);

  return { importResult, handleFile, processContent, clearResult };
}
