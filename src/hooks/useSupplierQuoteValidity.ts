import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// DB-valid statuses per CHECK constraint
export type ValidityStatus =
  | 'active'
  | 'expiring_soon'
  | 'outreach_sent'
  | 'supplier_confirmed'
  | 'supplier_changed'
  | 'management_approved'
  | 'expired';

export interface SupplierQuoteValidityRecord {
  id: string;
  supplier_quote_id: string;
  renegotiation_case_id: string | null;
  status: ValidityStatus;
  outreach_at: string | null;
  outreach_method: string | null;
  supplier_response: string | null;
  supplier_responded_at: string | null;
  management_decision: string | null;
  management_decided_by: string | null;
  management_decided_at: string | null;
  new_valid_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = 'supplier-quote-validity';

export function useSupplierQuoteValidity(filters?: {
  quoteId?: string;
  status?: ValidityStatus | 'all';
}) {
  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: async (): Promise<SupplierQuoteValidityRecord[]> => {
      let q = supabase
        .from('supplier_quote_validity')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.quoteId) q = q.eq('supplier_quote_id', filters.quoteId);
      if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as SupplierQuoteValidityRecord[];
    },
  });
}

export function useCreateValidityRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      supplier_quote_id: string;
      status: ValidityStatus;
      outreach_at?: string;
      outreach_method?: string;
      renegotiation_case_id?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('supplier_quote_validity')
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Validity record created');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

export function useUpdateValidityRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      status?: ValidityStatus;
      outreach_at?: string;
      outreach_method?: string;
      supplier_response?: string;
      supplier_responded_at?: string;
      management_decision?: string;
      management_decided_by?: string;
      management_decided_at?: string;
      new_valid_until?: string;
      notes?: string;
      renegotiation_case_id?: string;
    }) => {
      const { data, error } = await supabase
        .from('supplier_quote_validity')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Validity record updated');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

// ── Derived validity UI labels ──
export type DerivedValidityLabel =
  | 'active'
  | 'expiring_soon'
  | 'awaiting_supplier'
  | 'supplier_changed'
  | 'awaiting_management'
  | 'expired';

/**
 * Maps DB status → UI label.
 *
 * DB status           → UI label
 * active              → active (or date-based)
 * expiring_soon       → expiring_soon
 * outreach_sent       → awaiting_supplier
 * supplier_confirmed  → awaiting_management
 * supplier_changed    → supplier_changed
 * management_approved → date-based (active / expiring_soon / expired)
 * expired             → expired
 */
export function deriveValidityLabel(
  validUntil: string | null,
  latestRecord?: SupplierQuoteValidityRecord | null,
): DerivedValidityLabel {
  if (latestRecord) {
    switch (latestRecord.status) {
      case 'outreach_sent':
        return 'awaiting_supplier';
      case 'supplier_changed':
        return 'supplier_changed';
      case 'supplier_confirmed':
        return 'awaiting_management';
      case 'management_approved':
        // Fall through to date-based using new_valid_until if set
        break;
      case 'expired':
        return 'expired';
      case 'expiring_soon':
        return 'expiring_soon';
      case 'active':
        // Fall through to date-based
        break;
    }
  }

  // Date-based derivation
  const effectiveDate = latestRecord?.new_valid_until || validUntil;
  if (!effectiveDate) return 'active';

  const now = new Date();
  const expiry = new Date(effectiveDate);
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry <= 0) return 'expired';
  if (daysUntilExpiry <= 14) return 'expiring_soon';
  return 'active';
}
