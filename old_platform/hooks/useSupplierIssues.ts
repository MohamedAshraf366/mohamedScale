import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type IssueType = 'critically_delayed' | 'quality_issue' | 'pricing_issue' | 'communication_issue' | 'delay' | 'quality' | 'price_dispute' | 'other';
export type IssueSeverity = 'minor' | 'major' | 'critical';
export type IssueSource = 'auto_logistics' | 'manual_sales' | 'manual_ops';
export type IssueStatus = 'open' | 'in_investigation' | 'resolved' | 'escalated_to_renegotiation';

export type FinalOutcome = 'refund_issued' | 'replacement_sent' | 'warning_issued' | 'credit_note' | 'no_action' | 'other';

export interface SupplierIssue {
  id: string;
  supplier_id: string;
  shipment_id: string | null;
  material_id: string | null;
  issue_type: IssueType;
  severity: IssueSeverity;
  source: IssueSource;
  status: IssueStatus;
  description: string | null;
  order_reference: string | null;
  supplier_justification: string | null;
  resolution_notes: string | null;
  final_outcome: FinalOutcome | null;
  assigned_to: string | null;
  reported_by: string | null;
  reported_at: string | null;
  escalation_date: string | null;
  linked_renegotiation_id: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  attachments: string[] | null;
  // Joined data
  supplier?: {
    id: string;
    name: string;
    is_at_risk: boolean | null;
  } | null;
  material?: {
    id: string;
    name: string;
    category: string;
  } | null;
}

export interface CreateIssueInput {
  supplier_id: string;
  issue_type: IssueType;
  severity: IssueSeverity;
  source: IssueSource;
  description?: string;
  material_id?: string;
  shipment_id?: string;
  order_reference?: string;
  attachments?: string[];
}

export interface UpdateIssueInput {
  id: string;
  status?: IssueStatus;
  supplier_justification?: string;
  resolution_notes?: string;
  assigned_to?: string;
  is_resolved?: boolean;
}

// Fetch all supplier issues with joined data
export const useSupplierIssues = (filters?: {
  supplierId?: string;
  status?: IssueStatus;
  severity?: IssueSeverity;
  source?: IssueSource;
}) => {
  return useQuery({
    queryKey: ['supplier-issues', filters],
    queryFn: async (): Promise<SupplierIssue[]> => {
      let query = supabase
        .from('supplier_issues')
        .select(`
          *,
          supplier:suppliers(id, name, is_at_risk),
          material:materials(id, name, category)
        `)
        .order('created_at', { ascending: false });

      if (filters?.supplierId) {
        query = query.eq('supplier_id', filters.supplierId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.severity) {
        query = query.eq('severity', filters.severity);
      }
      if (filters?.source) {
        query = query.eq('source', filters.source);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as SupplierIssue[];
    },
  });
};

// Get issue stats for dashboard
export const useIssueStats = () => {
  return useQuery({
    queryKey: ['issue-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_issues')
        .select('status, severity, source');

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        open: data?.filter(i => i.status === 'open').length || 0,
        inInvestigation: data?.filter(i => i.status === 'in_investigation').length || 0,
        resolved: data?.filter(i => i.status === 'resolved').length || 0,
        escalated: data?.filter(i => i.status === 'escalated_to_renegotiation').length || 0,
        critical: data?.filter(i => i.severity === 'critical' && i.status !== 'resolved').length || 0,
        major: data?.filter(i => i.severity === 'major' && i.status !== 'resolved').length || 0,
        minor: data?.filter(i => i.severity === 'minor' && i.status !== 'resolved').length || 0,
        autoLogged: data?.filter(i => i.source === 'auto_logistics').length || 0,
        manualSales: data?.filter(i => i.source === 'manual_sales').length || 0,
        manualOps: data?.filter(i => i.source === 'manual_ops').length || 0,
      };

      return stats;
    },
  });
};

// Get suppliers with most issues
export const useSuppliersWithMostIssues = (limit = 5) => {
  return useQuery({
    queryKey: ['suppliers-most-issues', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_issues')
        .select(`
          supplier_id,
          status,
          severity,
          supplier:suppliers(id, name, is_at_risk)
        `)
        .neq('status', 'resolved');

      if (error) throw error;

      // Group by supplier
      const supplierMap = new Map<string, {
        id: string;
        name: string;
        is_at_risk: boolean;
        issueCount: number;
        criticalCount: number;
      }>();

      data?.forEach(issue => {
        if (issue.supplier) {
          const existing = supplierMap.get(issue.supplier_id);
          if (existing) {
            existing.issueCount++;
            if (issue.severity === 'critical') existing.criticalCount++;
          } else {
            supplierMap.set(issue.supplier_id, {
              id: issue.supplier.id,
              name: issue.supplier.name,
              is_at_risk: issue.supplier.is_at_risk || false,
              issueCount: 1,
              criticalCount: issue.severity === 'critical' ? 1 : 0,
            });
          }
        }
      });

      return Array.from(supplierMap.values())
        .sort((a, b) => b.issueCount - a.issueCount)
        .slice(0, limit);
    },
  });
};

// Create a new issue
export const useCreateIssue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateIssueInput) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('supplier_issues')
        .insert({
          supplier_id: input.supplier_id,
          issue_type: input.issue_type,
          severity: input.severity,
          source: input.source,
          description: input.description || null,
          material_id: input.material_id || null,
          shipment_id: input.shipment_id || null,
          order_reference: input.order_reference || null,
          attachments: input.attachments || [],
          status: 'open',
          reported_by: userData.user?.id || null,
          reported_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-issues'] });
      queryClient.invalidateQueries({ queryKey: ['issue-stats'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-most-issues'] });
      toast.success('Issue reported successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to report issue: ' + error.message);
    },
  });
};

// Update an issue
export const useUpdateIssue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateIssueInput) => {
      const { id, ...updates } = input;
      
      // If resolving, add resolved_at and resolved_by
      if (updates.is_resolved || updates.status === 'resolved') {
        const { data: userData } = await supabase.auth.getUser();
        (updates as any).resolved_at = new Date().toISOString();
        (updates as any).resolved_by = userData.user?.id;
        (updates as any).is_resolved = true;
        (updates as any).status = 'resolved';
      }

      const { data, error } = await supabase
        .from('supplier_issues')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-issues'] });
      queryClient.invalidateQueries({ queryKey: ['issue-stats'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-most-issues'] });
      toast.success('Issue updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update issue: ' + error.message);
    },
  });
};

// Resolve an issue (requires justification for critical issues AND final outcome)
export const useResolveIssue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      supplierJustification, 
      resolutionNotes,
      finalOutcome,
      severity 
    }: { 
      id: string; 
      supplierJustification?: string; 
      resolutionNotes?: string;
      finalOutcome: FinalOutcome;
      severity: IssueSeverity;
    }) => {
      // Validate that critical issues have justification
      if (severity === 'critical' && !supplierJustification?.trim()) {
        throw new Error('Critical issues require supplier justification before resolution');
      }

      // Final outcome is always required
      if (!finalOutcome) {
        throw new Error('Final outcome is required before resolution');
      }

      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('supplier_issues')
        .update({
          status: 'resolved',
          is_resolved: true,
          supplier_justification: supplierJustification || null,
          resolution_notes: resolutionNotes || null,
          final_outcome: finalOutcome,
          resolved_at: new Date().toISOString(),
          resolved_by: userData.user?.id,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-issues'] });
      queryClient.invalidateQueries({ queryKey: ['issue-stats'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-most-issues'] });
      toast.success('Issue resolved successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};

// Helper functions for display
export const getIssueTypeLabel = (type: IssueType): string => {
  const labels: Record<IssueType, string> = {
    critically_delayed: 'Critically Delayed',
    quality_issue: 'Quality Issue',
    pricing_issue: 'Pricing Issue',
    communication_issue: 'Communication Issue',
    delay: 'Delay',
    quality: 'Quality',
    price_dispute: 'Price Dispute',
    other: 'Other',
  };
  return labels[type] || type;
};

export const getSeverityColor = (severity: IssueSeverity): string => {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    case 'major':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'minor':
      return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export const getStatusColor = (status: IssueStatus): string => {
  switch (status) {
    case 'open':
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    case 'in_investigation':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'resolved':
      return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'escalated_to_renegotiation':
      return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export const getStatusLabel = (status: IssueStatus): string => {
  const labels: Record<IssueStatus, string> = {
    open: 'Open',
    in_investigation: 'In Investigation',
    resolved: 'Resolved',
    escalated_to_renegotiation: 'Escalated',
  };
  return labels[status] || status;
};

export const getSourceLabel = (source: IssueSource): string => {
  const labels: Record<IssueSource, string> = {
    auto_logistics: 'Auto (Logistics)',
    manual_sales: 'Sales Team',
    manual_ops: 'Operations',
  };
  return labels[source] || source;
};

export const getFinalOutcomeLabel = (outcome: FinalOutcome): string => {
  const labels: Record<FinalOutcome, string> = {
    refund_issued: 'Refund Issued',
    replacement_sent: 'Replacement Sent',
    warning_issued: 'Warning Issued',
    credit_note: 'Credit Note',
    no_action: 'No Action Taken',
    other: 'Other',
  };
  return labels[outcome] || outcome;
};

export const getIssueAge = (createdAt: string): { days: number; hours: number; label: string } => {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;
  
  let label = '';
  if (diffDays > 0) {
    label = `${diffDays}d ${remainingHours}h`;
  } else {
    label = `${diffHours}h`;
  }
  
  return { days: diffDays, hours: diffHours, label };
};
