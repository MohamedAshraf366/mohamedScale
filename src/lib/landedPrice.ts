/**
 * Landed price model for the Supply Domain matrix.
 *
 * landed_per_unit_for_zone = raw_unit_price + (delivery_rate_per_moq / MOQ)
 *
 * An area has multiple zones. A supplier may have different delivery rates
 * per zone, and may not cover every zone. We average across the zones the
 * supplier covers; coverage % is reported separately.
 */

export interface DeliveryRateRow {
  id: string;
  supplier_account_id: string;
  supplier_material_ids: string[]; // empty = applies to all materials of the supplier
  is_default: boolean;
  zone_codes: string[];
  price_per_moq: number;
}

export interface PerZoneDelivery {
  zone_code: string;
  rate_per_moq: number;
  delivery_per_unit: number;
  source: 'override' | 'default';
}

export interface LandedBundle {
  raw_unit_price: number;
  moq: number | null;
  zones_in_area: string[];
  covered_zones: string[];
  uncovered_zones: string[];
  per_zone: PerZoneDelivery[];
  delivery_per_unit_avg: number;   // 0 if no coverage
  delivery_per_unit_min: number;   // 0 if no coverage
  delivery_per_unit_max: number;   // 0 if no coverage
  landed_avg: number;              // = raw + delivery_per_unit_avg (covered avg)
  landed_min: number;
  landed_max: number;
  zone_coverage_pct: number;       // 0..100
  has_any_delivery: boolean;
}

/**
 * Resolve the best delivery rate for (supplier, supplierMaterialId, zone).
 * Override (rate listing this supplier_material) wins over default rates.
 * Among matches, the lowest rate wins.
 */
export function resolveZoneRate(
  rates: DeliveryRateRow[],
  supplierMaterialId: string | null,
  zone: string,
): { rate_per_moq: number; source: 'override' | 'default' } | null {
  let override: number | null = null;
  let def: number | null = null;
  for (const r of rates) {
    if (!r.zone_codes?.includes(zone)) continue;
    const isOverride = supplierMaterialId
      ? (r.supplier_material_ids?.includes(supplierMaterialId) ?? false)
      : false;
    const isDefault = r.is_default || (r.supplier_material_ids?.length ?? 0) === 0;
    if (isOverride) {
      override = override == null ? r.price_per_moq : Math.min(override, r.price_per_moq);
    } else if (isDefault) {
      def = def == null ? r.price_per_moq : Math.min(def, r.price_per_moq);
    }
  }
  if (override != null) return { rate_per_moq: override, source: 'override' };
  if (def != null) return { rate_per_moq: def, source: 'default' };
  return null;
}

export function computeLandedBundle(args: {
  rawUnit: number;
  moq: number | null;
  zonesInArea: string[];
  supplierMaterialId: string | null;
  supplierRates: DeliveryRateRow[]; // pre-filtered to one supplier
}): LandedBundle {
  const { rawUnit, moq, zonesInArea, supplierMaterialId, supplierRates } = args;
  const perZone: PerZoneDelivery[] = [];
  const uncovered: string[] = [];
  const effectiveMoq = moq && moq > 0 ? moq : 1;

  for (const z of zonesInArea) {
    const hit = resolveZoneRate(supplierRates, supplierMaterialId, z);
    if (!hit) {
      uncovered.push(z);
      continue;
    }
    perZone.push({
      zone_code: z,
      rate_per_moq: hit.rate_per_moq,
      delivery_per_unit: hit.rate_per_moq / effectiveMoq,
      source: hit.source,
    });
  }

  const deliveries = perZone.map(p => p.delivery_per_unit);
  const avg = deliveries.length ? deliveries.reduce((a, b) => a + b, 0) / deliveries.length : 0;
  const min = deliveries.length ? Math.min(...deliveries) : 0;
  const max = deliveries.length ? Math.max(...deliveries) : 0;
  const coveragePct = zonesInArea.length
    ? Math.round((perZone.length / zonesInArea.length) * 100)
    : 0;

  return {
    raw_unit_price: rawUnit,
    moq,
    zones_in_area: zonesInArea,
    covered_zones: perZone.map(p => p.zone_code),
    uncovered_zones: uncovered,
    per_zone: perZone,
    delivery_per_unit_avg: avg,
    delivery_per_unit_min: min,
    delivery_per_unit_max: max,
    landed_avg: rawUnit + avg,
    landed_min: rawUnit + min,
    landed_max: rawUnit + max,
    zone_coverage_pct: coveragePct,
    has_any_delivery: perZone.length > 0,
  };
}

/**
 * Overall supplier-level zone coverage in an area, based on default rates only
 * (i.e. zones the supplier can ship anything to).
 */
export function supplierZoneCoverage(
  supplierRates: DeliveryRateRow[],
  zonesInArea: string[],
): { covered: string[]; pct: number } {
  const covered = new Set<string>();
  for (const r of supplierRates) {
    const isDefault = r.is_default || (r.supplier_material_ids?.length ?? 0) === 0;
    if (!isDefault) continue;
    for (const z of r.zone_codes || []) {
      if (zonesInArea.includes(z)) covered.add(z);
    }
  }
  const list = [...covered];
  return {
    covered: list,
    pct: zonesInArea.length ? Math.round((list.length / zonesInArea.length) * 100) : 0,
  };
}
