import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SupplierPrice {
  id: string;
  supplier_account_id: string;
  supplier_name: string;
  material_id: string;
  unit_price: number | null;
  delivery_price: number | null;
  moq: number | null;
  lead_time_days: number | null;
  status: string;
}

export function useSupplierPrices(materialIds: string[]) {
  return useQuery({
    queryKey: ['supplier-prices', materialIds],
    queryFn: async (): Promise<Record<string, SupplierPrice[]>> => {
      if (!materialIds.length) return {};

      // Mirror the resolver: pick the current supplier_materials row regardless of
      // legacy `status`. The selection model (resolve_supplier) is authoritative for
      // which supplier is chosen; here we just need the price row the resolver will use.
      const { data, error } = await supabase
        .from('supplier_materials')
        .select('id, supplier_account_id, material_id, unit_price, delivery_price, moq, lead_time_days, status')
        .in('material_id', materialIds)
        .eq('is_current', true);

      if (error) throw error;
      if (!data || data.length === 0) return {};

      const supplierIds = [...new Set(data.map((d) => d.supplier_account_id))];

      // Drop suppliers the resolver itself refuses to pick — frozen or blacklisted
      // — so the dropdown never offers a supplier that auto-fill would skip.
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('account_id, is_blacklisted, is_frozen')
        .in('account_id', supplierIds);
      const allowedSupplierIds = new Set(
        (suppliers || [])
          .filter((s: any) => !s.is_blacklisted && !s.is_frozen)
          .map((s: any) => s.account_id),
      );

      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, display_name').is('deleted_at', null)
        .in('id', supplierIds);

      const accountMap = new Map(accounts?.map((a) => [a.id, a.display_name]) || []);

      const result: Record<string, SupplierPrice[]> = {};

      for (const sm of data) {
        if (!allowedSupplierIds.has(sm.supplier_account_id)) continue;
        const price: SupplierPrice = {
          id: sm.id,
          supplier_account_id: sm.supplier_account_id,
          supplier_name: accountMap.get(sm.supplier_account_id) || 'Unknown',
          material_id: sm.material_id,
          unit_price: sm.unit_price,
          delivery_price: sm.delivery_price,
          moq: sm.moq,
          lead_time_days: sm.lead_time_days,
          status: sm.status,
        };

        if (!result[sm.material_id]) {
          result[sm.material_id] = [];
        }
        result[sm.material_id].push(price);
      }

      for (const materialId of Object.keys(result)) {
        result[materialId].sort((a, b) => (a.unit_price || 0) - (b.unit_price || 0));
      }

      return result;
    },
    enabled: materialIds.length > 0,
  });
}
