import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * SSOT §3.2: Promotes cycle results to domain-level directives.
 * Now delegates to the `promote_cycle_to_domain` DB function
 * which handles deactivation, history preservation, and role constraints.
 */
export function usePromoteCycleResults() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ cycleId }: { cycleId: string }) => {
      const { data: cycleDomains, error: cdErr } = await supabase
        .from('supply_cycle_domains')
        .select('domain_id')
        .eq('cycle_id', cycleId);
      if (cdErr) throw cdErr;
      if (!cycleDomains || cycleDomains.length === 0) return 0;

      let totalPromoted = 0;
      for (const cd of cycleDomains) {
        const { data, error } = await supabase.rpc('promote_cycle_to_domain', {
          p_cycle_id: cycleId,
          p_domain_id: cd.domain_id,
        });
        if (error) throw error;
        totalPromoted += (data as number) || 0;
      }

      return totalPromoted;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['supply-domain-directives'] });
      toast.success(`Promoted ${count || 0} directive(s) to domains`);
    },
    onError: (e: Error) => toast.error('Failed to promote results: ' + e.message),
  });
}
