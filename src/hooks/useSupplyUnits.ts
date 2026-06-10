import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type SupplyUnitStatus = 'planned' | 'sourcing' | 'active' | 'frozen' | 'inactive';

export interface SupplyUnit {
  id: string;
  cycle_id: string;
  material_id: string;
  zone_code: string;
  area_id: string | null;
  domain_id: string | null;
  status: SupplyUnitStatus;
  target_price: number | null;
  activated_at: string | null;
  frozen_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export function useSupplyUnitsByCycle(cycleId?: string) {
  return useQuery({
    queryKey: ['supply-units', 'cycle', cycleId],
    enabled: !!cycleId,
    queryFn: async (): Promise<SupplyUnit[]> => {
      const { data, error } = await supabase
        .from('supply_units')
        .select('*')
        .eq('cycle_id', cycleId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as SupplyUnit[];
    },
  });
}

export function useSupplyUnitsByMaterialZone(materialId?: string, zoneCode?: string) {
  return useQuery({
    queryKey: ['supply-units', 'mat-zone', materialId, zoneCode],
    enabled: !!materialId && !!zoneCode,
    queryFn: async (): Promise<SupplyUnit[]> => {
      const { data, error } = await supabase
        .from('supply_units')
        .select('*')
        .eq('material_id', materialId!)
        .eq('zone_code', zoneCode!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as SupplyUnit[];
    },
  });
}

export function useCreateSupplyUnit() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      cycle_id: string;
      material_id: string;
      zone_code: string;
      area_id?: string | null;
      domain_id?: string | null;
      status?: SupplyUnitStatus;
      target_price?: number | null;
      notes?: string | null;
      created_by?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('supply_units')
        .insert({
          cycle_id: input.cycle_id,
          material_id: input.material_id,
          zone_code: input.zone_code,
          area_id: input.area_id || null,
          domain_id: input.domain_id || null,
          status: input.status || 'planned',
          target_price: input.target_price ?? null,
          notes: input.notes || null,
          created_by: input.created_by || null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as SupplyUnit;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supply-units'] });
    },
    onError: (e: Error) => toast.error('Failed to create supply unit: ' + e.message),
  });
}

export function useUpdateSupplyUnitStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, updated_by }: { id: string; status: SupplyUnitStatus; updated_by?: string | null }) => {
      const { error } = await supabase
        .from('supply_units')
        .update({ status, updated_by: updated_by || null } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supply-units'] });
      toast.success('Supply unit status updated');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

export async function findOrCreateSupplyUnit(input: {
  cycle_id: string;
  material_id: string;
  zone_code: string;
  domain_id?: string | null;
  created_by?: string | null;
}): Promise<SupplyUnit> {
  const { data: existing, error: findErr } = await supabase
    .from('supply_units')
    .select('*')
    .eq('cycle_id', input.cycle_id)
    .eq('material_id', input.material_id)
    .eq('zone_code', input.zone_code)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing) return existing as unknown as SupplyUnit;

  const { data, error } = await supabase
    .from('supply_units')
    .insert({
      cycle_id: input.cycle_id,
      material_id: input.material_id,
      zone_code: input.zone_code,
      domain_id: input.domain_id || null,
      status: 'planned',
      created_by: input.created_by || null,
    } as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as SupplyUnit;
}
