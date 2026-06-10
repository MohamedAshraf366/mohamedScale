import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Revise a sent quotation/price list.
 * Calls the `revise_quotation` RPC which creates a new draft with a fresh
 * official code and clones the previous sent items as a starting point.
 * The old sent document remains immutable history.
 */
export function useReviseQuotation() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (quotationId: string): Promise<string> => {
      const { data, error } = await supabase.rpc("revise_quotation" as any, {
        _quotation_id: quotationId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunity-quotation"] });
      qc.invalidateQueries({ queryKey: ["quotations"] });
      toast({
        title: "New draft created",
        description: "A new revision is ready to edit. The previous document stays as read-only history.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Could not revise",
        description: err?.message || "Failed to create a new draft.",
        variant: "destructive",
      });
    },
  });
}
