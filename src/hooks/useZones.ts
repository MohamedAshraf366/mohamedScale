import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { invalidateZoneCache } from '@/lib/geo-utils';
import type { Json } from '@/integrations/supabase/types';

export interface Zone {
  id: string;
  name: string | null;
  name_ar: string | null;
  boundary_geojson: Json | null;
  is_active?: boolean;

  // New code-based geography
  region_code: string;
  zone_no: string | null;
  code: string; // full code like "RYD.01001"

  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useZones(regionCode?: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('zones-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zones' }, () => {
        queryClient.invalidateQueries({ queryKey: ['zones'] });
        queryClient.invalidateQueries({ queryKey: ['regions'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const zonesQuery = useQuery({
    queryKey: ['zones', regionCode],
    queryFn: async () => {
      let query = supabase.from('zones').select('*').order('code');
      if (regionCode) query = query.eq('region_code', regionCode);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((z) => ({ ...z, is_active: true })) as unknown as Zone[];
    },
  });

  // Check how many locations reference zones
  const checkLocationReferences = async (): Promise<number> => {
    const { count, error } = await supabase
      .from('locations')
      .select('id', { count: 'exact', head: true })
      .not('zone_code', 'is', null);
    if (error) throw error;
    return count || 0;
  };

  // Bulk import: delete all zones then insert new ones
  const bulkImport = useMutation({
    mutationFn: async (payload: {
      zones: { region_code: string; code: string; name: string; name_ar: string | null; boundary_geojson: Json }[];
      regions: string[];
      forceOverride?: boolean;
    }) => {
      // 1. Check location references
      const refCount = await checkLocationReferences();
      if (refCount > 0 && !payload.forceOverride) {
        throw new Error(`SAFEGUARD:${refCount}`);
      }

      // 2. Clear zone_code from locations if overriding
      if (refCount > 0 && payload.forceOverride) {
        const { error: clearError } = await supabase
          .from('locations')
          .update({ zone_code: null } as any)
          .not('zone_code', 'is', null);
        if (clearError) throw clearError;
      }

      // 3. Delete all existing zones
      const { error: delError } = await supabase
        .from('zones')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (delError) throw delError;

      // 4. Ensure regions exist (by code)
      const { error: regError } = await supabase
        .from('regions')
        .upsert(
          payload.regions.map((code) => ({ code, name_en: code, name_ar: code })),
          { onConflict: 'code' }
        );
      if (regError) throw regError;

      // 5. Prepare zones for new schema
      const zonesToInsert = payload.zones.map((z) => ({
        region_code: z.region_code,
        zone_no: z.code,
        name: z.name,
        name_ar: z.name_ar,
        boundary_geojson: z.boundary_geojson,
      }));

      // 6. Insert zones in batches
      for (let i = 0; i < zonesToInsert.length; i += 50) {
        const batch = zonesToInsert.slice(i, i + 50);
        const { error } = await supabase.from('zones').insert(batch as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateZoneCache();
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      queryClient.invalidateQueries({ queryKey: ['regions'] });
      toast({ title: 'Zones imported successfully' });
    },
    onError: (error: Error) => {
      // Don't toast for safeguard errors - handled by UI
      if (error.message.startsWith('SAFEGUARD:')) return;
      toast({
        title: 'Failed to import zones',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateZone = useMutation({
    mutationFn: async (payload: { id: string; name?: string; name_ar?: string | null }) => {
      const { error } = await supabase
        .from('zones')
        .update({ name: payload.name, name_ar: payload.name_ar, updated_at: new Date().toISOString() } as any)
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      toast({ title: 'Zone updated' });
    },
    onError: (e: Error) => {
      toast({ title: 'Failed to update zone', description: e.message, variant: 'destructive' });
    },
  });

  return {
    zones: zonesQuery.data || [],
    isLoading: zonesQuery.isLoading,
    error: zonesQuery.error,
    bulkImport,
    updateZone,
    checkLocationReferences,
  };
}
