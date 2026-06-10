import { supabase } from '@/integrations/supabase/client';
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

interface ZoneDeliveryAvailability {
  supplierMaterialIds: string[];
  supplierAccountIds: string[];
}

export function useZoneDeliveryAvailability(zoneCode: string | null | undefined) {

  const query = useQuery<ZoneDeliveryAvailability>({
    queryKey: ["zone-delivery-availability", zoneCode],
    enabled: !!zoneCode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_rates")
        .select("supplier_account_id, supplier_material_ids")
        .contains("zone_codes", [zoneCode!]);

      if (error) throw error;

      const supplierMaterialIds = new Set<string>();
      const supplierAccountIds = new Set<string>();

      for (const row of data || []) {
        supplierAccountIds.add(row.supplier_account_id);
        for (const supplierMaterialId of row.supplier_material_ids || []) {
          supplierMaterialIds.add(supplierMaterialId);
        }
      }

      return {
        supplierMaterialIds: Array.from(supplierMaterialIds),
        supplierAccountIds: Array.from(supplierAccountIds),
      };
    },
    staleTime: 60_000,
  });

  const supplierMaterialIdSet = useMemo(
    () => new Set(query.data?.supplierMaterialIds || []),
    [query.data?.supplierMaterialIds]
  );

  const supplierAccountIdSet = useMemo(
    () => new Set(query.data?.supplierAccountIds || []),
    [query.data?.supplierAccountIds]
  );

  return {
    ...query,
    supplierMaterialIdSet,
    supplierAccountIdSet,
  };
}
