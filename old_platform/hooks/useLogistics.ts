import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Shipment {
  id: string;
  shipment_code: string | null;
  supplier_id: string | null;
  client_name: string;
  origin: string;
  destination: string;
  items_description: string | null;
  status: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  scheduled_departure: string | null;
  scheduled_arrival: string | null;
  actual_departure: string | null;
  actual_arrival: string | null;
  delivery_status: 'on_time' | 'slightly_delayed' | 'critically_delayed' | null;
  delay_minutes: number;
  vehicle_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  progress_percent: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  supplier?: {
    id: string;
    name: string;
    is_at_risk: boolean | null;
    consecutive_on_time_count: number | null;
  } | null;
}

export interface SupplierIssue {
  id: string;
  supplier_id: string;
  shipment_id: string | null;
  issue_type: 'critically_delayed' | 'quality_issue' | 'pricing_issue' | 'communication_issue';
  severity: 'minor' | 'major' | 'critical';
  description: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  supplier?: {
    id: string;
    name: string;
  } | null;
}

export type DeliveryStatusTier = 'on_time' | 'slightly_delayed' | 'critically_delayed';

export const getDeliveryStatusColor = (status: DeliveryStatusTier | null) => {
  switch (status) {
    case 'on_time':
      return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'slightly_delayed':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'critically_delayed':
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export const getDeliveryStatusLabel = (status: DeliveryStatusTier | null) => {
  switch (status) {
    case 'on_time':
      return 'On Time';
    case 'slightly_delayed':
      return 'Slightly Delayed';
    case 'critically_delayed':
      return 'Critically Delayed';
    default:
      return 'Pending';
  }
};

export const getRowBackgroundColor = (status: DeliveryStatusTier | null, isDelivered: boolean) => {
  if (!isDelivered) return '';
  switch (status) {
    case 'on_time':
      return 'bg-green-50 dark:bg-green-950/20';
    case 'slightly_delayed':
      return 'bg-amber-50 dark:bg-amber-950/20';
    case 'critically_delayed':
      return 'bg-red-50 dark:bg-red-950/20';
    default:
      return '';
  }
};

export const useShipments = () => {
  return useQuery({
    queryKey: ['shipments'],
    queryFn: async (): Promise<Shipment[]> => {
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          supplier:suppliers(id, name, is_at_risk, consecutive_on_time_count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Shipment[];
    },
  });
};

export const useSupplierIssues = (supplierId?: string) => {
  return useQuery({
    queryKey: ['supplier-issues', supplierId],
    queryFn: async (): Promise<SupplierIssue[]> => {
      let query = supabase
        .from('supplier_issues')
        .select(`
          *,
          supplier:suppliers(id, name)
        `)
        .order('created_at', { ascending: false });

      if (supplierId) {
        query = query.eq('supplier_id', supplierId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as SupplierIssue[];
    },
  });
};

export const useAtRiskSuppliers = () => {
  return useQuery({
    queryKey: ['at-risk-suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, is_at_risk, at_risk_since, consecutive_on_time_count, rating')
        .eq('is_at_risk', true);

      if (error) throw error;
      return data || [];
    },
  });
};

export const useCreateShipment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shipment: Partial<Shipment>) => {
      const { data, error } = await supabase
        .from('shipments')
        .insert(shipment as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      toast.success('Shipment created successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to create shipment: ' + error.message);
    },
  });
};

export const useUpdateShipment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Shipment> & { id: string }) => {
      const { data, error } = await supabase
        .from('shipments')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-issues'] });
      queryClient.invalidateQueries({ queryKey: ['at-risk-suppliers'] });
      toast.success('Shipment updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update shipment: ' + error.message);
    },
  });
};

export const useMarkAsDelivered = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, actualArrival }: { id: string; actualArrival: Date }) => {
      const { data, error } = await supabase
        .from('shipments')
        .update({
          status: 'delivered',
          actual_arrival: actualArrival.toISOString(),
          progress_percent: 100,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-issues'] });
      queryClient.invalidateQueries({ queryKey: ['at-risk-suppliers'] });
      
      const deliveryStatus = (data as any).delivery_status;
      if (deliveryStatus === 'on_time') {
        toast.success('Shipment delivered on time!');
      } else if (deliveryStatus === 'slightly_delayed') {
        toast.warning('Shipment delivered with slight delay');
      } else if (deliveryStatus === 'critically_delayed') {
        toast.error('Shipment critically delayed - Supplier flagged as At Risk');
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to mark as delivered: ' + error.message);
    },
  });
};

export const useResolveIssue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (issueId: string) => {
      const { data, error } = await supabase
        .from('supplier_issues')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', issueId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-issues'] });
      toast.success('Issue resolved');
    },
    onError: (error: Error) => {
      toast.error('Failed to resolve issue: ' + error.message);
    },
  });
};
