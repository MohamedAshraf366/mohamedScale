import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface QuotationTotals {
  subtotal: number;
  delivery_total: number;
  pre_tax_total: number;
  vat_amount: number;
  grand_total: number;
}

export function useQuotationTotals(quotationId: string | null) {
  return useQuery({
    queryKey: ["quotation-totals", quotationId],
    queryFn: async (): Promise<QuotationTotals | null> => {
      if (!quotationId) return null;
      const { data, error } = await supabase.rpc("get_quotation_totals", {
        p_quotation_id: quotationId,
      });
      if (error) {
        console.error("Failed to fetch quotation totals:", error);
        return null;
      }
      return data;
    },
    enabled: !!quotationId,
    staleTime: 1000 * 60 * 5,
  });
}