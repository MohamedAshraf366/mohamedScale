import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MaterialDependency {
  table_name: string;
  record_count: number;
}


export function useMaterialDependencies(variantId: string | null) {
  return useQuery({
    queryKey: ['material-dependencies', variantId],
    queryFn: async (): Promise<MaterialDependency[]> => {
      if (!variantId) return [];

      const dependencies: MaterialDependency[] = [];

      // Use Promise.all for parallel requests (faster)
      const [supplyResult] = await Promise.all([
        supabase
          .from('supply_units')
          .select('*', { count: 'exact', head: true })
          .eq('material_id', variantId),
      ]);

      if (!supplyResult.error && supplyResult.count && supplyResult.count > 0) {
        dependencies.push({ table_name: 'supply_units', record_count: supplyResult.count });
      }

      return dependencies;
    },
    enabled: !!variantId,
    staleTime: 0, // Always fetch fresh data when dialog opens
    gcTime: 0, // Don't cache
  });
}
export function getTableDisplayName(tableName: string): string {
  const names: Record<string, string> = {
    quotation_items: 'Quotations',
    order_items: 'Orders',
    supply_units: 'Supply Units',
  };
  return names[tableName] || tableName;
}