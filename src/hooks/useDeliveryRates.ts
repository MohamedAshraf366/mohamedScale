import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DeliveryRate {
  id: string;
  supplier_account_id: string;
  supplier_material_ids: string[];
  is_default: boolean;
  zone_ids: string[];
  zone_codes: string[];
  price_per_moq: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  zone_names: { id: string; name: string | null; code: string }[];
  material_names: { id: string; name: string; code: string | null }[];
}

export function useDeliveryRates(supplierAccountId?: string) {
  return useQuery({
    queryKey: ['delivery-rates', supplierAccountId],
    enabled: !!supplierAccountId,
    queryFn: async (): Promise<DeliveryRate[]> => {
      const { data, error } = await supabase
        .from('delivery_rates')
        .select('*')
        .eq('supplier_account_id', supplierAccountId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const allZoneCodes = [...new Set(data.flatMap((r) => (r.zone_codes || []) as string[]))];
      const allSmIds = [...new Set(data.flatMap((r) => (r.supplier_material_ids || []) as string[]))];

      const [zonesRes, smRes] = await Promise.all([
        allZoneCodes.length > 0
          ? supabase.from('zones').select('id, name, code').in('code', allZoneCodes)
          : Promise.resolve({ data: [] as { id: string; name: string | null; code: string }[] }),
        allSmIds.length > 0
          ? supabase.from('supplier_materials').select('id, material_id').in('id', allSmIds)
          : Promise.resolve({ data: [] as { id: string; material_id: string }[] }),
      ]);

      const zoneMap = new Map((zonesRes.data || []).map((z) => [z.code, z] as const));

      const materialIds = [...new Set(smRes.data?.map((sm) => sm.material_id) || [])];
      const materialsRes = materialIds.length > 0
        ? await supabase.from('materials').select('id, name, code').in('id', materialIds)
        : { data: [] as { id: string; name: string; code: string | null }[] };

      const materialMap = new Map((materialsRes.data || []).map((m) => [m.id, m] as const));
      const smMaterialMap = new Map((smRes.data || []).map((sm) => [sm.id, sm.material_id] as const));

      return data.map((rate) => {
        const smIds: string[] = rate.supplier_material_ids || [];
        const zCodes: string[] = rate.zone_codes || [];

        const zone_names = zCodes
          .map((zCode) => zoneMap.get(zCode))
          .filter(Boolean)
          .map((z) => ({ id: z!.id, name: z!.name, code: z!.code }));

        const material_names = smIds
          .map((smId) => {
            const matId = smMaterialMap.get(smId);
            const mat = matId ? materialMap.get(matId) : null;
            return mat ? { id: smId, name: mat.name, code: mat.code } : null;
          })
          .filter(Boolean) as { id: string; name: string; code: string | null }[];

        return {
          id: rate.id,
          supplier_account_id: rate.supplier_account_id,
          supplier_material_ids: smIds,
          is_default: rate.is_default ?? false,
          zone_ids: zCodes,
          zone_codes: zCodes,
          price_per_moq: Number(rate.price_per_moq),
          notes: rate.notes,
          created_at: rate.created_at,
          updated_at: rate.updated_at,
          zone_names,
          material_names,
        };
      });
    },
  });
}

export function useCreateDeliveryRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      supplier_account_id: string;
      supplier_material_ids: string[];
      zone_ids: string[];
      zone_codes?: string[];
      price_per_moq: number;
      notes?: string;
      is_default?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('delivery_rates')
        .insert({
          supplier_account_id: input.supplier_account_id,
          supplier_material_ids: input.supplier_material_ids,
          zone_codes: input.zone_codes || input.zone_ids,
          price_per_moq: input.price_per_moq,
          notes: input.notes || null,
          is_default: input.is_default ?? false,
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-rates', vars.supplier_account_id] });
      toast.success('Delivery rate saved');
    },
    onError: (error: Error) => {
      toast.error('Failed to save delivery rate: ' + error.message);
    },
  });
}

export function useDeleteDeliveryRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, supplierAccountId }: { id: string; supplierAccountId: string }) => {
      const { error } = await supabase.from('delivery_rates').delete().eq('id', id);
      if (error) throw error;
      return supplierAccountId;
    },
    onSuccess: (supplierAccountId) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-rates', supplierAccountId] });
      toast.success('Delivery rate deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete: ' + error.message);
    },
  });
}
