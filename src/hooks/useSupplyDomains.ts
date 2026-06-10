import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SupplyDomain {
  id: string;
  subcategory_id: string;
  area_id: string;
  axis_value: string | null;
  label: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface SupplyDomainDirective {
  id: string;
  domain_id: string;
  supplier_account_id: string;
  role: 'selected' | 'quality' | 'fallback';
  landed_price: number | null;
  set_by_cycle_id: string | null;
  notes: string | null;
  is_active: boolean;
  effective_from: string;
  effective_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplyCycleDomain {
  id: string;
  cycle_id: string;
  domain_id: string;
  created_at: string;
}

// ─── Domain queries ──────────────────────────────────────────────────────────

export function useSupplyDomainsBySubcategory(subcategoryId?: string | null) {
  return useQuery({
    queryKey: ['supply-domains', 'subcategory', subcategoryId],
    enabled: !!subcategoryId,
    queryFn: async (): Promise<SupplyDomain[]> => {
      const { data, error } = await supabase
        .from('supply_domains')
        .select('*')
        .eq('subcategory_id', subcategoryId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as SupplyDomain[];
    },
  });
}

export function useSupplyDomainsByCycle(cycleId?: string) {
  return useQuery({
    queryKey: ['supply-cycle-domains', cycleId],
    enabled: !!cycleId,
    queryFn: async (): Promise<(SupplyCycleDomain & { domain: SupplyDomain })[]> => {
      const { data, error } = await supabase
        .from('supply_cycle_domains')
        .select('*, domain:supply_domains(*)')
        .eq('cycle_id', cycleId!);
      if (error) throw error;
      return (data || []) as unknown as (SupplyCycleDomain & { domain: SupplyDomain })[];
    },
  });
}

// ─── Domain mutations ────────────────────────────────────────────────────────

export function useCreateSupplyDomain() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      subcategory_id: string;
      area_id: string;
      axis_value?: string | null;
      label: string;
      status?: string;
      notes?: string | null;
      created_by?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('supply_domains')
        .insert({
          subcategory_id: input.subcategory_id,
          area_id: input.area_id,
          axis_value: input.axis_value ?? null,
          label: input.label,
          status: input.status || 'active',
          notes: input.notes || null,
          created_by: input.created_by || null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as SupplyDomain;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supply-domains'] });
    },
    onError: (e: Error) => toast.error('Failed to create domain: ' + e.message),
  });
}

export function useUpsertSupplyDomains() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      domains: {
        subcategory_id: string;
        area_id: string;
        axis_value: string | null;
        label: string;
      }[]
    ) => {
      if (domains.length === 0) return [];

      const subcatId = domains[0].subcategory_id;
      const { data: existing } = await supabase
        .from('supply_domains')
        .select('id, area_id, axis_value, label, status')
        .eq('subcategory_id', subcatId);

      const existingMap = new Map(
        (existing || []).map((d: any) => [`${d.area_id}|${d.axis_value}`, d])
      );

      const toInsert: any[] = [];
      const toReactivate: string[] = [];
      const results: any[] = [];

      for (const d of domains) {
        const key = `${d.area_id}|${d.axis_value}`;
        const ex = existingMap.get(key);
        if (ex) {
          if (ex.status !== 'active') toReactivate.push(ex.id);
          results.push(ex);
        } else {
          toInsert.push({
            subcategory_id: d.subcategory_id,
            area_id: d.area_id,
            axis_value: d.axis_value,
            label: d.label,
            status: 'active',
          });
        }
      }

      if (toReactivate.length > 0) {
        await supabase.from('supply_domains').update({ status: 'active' } as any).in('id', toReactivate);
      }

      if (toInsert.length > 0) {
        const { data: inserted, error } = await supabase
          .from('supply_domains')
          .insert(toInsert as any)
          .select();
        if (error) throw error;
        results.push(...(inserted || []));
      }

      return results as unknown as SupplyDomain[];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supply-domains'] });
    },
    onError: (e: Error) => toast.error('Failed to upsert domains: ' + e.message),
  });
}

// ─── Domain directives (SSOT §3) ─────────────────────────────────────────────

export function useDomainDirectives(domainId?: string | null) {
  return useQuery({
    queryKey: ['supply-domain-directives', domainId],
    enabled: !!domainId,
    queryFn: async (): Promise<SupplyDomainDirective[]> => {
      const { data, error } = await supabase
        .from('supply_domain_directives')
        .select('*')
        .eq('domain_id', domainId!)
        .eq('is_active', true);
      if (error) throw error;
      return (data || []) as unknown as SupplyDomainDirective[];
    },
  });
}

export function useUpsertDomainDirective() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      domain_id: string;
      supplier_account_id: string;
      role: 'selected' | 'quality' | 'fallback';
      landed_price?: number | null;
      set_by_cycle_id?: string | null;
      notes?: string | null;
    }) => {
      if (input.role === 'selected' || input.role === 'quality') {
        await supabase
          .from('supply_domain_directives')
          .update({ is_active: false, effective_until: new Date().toISOString() } as any)
          .eq('domain_id', input.domain_id)
          .eq('role', input.role)
          .eq('is_active', true);
      }

      const { error } = await supabase
        .from('supply_domain_directives')
        .insert({
          domain_id: input.domain_id,
          supplier_account_id: input.supplier_account_id,
          role: input.role,
          landed_price: input.landed_price ?? null,
          set_by_cycle_id: input.set_by_cycle_id ?? null,
          notes: input.notes ?? null,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supply-domain-directives'] });
      toast.success('Domain directive updated');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

// ─── Link cycles to domains ─────────────────────────────────────────────────

export function useLinkCycleDomains() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (links: { cycle_id: string; domain_id: string }[]) => {
      if (links.length === 0) return;
      const { error } = await supabase
        .from('supply_cycle_domains')
        .insert(
          links.map((l) => ({
            cycle_id: l.cycle_id,
            domain_id: l.domain_id,
          })) as any
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supply-cycle-domains'] });
    },
    onError: (e: Error) => toast.error('Failed to link domains: ' + e.message),
  });
}

// ─── Auto-generation helpers ─────────────────────────────────────────────────

interface SpecDef {
  key: string;
  label_en: string;
  options: { value: string; label_en: string }[];
}

export async function autoGenerateDomains(
  subcategoryId: string,
  domainAxis: string | null,
  specDefinitions: SpecDef[],
  areas: { id: string; name: string }[],
): Promise<{ created: number; deactivated: number }> {
  let axisValues: (string | null)[] = [null];
  if (domainAxis) {
    const spec = specDefinitions.find(s => s.key === domainAxis);
    if (spec && spec.options.length > 0) {
      axisValues = spec.options.map(o => o.value);
    }
  }

  const desired: { subcategory_id: string; area_id: string; axis_value: string | null; label: string }[] = [];
  for (const area of areas) {
    for (const axisVal of axisValues) {
      const axisLabel = axisVal
        ? specDefinitions.find(s => s.key === domainAxis)?.options.find(o => o.value === axisVal)?.label_en || axisVal
        : null;
      const label = axisLabel ? `${axisLabel} × ${area.name}` : area.name;
      desired.push({ subcategory_id: subcategoryId, area_id: area.id, axis_value: axisVal, label });
    }
  }

  const { data: existing } = await supabase
    .from('supply_domains')
    .select('id, area_id, axis_value, status')
    .eq('subcategory_id', subcategoryId);

  const existingMap = new Map(
    (existing || []).map((d: any) => [`${d.area_id}|${d.axis_value}`, d])
  );

  const toInsert: any[] = [];
  const toReactivate: string[] = [];
  let created = 0;

  for (const d of desired) {
    const key = `${d.area_id}|${d.axis_value}`;
    const ex = existingMap.get(key);
    if (ex) {
      if (ex.status !== 'active') toReactivate.push(ex.id);
    } else {
      toInsert.push({ ...d, status: 'active' });
      created++;
    }
  }

  if (toReactivate.length > 0) {
    await supabase.from('supply_domains').update({ status: 'active' } as any).in('id', toReactivate);
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('supply_domains').insert(toInsert as any);
    if (error) throw error;
  }

  const { data: allExisting } = await supabase
    .from('supply_domains')
    .select('id, area_id, axis_value, status')
    .eq('subcategory_id', subcategoryId);

  const desiredKeys = new Set(desired.map(d => `${d.area_id}|${d.axis_value}`));
  const orphanIds = (allExisting || [])
    .filter((d: any) => !desiredKeys.has(`${d.area_id}|${d.axis_value}`))
    .map((d: any) => d.id);

  let deactivated = 0;
  if (orphanIds.length > 0) {
    const [cycleLinked, directiveLinked] = await Promise.all([
      supabase.from('supply_cycle_domains').select('domain_id').in('domain_id', orphanIds),
      supabase.from('supply_domain_directives').select('domain_id').in('domain_id', orphanIds),
    ]);

    const referencedIds = new Set([
      ...((cycleLinked.data || []) as any[]).map(l => l.domain_id),
      ...((directiveLinked.data || []) as any[]).map(l => l.domain_id),
    ]);
    const safeToDeactivate = orphanIds.filter((id: string) => !referencedIds.has(id));

    if (safeToDeactivate.length > 0) {
      await supabase
        .from('supply_domains')
        .update({ status: 'inactive' } as any)
        .in('id', safeToDeactivate);
      deactivated = safeToDeactivate.length;
    }
  }

  return { created, deactivated };
}

export async function checkDomainImplications(
  subcategoryId: string,
): Promise<{ hasActiveCycles: boolean; activeCycleCount: number }> {
  const { data: domains } = await supabase
    .from('supply_domains')
    .select('id')
    .eq('subcategory_id', subcategoryId)
    .eq('status', 'active');

  if (!domains || domains.length === 0) return { hasActiveCycles: false, activeCycleCount: 0 };

  const { data: linked } = await supabase
    .from('supply_cycle_domains')
    .select('cycle_id')
    .in('domain_id', domains.map(d => d.id));

  const uniqueCycles = new Set((linked || []).map(l => (l as any).cycle_id));
  return { hasActiveCycles: uniqueCycles.size > 0, activeCycleCount: uniqueCycles.size };
}

// ─── Non-hook helpers ────────────────────────────────────────────────────────

export async function findOrCreateDomain(input: {
  subcategory_id: string;
  area_id: string;
  axis_value: string | null;
  label: string;
}): Promise<SupplyDomain> {
  let query = supabase
    .from('supply_domains')
    .select('*')
    .eq('subcategory_id', input.subcategory_id)
    .eq('area_id', input.area_id);

  if (input.axis_value === null) {
    query = query.is('axis_value', null);
  } else {
    query = query.eq('axis_value', input.axis_value);
  }

  const { data: existing, error: findErr } = await query.maybeSingle();
  if (findErr) throw findErr;
  if (existing) return existing as unknown as SupplyDomain;

  const { data, error } = await supabase
    .from('supply_domains')
    .insert({
      subcategory_id: input.subcategory_id,
      area_id: input.area_id,
      axis_value: input.axis_value,
      label: input.label,
      status: 'active',
    } as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as SupplyDomain;
}
