import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';



export type IssueType = 'delay' | 'quality' | 'pricing' | 'communication' | 'documentation' | 'coverage' | 'validity' | 'other';
export type IssueSeverity = 'minor' | 'major' | 'critical';
export type IssueSource = 'manual' | 'auto';
export type IssueStatus = 'open' | 'investigating' | 'resolved' | 'escalated' | 'closed';

export interface SupplierIssue {
  id: string;
  supplier_account_id: string;
  material_id: string | null;
  supply_unit_id: string | null;
  issue_type: IssueType;
  severity: IssueSeverity;
  source: IssueSource;
  status: IssueStatus;
  description: string | null;
  reported_by: string | null;
  assigned_to: string | null;
  resolution_notes: string | null;
  final_outcome: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  supplier_name?: string | null;
}

const QUERY_KEY = 'supplier-issues';

export function useSupplierIssues(filters?: {
  supplierId?: string;
  status?: IssueStatus | 'all';
  severity?: IssueSeverity | 'all';
  issueType?: IssueType | 'all';
}) {

  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: async (): Promise<SupplierIssue[]> => {

      let q = supabase
        .from('supplier_issues')
        .select('*')
        
        .order('created_at', { ascending: false });

      if (filters?.supplierId) q = q.eq('supplier_account_id', filters.supplierId);
      if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
      if (filters?.severity && filters.severity !== 'all') q = q.eq('severity', filters.severity);
      if (filters?.issueType && filters.issueType !== 'all') q = q.eq('issue_type', filters.issueType);

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
        supplier_name: nameMap.get(r.supplier_account_id) || null,
      })) as SupplierIssue[];
    },
  });
}

export function useCreateSupplierIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      supplier_account_id: string;
      issue_type: IssueType;
      severity: IssueSeverity;
      description?: string;
      material_id?: string;
      supply_unit_id?: string;
      reported_by?: string;
      assigned_to?: string;
      source?: IssueSource;
    }) => {
      // Note: supplier_issues doesn't have is_example but is filtered via account join
      const { data, error } = await supabase
        .from('supplier_issues')
        .insert({ source: 'manual', ...input } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Issue reported');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}

export function useUpdateSupplierIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      status?: IssueStatus;
      assigned_to?: string | null;
      resolution_notes?: string | null;
      final_outcome?: string | null;
      resolved_at?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('supplier_issues')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Issue updated');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });
}
