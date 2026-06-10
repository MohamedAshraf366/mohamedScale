import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AllocationMethod = 'equal' | 'by_moq' | 'by_value' | 'manual';

export interface DeliveryAllocation {
  id: string;
  supplier_quote_id: string;
  supplier_material_id: string;
  delivery_line_id: string;
  zone_code: string;
  unit_price: number;
  moq: number;
  raw_delivery_price_per_moq: number;
  allocation_method: AllocationMethod;
  allocation_share_pct: number;
  allocated_delivery_per_moq: number;
  landed_price_per_unit: number;
  is_changed: boolean;
  prior_allocation_id: string | null;
  created_at: string;
}

export function useDeliveryAllocationsByQuote(quoteId?: string) {
  return useQuery({
    queryKey: ['delivery-allocations', 'quote', quoteId],
    enabled: !!quoteId,
    queryFn: async (): Promise<DeliveryAllocation[]> => {
      const { data, error } = await supabase
        .from('supplier_quote_delivery_allocations')
        .select('*')
        .eq('supplier_quote_id', quoteId!)
        .order('created_at');
      if (error) throw error;
      return (data || []) as unknown as DeliveryAllocation[];
    },
  });
}

export function useDeliveryAllocationsBySupplierMaterial(smId?: string) {
  return useQuery({
    queryKey: ['delivery-allocations', 'sm', smId],
    enabled: !!smId,
    queryFn: async (): Promise<DeliveryAllocation[]> => {
      const { data, error } = await supabase
        .from('supplier_quote_delivery_allocations')
        .select('*')
        .eq('supplier_material_id', smId!)
        .order('created_at');
      if (error) throw error;
      return (data || []) as unknown as DeliveryAllocation[];
    },
  });
}

export function useCreateDeliveryAllocations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Array<{
      supplier_quote_id: string;
      supplier_material_id: string;
      delivery_line_id: string;
      zone_code: string;
      unit_price: number;
      moq: number;
      raw_delivery_price_per_moq: number;
      allocation_method: AllocationMethod;
      allocation_share_pct: number;
      allocated_delivery_per_moq: number;
      landed_price_per_unit: number;
      is_changed?: boolean;
      prior_allocation_id?: string | null;
    }>) => {
      if (rows.length === 0) return [];
      const { data, error } = await supabase
        .from('supplier_quote_delivery_allocations')
        .insert(rows.map(r => ({
          ...r,
          is_changed: r.is_changed ?? true,
          prior_allocation_id: r.prior_allocation_id ?? null,
        })) as any)
        .select();
      if (error) throw error;
      return (data || []) as unknown as DeliveryAllocation[];
    },
    onSuccess: (_, vars) => {
      if (vars.length > 0) {
        qc.invalidateQueries({ queryKey: ['delivery-allocations', 'quote', vars[0].supplier_quote_id] });
      }
      qc.invalidateQueries({ queryKey: ['delivery-allocations'] });
    },
    onError: (e: Error) => toast.error('Failed to create allocations: ' + e.message),
  });
}

/**
 * Build equal-split allocation rows for a set of delivery lines and supplier materials.
 */
export function buildEqualAllocations(params: {
  quoteId: string;
  deliveryLines: Array<{
    id: string;
    material_ids: string[];
    zone_codes: string[];
    price_per_moq: number;
  }>;
  supplierMaterials: Array<{
    id: string;
    material_id: string;
    unit_price: number | null;
    moq: number | null;
  }>;
}): Array<{
  supplier_quote_id: string;
  supplier_material_id: string;
  delivery_line_id: string;
  zone_code: string;
  unit_price: number;
  moq: number;
  raw_delivery_price_per_moq: number;
  allocation_method: AllocationMethod;
  allocation_share_pct: number;
  allocated_delivery_per_moq: number;
  landed_price_per_unit: number;
  is_changed: boolean;
  prior_allocation_id: null;
}> {
  const { quoteId, deliveryLines, supplierMaterials } = params;

  // Map material_id -> supplier_material row
  const matToSm = new Map(supplierMaterials.map(sm => [sm.material_id, sm]));

  const rows: ReturnType<typeof buildEqualAllocations> = [];

  for (const dl of deliveryLines) {
    // Find supplier_materials covered by this delivery line
    const coveredSms = dl.material_ids
      .map(matId => matToSm.get(matId))
      .filter((sm): sm is NonNullable<typeof sm> => !!sm && sm.unit_price != null && sm.moq != null && sm.moq > 0);

    if (coveredSms.length === 0) continue;

    const sharePct = 100 / coveredSms.length;

    for (const sm of coveredSms) {
      const allocatedDelivery = dl.price_per_moq * (sharePct / 100);
      const landedPrice = sm.unit_price! + (allocatedDelivery / sm.moq!);

      for (const zoneCode of dl.zone_codes) {
        rows.push({
          supplier_quote_id: quoteId,
          supplier_material_id: sm.id,
          delivery_line_id: dl.id,
          zone_code: zoneCode,
          unit_price: sm.unit_price!,
          moq: sm.moq!,
          raw_delivery_price_per_moq: dl.price_per_moq,
          allocation_method: 'equal',
          allocation_share_pct: sharePct,
          allocated_delivery_per_moq: allocatedDelivery,
          landed_price_per_unit: landedPrice,
          is_changed: true,
          prior_allocation_id: null,
        });
      }
    }
  }

  return rows;
}
