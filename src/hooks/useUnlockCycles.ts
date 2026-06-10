import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface UnlockCycle {
  id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  zone_codes: string[];
  zone_group_ids: string[];
  subcategory_id: string | null;
  scope_filter: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  material_count?: number;
  subcategory_name?: string;
  domain_count?: number;
}

export interface UnlockCycleMaterial {
  id: string;
  cycle_id: string;
  material_id: string;
  status: string;
  notes: string | null;
  created_at: string;
  material_name?: string;
  material_code?: string | null;
}

export function useUnlockCycles() {
  return useQuery({
    queryKey: ['unlock-cycles'],
    queryFn: async (): Promise<UnlockCycle[]> => {
      const { data, error } = await supabase
        .from('unlock_cycles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const cycleIds = (data || []).map((c: any) => c.id);
      let countMap = new Map<string, number>();
      let domainCountMap = new Map<string, number>();

      if (cycleIds.length > 0) {
        const [matsRes, domainsRes] = await Promise.all([
          supabase.from('unlock_cycle_materials').select('cycle_id').in('cycle_id', cycleIds),
          supabase.from('supply_cycle_domains').select('cycle_id').in('cycle_id', cycleIds),
        ]);

        (matsRes.data || []).forEach((m: any) => {
          countMap.set(m.cycle_id, (countMap.get(m.cycle_id) || 0) + 1);
        });
        (domainsRes.data || []).forEach((d: any) => {
          domainCountMap.set(d.cycle_id, (domainCountMap.get(d.cycle_id) || 0) + 1);
        });
      }

      const subcatIds = [...new Set((data || []).map((c: any) => c.subcategory_id).filter(Boolean))];
      let subcatMap = new Map<string, string>();
      if (subcatIds.length > 0) {
        const { data: subs } = await supabase
          .from('material_subcategories')
          .select('id, name_en')
          .in('id', subcatIds);
        (subs || []).forEach((s: any) => subcatMap.set(s.id, s.name_en));
      }

      return (data || []).map((c: any) => ({
        ...c,
        zone_codes: c.zone_codes || [],
        zone_group_ids: c.zone_group_ids || [],
        scope_filter: c.scope_filter || {},
        material_count: countMap.get(c.id) || 0,
        domain_count: domainCountMap.get(c.id) || 0,
        subcategory_name: c.subcategory_id ? subcatMap.get(c.subcategory_id) || null : null,
      }));
    },
  });
}

export function useUnlockCycleMaterials(cycleId?: string) {
  return useQuery({
    queryKey: ['unlock-cycle-materials', cycleId],
    enabled: !!cycleId,
    queryFn: async (): Promise<UnlockCycleMaterial[]> => {
      const { data, error } = await supabase
        .from('unlock_cycle_materials')
        .select('*')
        .eq('cycle_id', cycleId!)
        .order('created_at');
      if (error) throw error;

      const matIds = [...new Set((data || []).map((r: any) => r.material_id))];
      const matsRes = matIds.length > 0
        ? await supabase.from('materials').select('id, name, code').in('id', matIds)
        : { data: [] as any[] };
      const matMap = new Map((matsRes.data || []).map((m: any) => [m.id, m]));

      return (data || []).map((r: any) => {
        const mat = matMap.get(r.material_id);
        return {
          ...r,
          material_name: mat?.name || 'Unknown',
          material_code: mat?.code || null,
        };
      });
    },
  });
}

export function useCreateUnlockCycle() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      start_date?: string;
      end_date?: string;
      subcategory_id: string;
      zone_codes: string[];
      zone_group_ids: string[];
      material_ids: string[];
      area_zone_map: Record<string, string[]>;
      domain_ids: string[];
    }) => {
      if (!input.domain_ids.length) throw new Error('At least one domain is required');

      const { data: cycle, error } = await supabase
        .from('unlock_cycles')
        .insert({
          name: input.name,
          description: input.description || null,
          start_date: input.start_date || null,
          end_date: input.end_date || null,
          subcategory_id: input.subcategory_id,
          scope_filter: {},
          zone_codes: input.zone_codes,
          zone_group_ids: input.zone_group_ids,
        } as any)
        .select()
        .single();
      if (error) throw error;

      const domainRows = input.domain_ids.map(did => ({
        cycle_id: cycle.id,
        domain_id: did,
      }));
      const { error: dErr } = await supabase.from('supply_cycle_domains').insert(domainRows as any);
      if (dErr) throw dErr;

      const { data: domainDetails } = await supabase
        .from('supply_domains')
        .select('id, area_id, axis_value')
        .in('id', input.domain_ids);

      const domainByArea = new Map<string, any[]>();
      (domainDetails || []).forEach((d: any) => {
        const existing = domainByArea.get(d.area_id) || [];
        existing.push(d);
        domainByArea.set(d.area_id, existing);
      });

      if (input.material_ids.length > 0) {
        const rows = input.material_ids.map(mid => ({
          cycle_id: cycle.id,
          material_id: mid,
        }));
        const { error: mErr } = await supabase.from('unlock_cycle_materials').insert(rows as any);
        if (mErr) throw mErr;
      }

      const zoneToArea = new Map<string, string>();
      Object.entries(input.area_zone_map).forEach(([areaId, zones]) => {
        zones.forEach(zc => zoneToArea.set(zc, areaId));
      });

      const { data: subcatData } = await supabase
        .from('material_subcategories')
        .select('domain_axis, spec_definitions, variant_definitions')
        .eq('id', input.subcategory_id)
        .single();
      const domainAxis = (subcatData as any)?.domain_axis || null;

      let matSpecsMap = new Map<string, Record<string, string>>();
      if (domainAxis && input.material_ids.length > 0) {
        const { parseSpecsFromCode } = await import('@/lib/coding-system');
        const { data: matRows } = await supabase
          .from('materials')
          .select('id, code')
          .in('id', input.material_ids);
        (matRows || []).forEach((m: any) => {
          matSpecsMap.set(m.id, parseSpecsFromCode(m.code, subcatData as any));
        });
      }

      if (input.material_ids.length > 0 && input.zone_codes.length > 0) {
        const unitRows = input.material_ids.flatMap(mid =>
          input.zone_codes.map(zc => {
            const areaId = zoneToArea.get(zc) || null;
            let domainId: string | null = null;

            if (areaId) {
              const areaDomains = domainByArea.get(areaId) || [];
              if (areaDomains.length === 1) {
                domainId = areaDomains[0].id;
              } else if (areaDomains.length > 1 && domainAxis) {
                const matSpecVal = matSpecsMap.get(mid)?.[domainAxis] || null;
                const match = areaDomains.find((d: any) => d.axis_value === matSpecVal);
                domainId = match?.id || null;
              }
            }

            return {
              cycle_id: cycle.id,
              material_id: mid,
              zone_code: zc,
              area_id: areaId,
              domain_id: domainId,
            };
          })
        );

        for (let i = 0; i < unitRows.length; i += 500) {
          const batch = unitRows.slice(i, i + 500);
          const { error: uErr } = await supabase.from('supply_units').insert(batch as any);
          if (uErr) throw uErr;
        }
      }

      return cycle;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unlock-cycles'] });
      qc.invalidateQueries({ queryKey: ['supply-units'] });
      qc.invalidateQueries({ queryKey: ['supply-cycle-domains'] });
      toast.success('Supply cycle created');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

export function useUpdateUnlockCycleStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('unlock_cycles')
        .update({ status, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unlock-cycles'] });
      toast.success('Cycle status updated');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

export function useAddCycleMaterials() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ cycleId, materialIds }: { cycleId: string; materialIds: string[] }) => {
      const rows = materialIds.map(mid => ({ cycle_id: cycleId, material_id: mid }));
      const { error } = await supabase.from('unlock_cycle_materials').insert(rows as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['unlock-cycle-materials', vars.cycleId] });
      qc.invalidateQueries({ queryKey: ['unlock-cycles'] });
      toast.success('Materials added to cycle');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

export function useRemoveCycleMaterial() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, cycleId }: { id: string; cycleId: string }) => {
      const { error } = await supabase.from('unlock_cycle_materials').delete().eq('id', id);
      if (error) throw error;
      return cycleId;
    },
    onSuccess: (cycleId) => {
      qc.invalidateQueries({ queryKey: ['unlock-cycle-materials', cycleId] });
      qc.invalidateQueries({ queryKey: ['unlock-cycles'] });
      toast.success('Material removed');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

export function useUpdateCycleMaterialStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, cycleId, status }: { id: string; cycleId: string; status: string }) => {
      const { error } = await supabase
        .from('unlock_cycle_materials')
        .update({ status } as any)
        .eq('id', id);
      if (error) throw error;
      return cycleId;
    },
    onSuccess: (cycleId) => {
      qc.invalidateQueries({ queryKey: ['unlock-cycle-materials', cycleId] });
      toast.success('Material status updated');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

export interface SupplyUnit {
  id: string;
  cycle_id: string;
  material_id: string;
  zone_code: string;
  area_id: string | null;
  domain_id: string | null;
  status: string;
  target_price: number | null;
  notes: string | null;
  created_at: string;
  material_name?: string;
  material_code?: string | null;
  area_name?: string | null;
  area_color?: string | null;
}

export function useSupplyUnits(cycleId?: string) {
  return useQuery({
    queryKey: ['supply-units', cycleId],
    enabled: !!cycleId,
    queryFn: async (): Promise<SupplyUnit[]> => {
      const { data, error } = await supabase
        .from('supply_units')
        .select('*')
        .eq('cycle_id', cycleId!)
        .order('zone_code');
      if (error) throw error;

      const rows = data || [];
      const matIds = [...new Set(rows.map((r: any) => r.material_id))];
      let matMap = new Map<string, any>();
      if (matIds.length > 0) {
        const { data: mats } = await supabase.from('materials').select('id, name, code').in('id', matIds);
        (mats || []).forEach((m: any) => matMap.set(m.id, m));
      }

      const areaIds = [...new Set(rows.map((r: any) => r.area_id).filter(Boolean))];
      let areaMap = new Map<string, any>();
      if (areaIds.length > 0) {
        const { data: areas } = await supabase.from('subcategory_areas').select('id, name, color').in('id', areaIds);
        (areas || []).forEach((a: any) => areaMap.set(a.id, a));
      }

      return rows.map((r: any) => {
        const mat = matMap.get(r.material_id);
        const area = r.area_id ? areaMap.get(r.area_id) : null;
        return {
          ...r,
          material_name: mat?.name || 'Unknown',
          material_code: mat?.code || null,
          area_name: area?.name || null,
          area_color: area?.color || null,
        };
      });
    },
  });
}
