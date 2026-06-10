import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';



export type SupplierActionType =
  | 'warning'
  | 'freeze'
  | 'unfreeze'
  | 'demote_to_backup'
  | 'remove_from_unit'
  | 'blacklist'
  | 'unblacklist';

export interface SupplierAction {
  id: string;
  supplier_account_id: string;
  issue_id: string | null;
  supply_unit_id: string | null;
  affected_material_id: string | null;
  affected_zone_code: string | null;
  action_type: SupplierActionType;
  reason: string | null;
  performed_by: string | null;
  created_at: string;
}

const QUERY_KEY = 'supplier-actions';

export function useSupplierActions(filters?: {
  supplierId?: string;
  issueId?: string;
}) {

  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: async (): Promise<SupplierAction[]> => {

      let q = supabase
        .from('supplier_actions')
        .select('*')
        
        .order('created_at', { ascending: false });

      if (filters?.supplierId) q = q.eq('supplier_account_id', filters.supplierId);
      if (filters?.issueId) q = q.eq('issue_id', filters.issueId);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as SupplierAction[];
    },
  });
}

export function useCreateSupplierAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      supplier_account_id: string;
      action_type: SupplierActionType;
      reason?: string;
      issue_id?: string;
      supply_unit_id?: string;
      affected_material_id?: string;
      affected_zone_code?: string;
      performed_by?: string;
    }) => {
      const { data, error } = await supabase
        .from('supplier_actions')
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Action recorded');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}
