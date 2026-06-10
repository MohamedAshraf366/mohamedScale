import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Unified line-pricing resolver.
 *
 * Single source of truth for: supplier selection + unit price + per-unit delivery + margin + landed price.
 * Mirrors public.resolve_line_pricing on the DB side.
 *
 * Hard rule (enforced server-side): if `zoneCode` is null/empty, the resolver returns
 * `{ zone_resolved: false, reason: 'zone_missing', ...all NULL }`. Callers MUST treat this
 * as "not priceable" and block downstream actions (totals, send, PDF, order conversion).
 */

export interface LinePricingResult {
  supplier_account_id: string | null;
  supplier_material_id: string | null;
  unit_price: number | null;
  delivery_per_unit: number | null;
  margin_pct: number | null;
  landed_unit_price: number | null;
  zone_resolved: boolean;
  reason: "ok" | "zone_missing" | "no_supplier_for_zone" | string;
}

export interface ResolveLinePricingArgs {
  materialId: string;
  zoneCode: string | null | undefined;
  qty?: number;
  supplierAccountId?: string | null;
  itemOverrideMargin?: number | null;
  globalMargin?: number;
  /** Supplier selection mode: 'selected' (default) or 'quality'. Both go through resolve_supplier. */
  requestedRole?: "selected" | "quality";
}

export async function resolveLinePricing({
  materialId,
  zoneCode,
  qty = 1,
  supplierAccountId = null,
  itemOverrideMargin = null,
  globalMargin = 0,
  requestedRole = "selected",
}: ResolveLinePricingArgs): Promise<LinePricingResult & { role_used?: string | null; was_fallback?: boolean }> {
  if (!zoneCode) {
    return {
      supplier_account_id: null,
      supplier_material_id: null,
      unit_price: null,
      delivery_per_unit: null,
      margin_pct: null,
      landed_unit_price: null,
      zone_resolved: false,
      reason: "zone_missing",
    };
  }

  const { data, error } = await supabase.rpc("resolve_line_pricing", {
    _material_id: materialId,
    _zone_code: zoneCode,
    _qty: qty,
    _supplier_account_id: supplierAccountId,
    _item_override_margin: itemOverrideMargin,
    _global_margin: globalMargin,
    _requested_role: requestedRole,
  } as any);

  if (error) throw error;
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return {
      supplier_account_id: null,
      supplier_material_id: null,
      unit_price: null,
      delivery_per_unit: null,
      margin_pct: null,
      landed_unit_price: null,
      zone_resolved: !!zoneCode,
      reason: "no_supplier_for_zone",
    };
  }

  const row: any = Array.isArray(data) ? data[0] : data;
  return {
    supplier_account_id: row.supplier_account_id ?? null,
    supplier_material_id: row.supplier_material_id ?? null,
    unit_price: row.unit_price ?? null,
    delivery_per_unit: row.delivery_per_unit ?? null,
    margin_pct: row.margin_pct ?? null,
    landed_unit_price: row.landed_unit_price ?? null,
    zone_resolved: row.zone_resolved ?? false,
    reason: row.reason ?? "ok",
    role_used: row.role_used ?? null,
    was_fallback: row.was_fallback ?? false,
  };
}

export function useLinePricing(args: ResolveLinePricingArgs | null | undefined) {
  return useQuery({
    queryKey: [
      "line-pricing",
      args?.materialId,
      args?.zoneCode,
      args?.qty,
      args?.supplierAccountId,
      args?.itemOverrideMargin,
      args?.globalMargin,
    ],
    enabled: !!args?.materialId,
    queryFn: () => resolveLinePricing(args!),
  });
}

/**
 * Batch resolver — useful for the quote builder when re-pricing N lines on draft load.
 * Returns a Map keyed by materialId for caller convenience.
 */
export async function resolveLinePricingBatch(
  zoneCode: string | null | undefined,
  rows: Array<{
    materialId: string;
    qty?: number;
    supplierAccountId?: string | null;
    itemOverrideMargin?: number | null;
  }>,
  globalMargin = 0,
  requestedRole: "selected" | "quality" = "selected",
): Promise<Map<string, Awaited<ReturnType<typeof resolveLinePricing>>>> {
  const out = new Map<string, Awaited<ReturnType<typeof resolveLinePricing>>>();
  await Promise.all(
    rows.map(async (r) => {
      const res = await resolveLinePricing({
        materialId: r.materialId,
        zoneCode,
        qty: r.qty,
        supplierAccountId: r.supplierAccountId,
        itemOverrideMargin: r.itemOverrideMargin,
        globalMargin,
        requestedRole,
      });
      out.set(r.materialId, res);
    })
  );
  return out;
}
