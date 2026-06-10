import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { QuotationItem } from "@/components/sales/QuotationBuilder";

export interface StalenessFlag {
  material_id: string;
  material_name: string;
  reason: "price_changed" | "quote_expired" | "quote_not_approved";
  saved_price: number;
  current_price: number | null;
}

/**
 * Check if an open quotation's items are stale against current supply truth.
 * SSOT §9.6 — quote staleness detection.
 */
export function useQuoteStaleness(
  items: QuotationItem[],
  enabled: boolean = true
) {
  const supplierMaterialIds = items
    .map((i) => i.supplier_material_id)
    .filter(Boolean) as string[];

  return useQuery({
    queryKey: ["quote-staleness", ...supplierMaterialIds.sort()],
    enabled: enabled && supplierMaterialIds.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<StalenessFlag[]> => {
      if (supplierMaterialIds.length === 0) return [];

      const { data: currentPrices, error } = await supabase
        .from("supplier_materials")
        .select("id, material_id, unit_price, status, is_current, supplier_quote_id")
        .in("id", supplierMaterialIds);
      if (error) throw error;

      const quoteIds = [...new Set(
        (currentPrices || [])
          .map((p) => p.supplier_quote_id)
          .filter(Boolean)
      )] as string[];

      let quoteStatusMap = new Map<string, { status: string; valid_until: string | null }>();
      if (quoteIds.length > 0) {
        const { data: quotes } = await supabase
          .from("supplier_quotes")
          .select("id, status, valid_until")
          .in("id", quoteIds);
        (quotes || []).forEach((q) => {
          quoteStatusMap.set(q.id, { status: q.status, valid_until: q.valid_until });
        });
      }

      const flags: StalenessFlag[] = [];
      const priceMap = new Map(
        (currentPrices || []).map((p) => [p.id, p])
      );

      for (const item of items) {
        if (!item.supplier_material_id || !item.unit_price) continue;
        const current = priceMap.get(item.supplier_material_id);
        if (!current) continue;

        if (current.unit_price != null && current.unit_price !== item.unit_price) {
          flags.push({
            material_id: item.material_id,
            material_name: item.name,
            reason: "price_changed",
            saved_price: item.unit_price,
            current_price: current.unit_price,
          });
          continue;
        }

        if (current.supplier_quote_id) {
          const quote = quoteStatusMap.get(current.supplier_quote_id);
          if (quote) {
            if (quote.status !== "approved") {
              flags.push({
                material_id: item.material_id,
                material_name: item.name,
                reason: "quote_not_approved",
                saved_price: item.unit_price,
                current_price: current.unit_price,
              });
              continue;
            }
            if (quote.valid_until && new Date(quote.valid_until) < new Date()) {
              flags.push({
                material_id: item.material_id,
                material_name: item.name,
                reason: "quote_expired",
                saved_price: item.unit_price,
                current_price: current.unit_price,
              });
            }
          }
        }
      }

      return flags;
    },
  });
}
