/**
 * DEPRECATED — the `supply_unit_suppliers` table is being retired.
 * Selection authority now lives in `supplier_selections` (see
 * `@/hooks/useSupplierSelections`). These hooks are kept as no-op shims so
 * legacy UI surfaces compile and render empty until they're removed or
 * rebuilt on the new model.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type SupplyUnitSupplierRole = "candidate" | "selected" | "backup";

export interface SupplyUnitSupplier {
  id: string;
  supply_unit_id: string;
  supplier_account_id: string;
  supplier_material_id: string | null;
  delivery_allocation_id: string | null;
  role: SupplyUnitSupplierRole;
  rank: number | null;
  landed_price: number | null;
  is_quality_pick: boolean;
  is_frozen: boolean;
  frozen_reason: string | null;
  frozen_by: string | null;
  frozen_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

const EMPTY: SupplyUnitSupplier[] = [];

export function useSupplyUnitSuppliersByUnit(_supplyUnitId?: string) {
  return useQuery({
    queryKey: ["supply-unit-suppliers", "unit", _supplyUnitId, "deprecated"],
    queryFn: async (): Promise<SupplyUnitSupplier[]> => EMPTY,
  });
}

export function useSupplyUnitSuppliersBySupplier(_supplierAccountId?: string) {
  return useQuery({
    queryKey: ["supply-unit-suppliers", "supplier", _supplierAccountId, "deprecated"],
    queryFn: async (): Promise<SupplyUnitSupplier[]> => EMPTY,
  });
}

export function useCreateSupplyUnitSuppliers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_rows: any[]) => EMPTY,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supply-unit-suppliers"] }),
  });
}

export function useUpdateSupplyUnitSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_input: any) => undefined,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supply-unit-suppliers"] }),
  });
}

export async function upsertSupplyUnitSupplier(_input: any): Promise<SupplyUnitSupplier> {
  throw new Error(
    "supply_unit_suppliers is deprecated — write through set_supplier_selection (see useSupplierSelections).",
  );
}
