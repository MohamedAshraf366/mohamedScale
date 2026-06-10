import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveUomValue } from "@/lib/resolve-inherited";

export interface AddonDefinition {
  id: string;
  name: string;
  name_ar: string | null;
  default_uom: string;
  default_price: number | null;
  default_margin_pct: number | null;
  scope: "global" | "subcategory" | "material";
  subcategory_id: string | null;
  material_id: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all active add-on definitions. The table is expected to stay small,
 * so callers filter client-side by scope (global / subcategory / material).
 */
export function useAddonDefinitions() {
  return useQuery({
    queryKey: ["addon_definitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addon_definitions")
        .select("*")
        .eq("status", "active")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AddonDefinition[];
    },
    staleTime: 60_000,
  });
}

/**
 * Resolve the subcategory_id for a given material id (used to filter
 * subcategory-scoped add-on defs against a parent line).
 */
export function useMaterialSubcategoryMap(materialIds: string[]) {
  const sorted = [...new Set(materialIds.filter(Boolean))].sort();
  return useQuery({
    queryKey: ["material-subcategory-map", sorted],
    enabled: sorted.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, subcategory_id")
        .in("id", sorted);
      if (error) throw error;
      const map = new Map<string, string | null>();
      for (const r of data ?? []) map.set(r.id as string, (r as any).subcategory_id ?? null);
      return map;
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Resolve the effective UoM that should be displayed for an add-on row.
 *
 * Rules:
 *   - global scope        → use the add-on definition's own `default_uom`
 *   - subcategory scope   → use the parent subcategory's resolved UoM
 *                           (cascades through category if subcategory has none)
 *   - material scope      → use the parent material's resolved UoM
 *                           (cascades material → subcategory → category)
 *
 * For custom (non-registry) add-ons attached to a parent line, falls back to
 * the parent material's resolved UoM. For quotation-level custom add-ons,
 * returns 'unit'.
 */
export function resolveAddonUom(
  def: Pick<AddonDefinition, "scope" | "default_uom"> | null | undefined,
  parentMaterial?: { uom?: string | null } | null,
  parentSubcategory?: { default_uom?: string | null } | null,
  parentCategory?: { default_uom?: string | null } | null,
): string {
  if (!def) {
    return resolveUomValue(parentMaterial, parentSubcategory, parentCategory);
  }
  if (def.scope === "global") return def.default_uom || "unit";
  if (def.scope === "subcategory") {
    return resolveUomValue(null, parentSubcategory, parentCategory);
  }
  // material scope
  return resolveUomValue(parentMaterial, parentSubcategory, parentCategory);
}
