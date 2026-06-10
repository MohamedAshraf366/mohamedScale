import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ZoneGroup {
  id: string;
  name: string;
  name_ar: string | null;
  region_code: string;
  zone_codes: string[];
  color: string;
  created_at: string;
  updated_at: string;
}

export function useZoneGroups(regionCode?: string | null) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['zone-groups', regionCode],
    queryFn: async () => {
      let q = supabase.from('zone_groups').select('*').order('name');
      if (regionCode) q = q.eq('region_code', regionCode);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as ZoneGroup[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (group: Partial<ZoneGroup> & { name: string; region_code: string }) => {
      if (group.id) {
        const { error } = await supabase
          .from('zone_groups')
          .update({
            name: group.name,
            name_ar: group.name_ar ?? null,
            zone_codes: group.zone_codes ?? [],
            color: group.color ?? '#6366f1',
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', group.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('zone_groups').insert({
          name: group.name,
          name_ar: group.name_ar ?? null,
          region_code: group.region_code,
          zone_codes: group.zone_codes ?? [],
          color: group.color ?? '#6366f1',
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zone-groups'] });
      toast({ title: 'Zone group saved' });
    },
    onError: (e: Error) => {
      toast({ title: 'Failed to save group', description: e.message, variant: 'destructive' });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('zone_groups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zone-groups'] });
      toast({ title: 'Zone group deleted' });
    },
    onError: (e: Error) => {
      toast({ title: 'Failed to delete group', description: e.message, variant: 'destructive' });
    },
  });

  return {
    groups: query.data || [],
    isLoading: query.isLoading,
    upsert,
    remove,
  };
}
