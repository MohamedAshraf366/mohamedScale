/**
 * DEPRECATED — kept only as a compatibility shim during the migration to
 * `supplier_selections` + `resolve_supplier`. New callers MUST use
 * `@/hooks/useSupplierSelections` instead.
 *
 * Internally this no longer reads `supply_unit_suppliers` or
 * `resolve_effective_supplier`. It calls the new `resolve_supplier` RPC and
 * adapts the result to the legacy shape so a couple of remaining QuotationBuilder
 * call sites keep working until they're fully refactored.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  resolveSupplier,
  type SelectionRole,
} from "@/hooks/useSupplierSelections";

export interface EffectiveSupplierResult {
  source: string;
  supplier_account_id: string;
  supplier_material_id: string | null;
  role: string;
  rank: number;
  unit_price: number | null;
  delivery_price: number | null;
  landed_price: number | null;
}

async function materialCodesForIds(materialIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (materialIds.length === 0) return out;
  const { data } = await supabase
    .from("materials")
    .select("id, code")
    .in("id", materialIds);
  (data || []).forEach((m: any) => {
    if (m.code) out.set(m.id, m.code);
  });
  return out;
}

function toLegacy(r: { supplier_id?: string; role_used?: string }): EffectiveSupplierResult | null {
  if (!r.supplier_id) return null;
  return {
    source: "supplier_selections",
    supplier_account_id: r.supplier_id,
    supplier_material_id: null,
    role: (r.role_used as string) || "selected",
    rank: 1,
    unit_price: null,
    delivery_price: null,
    landed_price: null,
  };
}

/** @deprecated Use `useResolveSupplier` from `useSupplierSelections`. */
export function useEffectiveSupplier(
  materialId: string | undefined,
  zoneCode: string | undefined,
  role: string = "selected",
) {
  return useQuery({
    queryKey: ["effective-supplier-legacy", materialId, zoneCode, role],
    enabled: !!materialId && !!zoneCode,
    queryFn: async (): Promise<EffectiveSupplierResult | null> => {
      const codes = await materialCodesForIds([materialId!]);
      const code = codes.get(materialId!);
      if (!code) return null;
      const r = await resolveSupplier(code, zoneCode!, role as SelectionRole);
      return toLegacy(r);
    },
  });
}

/** @deprecated Use `resolveSupplierBatch` from `useSupplierSelections`. */
export async function resolveEffectiveSuppliersBatch(
  materialIds: string[],
  zoneCode: string,
  role: string = "selected",
): Promise<Map<string, EffectiveSupplierResult>> {
  const codes = await materialCodesForIds(materialIds);
  const results = new Map<string, EffectiveSupplierResult>();
  await Promise.all(
    materialIds.map(async (mid) => {
      const code = codes.get(mid);
      if (!code) return;
      const r = await resolveSupplier(code, zoneCode, role as SelectionRole);
      const legacy = toLegacy(r);
      if (legacy) results.set(mid, legacy);
    }),
  );
  return results;
}
