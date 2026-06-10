import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Hook to manage review flags on supply_domains (SSOT §7/§8.3).
 */
export function useDomainReview() {
  const queryClient = useQueryClient();

  const flagForReview = useMutation({
    mutationFn: async ({
      domainId,
      reason,
    }: {
      domainId: string;
      reason: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("supply_domains")
        .update({
          review_status: "needs_review",
          review_reason: reason,
          review_flagged_at: new Date().toISOString(),
          review_flagged_by: user?.id || null,
        } as any)
        .eq("id", domainId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supply-domains"] });
      queryClient.invalidateQueries({ queryKey: ["supply-coverage"] });
    },
  });

  const clearReview = useMutation({
    mutationFn: async ({ domainId }: { domainId: string }) => {
      const { error } = await supabase
        .from("supply_domains")
        .update({
          review_status: null,
          review_reason: null,
          review_flagged_at: null,
          review_flagged_by: null,
        } as any)
        .eq("id", domainId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supply-domains"] });
      queryClient.invalidateQueries({ queryKey: ["supply-coverage"] });
    },
  });

  return { flagForReview, clearReview };
}
