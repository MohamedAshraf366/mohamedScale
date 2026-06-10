import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TargetPrice {
  id: string;
  material_id: string;
  scope_type: string;
  scope_id: string;
  target_price: number;
  best_price: number | null;
  average_price: number | null;
  source_mode: string;
  is_locked: boolean;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  material_name?: string;
  material_code?: string | null;
  scope_label?: string | null;
}

export function useTargetPrices(subcategoryId?: string | null) {
  return useQuery({
    queryKey: ['target-prices', subcategoryId],
    queryFn: async (): Promise<TargetPrice[]> => {
      const { data, error } = await supabase
        .from('target_prices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const materialIds = [...new Set(data.map((r) => r.material_id))];
      const areaIds = [...new Set(
        data.filter((r) => r.scope_type === 'area').map((r) => r.scope_id)
      )];

      const [matsRes, areasRes] = await Promise.all([
        materialIds.length > 0
          ? supabase.from('materials').select('id, name, code, subcategory_id').in('id', materialIds)
          : Promise.resolve({ data: [] as any[] }),
        areaIds.length > 0
          ? supabase.from('subcategory_areas').select('id, name').in('id', areaIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const matMap = new Map((matsRes.data || []).map((m: any) => [m.id, m]));
      const areaMap = new Map((areasRes.data || []).map((a: any) => [a.id, a.name]));

      let results = data.map((row) => {
        const mat = matMap.get(row.material_id);
        const scopeLabel = row.scope_type === 'area'
          ? areaMap.get(row.scope_id) || null
          : row.scope_id;

        return {
          id: row.id,
          material_id: row.material_id,
          scope_type: row.scope_type,
          scope_id: row.scope_id,
          target_price: Number(row.target_price),
          best_price: row.best_price != null ? Number(row.best_price) : null,
          average_price: row.average_price != null ? Number(row.average_price) : null,
          source_mode: row.source_mode || 'manual',
          is_locked: row.is_locked || false,
          currency: row.currency,
          notes: row.notes,
          created_at: row.created_at,
          updated_at: row.updated_at,
          created_by: row.created_by,
          updated_by: row.updated_by,
          material_name: mat?.name || 'Unknown',
          material_code: mat?.code || null,
          scope_label: scopeLabel,
          _subcategory_id: mat?.subcategory_id,
        } as TargetPrice & { _subcategory_id?: string };
      });

      if (subcategoryId) {
        results = results.filter(r => (r as any)._subcategory_id === subcategoryId);
      }

      return results;
    },
  });
}

export function useCreateTargetPrice() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      material_ids: string[];
      scope_type: string;
      scope_id: string;
      target_price: number;
      notes?: string;
    }) => {
      const rows = input.material_ids.map(mid => ({
        material_id: mid,
        scope_type: input.scope_type,
        scope_id: input.scope_id,
        target_price: input.target_price,
        notes: input.notes || null,
      }));
      const { error } = await supabase.from('target_prices').insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['target-prices'] });
      toast.success('Target price(s) saved');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

export function useUpsertTargetPrices() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (entries: { material_id: string; scope_type: string; scope_id: string; target_price: number; best_price?: number | null; average_price?: number | null; source_mode?: string }[]) => {
      const rows = entries.map(e => ({
        material_id: e.material_id,
        scope_type: e.scope_type,
        scope_id: e.scope_id,
        target_price: e.target_price,
        best_price: e.best_price ?? null,
        average_price: e.average_price ?? null,
        source_mode: e.source_mode || 'manual',
      }));
      const { error } = await supabase
        .from('target_prices')
        .upsert(rows as any, { onConflict: 'material_id,scope_type,scope_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['target-prices'] });
      toast.success('Target prices saved');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

export function useUpdateTargetPrice() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, target_price, notes, is_locked }: { id: string; target_price: number; notes?: string; is_locked?: boolean }) => {
      const update: Record<string, any> = {
        target_price,
        notes: notes ?? null,
        source_mode: 'manual',
        updated_at: new Date().toISOString(),
      };
      if (is_locked !== undefined) update.is_locked = is_locked;
      const { error } = await supabase
        .from('target_prices')
        .update(update as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['target-prices'] });
      toast.success('Target price updated');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

export function useDeleteTargetPrice() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('target_prices').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['target-prices'] });
      toast.success('Target price deleted');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

export function useTargetPriceCheck(materialId: string | null) {
  return useQuery({
    queryKey: ['target-price-check', materialId],
    enabled: !!materialId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('target_prices')
        .select('id')
        .eq('material_id', materialId!)
        .limit(1);

      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
  });
}

export function useTargetPriceBulkCheck(materialIds: string[]) {
  return useQuery({
    queryKey: ['target-price-bulk-check', materialIds],
    enabled: materialIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('target_prices')
        .select('material_id')
        .in('material_id', materialIds);

      if (error) throw error;
      return new Set((data || []).map((r) => r.material_id));
    },
  });
}
