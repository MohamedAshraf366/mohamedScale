/**
 * ## Cascading Inheritance System
 *
 * Many fields in this application follow a **cascading default** pattern,
 * where the resolved value is the first non-null/non-undefined value found
 * walking up an entity hierarchy.
 *
 * ### Material Hierarchy
 *
 *   Material → Subcategory → Category
 *
 * Inheritable fields:
 *   - `default_uom`          (string)
 *   - `default_moq`          (number)
 *   - `default_lead_time_days`       (number)
 *   - `default_delivery_time_days`   (number)
 *   - `default_order_window_days`    (number)
 *   - `default_order_cutoff_local`   (string — time)
 *
 * When a material's own field is null, we look at its subcategory,
 * then the category, then an optional hard-coded fallback.
 *
 * ### Delivery Rate Hierarchy
 *
 *   Override (material-specific rate) → Default (supplier-wide rate)
 *
 * When looking up the delivery price for a specific material + zone:
 *   1. Check for an override rate matching that material and zone
 *   2. Fall back to the supplier's default rate for that zone
 *
 * ### Usage
 *
 * ```ts
 * import { resolveInherited } from '@/lib/resolve-inherited';
 *
 * const moq = resolveInherited('default_moq', material, subcategory, category, 1);
 * const uom = resolveInherited('default_uom', material, subcategory, category, 'unit');
 * ```
 *
 * ### Rules
 *
 * - **Never write inline fallback chains** (`a.moq ?? b.moq ?? c.moq`).
 *   Always use `resolveInherited`.
 * - When adding new inheritable fields, add them to the `InheritableField` type below.
 * - The function accepts any objects; it reads `field` from each via bracket access.
 *   This keeps it generic for future expansion.
 */

/** Fields that cascade through the material hierarchy */
export type InheritableField =
  | 'default_uom'
  | 'default_moq'
  | 'default_lead_time_days'
  | 'default_delivery_time_days'
  | 'default_order_window_days'
  | 'default_order_cutoff_local';

/**
 * Resolve a field value by walking through a cascade of sources.
 *
 * Returns the first non-null, non-undefined value found, or `fallback`.
 *
 * @param field    - The property name to look up on each source.
 * @param sources  - Ordered from most specific to most general.
 *                   Null/undefined entries are safely skipped.
 * @param fallback - Returned if no source provides a value.
 */
export function resolveInherited<T = unknown>(
  field: string,
  sources: Array<Record<string, unknown> | null | undefined>,
  fallback?: T,
): T {
  for (const source of sources) {
    if (!source) continue;
    const val = source[field];
    if (val !== null && val !== undefined) return val as T;
  }
  return fallback as T;
}

/**
 * Resolve the effective Unit of Measurement (UoM) for a material.
 *
 * Cascade: material override → subcategory default → category default → 'unit'.
 * Empty strings are treated as "no value" and skipped.
 *
 * Also returns which level the value came from, so the UI can show a subtle
 * "from subcategory" / "from category" caption alongside the resolved value.
 */
export type UomSource = 'material' | 'subcategory' | 'category' | 'fallback';

export function resolveUom(
  material?: { uom?: string | null } | null,
  subcategory?: { default_uom?: string | null } | null,
  category?: { default_uom?: string | null } | null,
): { uom: string; source: UomSource } {
  const trim = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const s = v.trim();
    return s.length > 0 ? s : null;
  };

  const m = trim(material?.uom);
  if (m) return { uom: m, source: 'material' };

  const s = trim(subcategory?.default_uom);
  if (s) return { uom: s, source: 'subcategory' };

  const c = trim(category?.default_uom);
  if (c) return { uom: c, source: 'category' };

  return { uom: 'unit', source: 'fallback' };
}

/** Convenience: just the resolved UoM string. */
export function resolveUomValue(
  material?: { uom?: string | null } | null,
  subcategory?: { default_uom?: string | null } | null,
  category?: { default_uom?: string | null } | null,
): string {
  return resolveUom(material, subcategory, category).uom;
}

/** Human-readable caption for where a UoM came from. */
export function uomSourceLabel(source: UomSource): string {
  switch (source) {
    case 'material': return 'set on material';
    case 'subcategory': return 'from subcategory';
    case 'category': return 'from category';
    case 'fallback': return 'default';
  }
}

/**
 * Resolve all inheritable material fields at once.
 *
 * Returns a flat object with resolved values for every InheritableField.
 */
export function resolveAllMaterialDefaults(
  material: Record<string, unknown> | null | undefined,
  subcategory: Record<string, unknown> | null | undefined,
  category: Record<string, unknown> | null | undefined,
) {
  const sources = [material, subcategory, category];
  return {
    uom: resolveInherited<string>('default_uom', sources, 'unit'),
    moq: resolveInherited<number>('default_moq', sources, 1),
    lead_time_days: resolveInherited<number | null>('default_lead_time_days', sources, null),
    delivery_time_days: resolveInherited<number | null>('default_delivery_time_days', sources, null),
    order_window_days: resolveInherited<number | null>('default_order_window_days', sources, null),
    order_cutoff_local: resolveInherited<string | null>('default_order_cutoff_local', sources, null),
  };
}

/**
 * Resolve delivery rate for a material + zone combination.
 *
 * @param rates          - All delivery rates for the supplier
 * @param materialId     - The specific material to look up
 * @param zoneCode       - The zone to match
 * @returns The matching rate row (override first, then default), or null.
 */
export function resolveDeliveryRate<T extends {
  is_default: boolean;
  supplier_material_ids?: string[];
  zone_codes: string[];
}>(
  rates: T[],
  materialId: string | null,
  zoneCode: string,
): T | null {
  // 1. Try override: rate that includes this specific material AND zone
  if (materialId) {
    const override = rates.find(
      r => !r.is_default
        && (r.supplier_material_ids || []).includes(materialId)
        && r.zone_codes.includes(zoneCode),
    );
    if (override) return override;
  }

  // 2. Fall back to default rate for this zone
  const defaultRate = rates.find(
    r => r.is_default && r.zone_codes.includes(zoneCode),
  );
  return defaultRate || null;
}
