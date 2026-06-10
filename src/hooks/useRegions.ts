import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface Region {
  id: string;
  code: string;
  name_en: string;
  name_ar: string | null;
  boundary_geojson: Json | null;
  center_lat: number | null;
  center_lng: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  zones_count?: number;
}

export function useRegions() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('regions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'regions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['regions'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const regionsQuery = useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      const { data: regions, error } = await supabase
        .from('regions')
        .select('*')
        .order('code');
      if (error) throw error;

      const { data: zoneCounts, error: zoneError } = await supabase
        .from('zones')
        .select('region_code')
        .not('region_code', 'is', null);
      if (zoneError) throw zoneError;

      const countMap: Record<string, number> = {};
      (zoneCounts as any[])?.forEach((z) => {
        if (z.region_code) {
          countMap[z.region_code] = (countMap[z.region_code] || 0) + 1;
        }
      });

      return (regions as Region[]).map((r) => ({
        ...r,
        zones_count: countMap[r.code] || 0,
      }));
    },
  });

  return {
    regions: regionsQuery.data || [],
    isLoading: regionsQuery.isLoading,
    error: regionsQuery.error,
  };
}
