import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';



// DB-valid statuses per CHECK constraint
export type RenegotiationStatus = 'open' | 'outreach_sent' | 'quote_received' | 'under_review' | 'resolved' | 'cancelled';
export type RenegotiationTrigger = 'validity_expiry' | 'target_price_reduction' | 'manual';

export interface RenegotiationCase {
  id: string;
  supplier_account_id: string;
  original_quote_id: string;
  trigger_type: RenegotiationTrigger;
  trigger_ref_id: string | null;
  priority: string;
  status: RenegotiationStatus;
  assigned_to: string | null;
  notes: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  replacement_quote_id: string | null;
  created_at: string;
  updated_at: string;
  // joined
  supplier_name?: string | null;
}

const QUERY_KEY = 'renegotiation-cases';

export function useRenegotiationCases(filters?: {
  supplierId?: string;
  quoteId?: string;
  status?: RenegotiationStatus | 'all';
}) {

  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: async (): Promise<RenegotiationCase[]> => {

      let q = supabase
        .from('renegotiation_cases')
        .select('*')
        
        .order('created_at', { ascending: false });

      if (filters?.supplierId) q = q.eq('supplier_account_id', filters.supplierId);
      if (filters?.quoteId) q = q.eq('original_quote_id', filters.quoteId);
      if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);

      const { data, error } = await q;
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const supplierIds = [...new Set(data.map(r => r.supplier_account_id))];
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, display_name').is('deleted_at', null)
        .in('id', supplierIds);
      const nameMap = new Map((accounts || []).map(a => [a.id, a.display_name]));

      return data.map(r => ({
        ...r,
        trigger_type: r.trigger_type as RenegotiationTrigger,
        status: r.status as RenegotiationStatus,
        supplier_name: nameMap.get(r.supplier_account_id) || null,
      })) as RenegotiationCase[];
    },
  });
}

export function useCreateRenegotiationCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      supplier_account_id: string;
      original_quote_id: string;
      trigger_type: RenegotiationTrigger;
      trigger_ref_id?: string;
      notes?: string;
      assigned_to?: string;
      created_by?: string;
    }) => {
      // Note: renegotiation_cases doesn't have is_example but is filtered via account join
      const { data, error } = await supabase
        .from('renegotiation_cases')
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Renegotiation case created');
    },
    onError: (e: Error) => toast.error('Failed to create case: ' + e.message),
  });
}

export function useUpdateRenegotiationCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      status?: RenegotiationStatus;
      assigned_to?: string | null;
      notes?: string | null;
      resolution_notes?: string | null;
      resolved_at?: string | null;
      resolved_by?: string | null;
      replacement_quote_id?: string | null;
      priority?: string;
    }) => {
      const { data, error } = await supabase
        .from('renegotiation_cases')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Case updated');
    },
    onError: (e: Error) => toast.error('Failed to update case: ' + e.message),
  });
}
