import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches subcategory margin defaults and returns a Map<subcategory_id, margin_pct>.
 * Used ONLY in the builder for hierarchy resolution on new/editing items.
 * NOT used by PDF rendering or order conversion (they use persisted effective_margin_pct).
 */
export function useSubcategoryMargins() {
  return useQuery({
    queryKey: ["subcategory-margin-defaults"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subcategory_margin_defaults")
        .select("subcategory_id, default_margin_pct");

      if (error) throw error;

      const map = new Map<string, number>();
      for (const row of data || []) {
        if (row.default_margin_pct != null && row.default_margin_pct > 0) {
          map.set(row.subcategory_id, Number(row.default_margin_pct));
        }
      }
      return map;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

/**
 * Builds a Map<material_id, subcategory_id> from material data.
 * Used alongside useSubcategoryMargins for hierarchy resolution.
 */
export function buildMaterialSubcategoryMap(
  materials: Array<{ id: string; subcategory_id?: string | null }>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of materials) {
    if (m.subcategory_id) {
      map.set(m.id, m.subcategory_id);
    }
  }
  return map;
}
