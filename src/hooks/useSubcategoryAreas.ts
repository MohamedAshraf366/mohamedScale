import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SubcategoryArea {
  id: string;
  subcategory_id: string;
  name: string;
  name_ar: string | null;
  zone_codes: string[];
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useSubcategoryAreas(subcategoryId: string | null) {
  return useQuery({
    queryKey: ['subcategory-areas', subcategoryId],
    enabled: !!subcategoryId,
    queryFn: async (): Promise<SubcategoryArea[]> => {
      const { data, error } = await supabase
        .from('subcategory_areas')
        .select('*')
        .eq('subcategory_id', subcategoryId!)
        .order('sort_order');
      if (error) throw error;
      return (data || []) as unknown as SubcategoryArea[];
    },
  });
}

export function useSaveSubcategoryAreas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      subcategoryId,
      areas,
    }: {
      subcategoryId: string;
      areas: { id?: string; name: string; zone_codes: string[]; color: string; sort_order: number }[];
    }) => {
      // Delete existing areas for this subcategory
      const { error: delErr } = await supabase
        .from('subcategory_areas')
        .delete()
        .eq('subcategory_id', subcategoryId);
      if (delErr) throw delErr;

      // Insert new areas
      if (areas.length > 0) {
        const rows = areas.map(a => ({
          subcategory_id: subcategoryId,
          name: a.name,
          zone_codes: a.zone_codes,
          color: a.color,
          sort_order: a.sort_order,
        }));
        const { error: insErr } = await supabase
          .from('subcategory_areas')
          .insert(rows as any);
        if (insErr) throw insErr;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['subcategory-areas', vars.subcategoryId] });
      qc.invalidateQueries({ queryKey: ['supply-domains'] });
      qc.invalidateQueries({ queryKey: ['target-prices'] });
      toast.success('Areas saved');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}
