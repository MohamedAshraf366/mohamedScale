import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Renegotiation {
  id: string;
  objection_id: string | null;
  material_id: string;
  supplier_id: string | null;
  current_price: number | null;
  sales_suggested_price: number | null;
  supply_head_target: number | null;
  management_approved_target: number | null;
  approval_status: 'pending_supply_head' | 'pending_management' | 'approved' | 'rejected' | 'active';
  scheduled_date: string | null;
  supply_head_notes: string | null;
  management_notes: string | null;
  rejection_reason: string | null;
  requested_by: string | null;
  supply_head_reviewed_by: string | null;
  supply_head_reviewed_at: string | null;
  management_reviewed_by: string | null;
  management_reviewed_at: string | null;
  final_agreed_price: number | null;
  renegotiation_status: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  materials?: { id: string; name: string; category: string; scale_price: number | null } | null;
  suppliers?: { id: string; name: string; rating: number | null } | null;
  communication_log?: { 
    id: string; 
    company_name: string | null; 
    person_name: string | null;
    notes: string | null;
    objection_type: string | null;
  } | null;
}

export const useRenegotiations = (statusFilter?: 'pending_supply_head' | 'pending_management' | 'approved' | 'rejected' | 'active') => {
  return useQuery({
    queryKey: ['renegotiations', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('material_renegotiations')
        .select(`
          *,
          materials:material_id(id, name, category, scale_price),
          suppliers:supplier_id(id, name, rating),
          communication_log:objection_id(id, company_name, person_name, notes, objection_type)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('approval_status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Renegotiation[];
    },
  });
};

export const usePendingObjections = () => {
  return useQuery({
    queryKey: ['pending-objections'],
    queryFn: async () => {
      // Get communications with objection_type that don't have renegotiations yet
      const { data: existingRenegotiations } = await supabase
        .from('material_renegotiations')
        .select('objection_id');

      const existingIds = existingRenegotiations?.map(r => r.objection_id).filter(Boolean) || [];

      let query = supabase
        .from('communication_log')
        .select(`
          id,
          company_name,
          person_name,
          contact_info,
          notes,
          objection_type,
          related_material_id,
          related_supplier_id,
          unit_price,
          created_at,
          materials:related_material_id(id, name, category, scale_price),
          suppliers:related_supplier_id(id, name, rating)
        `)
        .not('objection_type', 'is', null)
        .order('created_at', { ascending: false });

      if (existingIds.length > 0) {
        query = query.not('id', 'in', `(${existingIds.join(',')})`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  });
};

export const useSupplierPerformance = (supplierId: string | null) => {
  return useQuery({
    queryKey: ['supplier-performance', supplierId],
    queryFn: async () => {
      if (!supplierId) return null;

      // Get supplier materials for performance data
      const { data: supplierMaterials, error } = await supabase
        .from('supplier_materials')
        .select('performance_rating, delivery_reliability, quality_score, total_orders')
        .eq('supplier_id', supplierId);

      if (error) throw error;

      // Calculate price consistency from price history
      const { data: priceHistory } = await supabase
        .from('material_price_history')
        .select('unit_price')
        .eq('supplier_id', supplierId)
        .order('recorded_at', { ascending: false })
        .limit(10);

      let priceConsistencyIndex = 100;
      if (priceHistory && priceHistory.length > 1) {
        const prices = priceHistory.map(p => p.unit_price).filter(Boolean) as number[];
        if (prices.length > 1) {
          const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
          const variance = prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / prices.length;
          const stdDev = Math.sqrt(variance);
          priceConsistencyIndex = Math.max(0, Math.round(100 - (stdDev / avg) * 100));
        }
      }

      // Average the performance metrics
      const avgPerformance = supplierMaterials?.length
        ? supplierMaterials.reduce((sum, sm) => sum + (sm.performance_rating || 0), 0) / supplierMaterials.length
        : null;

      return {
        performanceRating: avgPerformance,
        priceConsistencyIndex,
        totalOrders: supplierMaterials?.reduce((sum, sm) => sum + (sm.total_orders || 0), 0) || 0,
      };
    },
    enabled: !!supplierId,
  });
};

export const useCreateRenegotiation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      objection_id?: string;
      material_id: string;
      supplier_id?: string;
      current_price?: number;
      sales_suggested_price?: number;
    }) => {
      const { data: result, error } = await supabase
        .from('material_renegotiations')
        .insert({
          objection_id: data.objection_id || null,
          material_id: data.material_id,
          supplier_id: data.supplier_id || null,
          current_price: data.current_price || null,
          sales_suggested_price: data.sales_suggested_price || null,
          approval_status: 'pending_supply_head',
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['renegotiations'] });
      queryClient.invalidateQueries({ queryKey: ['pending-objections'] });
      toast.success('Renegotiation request created');
    },
    onError: (error) => {
      toast.error('Failed to create renegotiation: ' + error.message);
    },
  });
};

export const useSupplyHeadReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      supply_head_target: number;
      scheduled_date: string;
      supply_head_notes?: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();

      const { data: result, error } = await supabase
        .from('material_renegotiations')
        .update({
          supply_head_target: data.supply_head_target,
          scheduled_date: data.scheduled_date,
          supply_head_notes: data.supply_head_notes || null,
          supply_head_reviewed_by: user.user?.id,
          supply_head_reviewed_at: new Date().toISOString(),
          approval_status: 'pending_management',
        })
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['renegotiations'] });
      toast.success('Submitted to management for approval');
    },
    onError: (error) => {
      toast.error('Failed to submit: ' + error.message);
    },
  });
};

export const useManagementApproval = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      approved: boolean;
      management_approved_target?: number;
      management_notes?: string;
      rejection_reason?: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();

      const updateData: Record<string, unknown> = {
        management_reviewed_by: user.user?.id,
        management_reviewed_at: new Date().toISOString(),
        management_notes: data.management_notes || null,
      };

      if (data.approved) {
        updateData.approval_status = 'approved';
        updateData.management_approved_target = data.management_approved_target;
      } else {
        updateData.approval_status = 'rejected';
        updateData.rejection_reason = data.rejection_reason;
      }

      const { data: result, error } = await supabase
        .from('material_renegotiations')
        .update(updateData)
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['renegotiations'] });
      toast.success(variables.approved ? 'Renegotiation approved' : 'Renegotiation rejected');
    },
    onError: (error) => {
      toast.error('Failed to process: ' + error.message);
    },
  });
};

export const useUpdateRenegotiationStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      renegotiation_status: string;
      final_agreed_price?: number;
    }) => {
      const updateData: Record<string, unknown> = {
        renegotiation_status: data.renegotiation_status,
      };

      if (data.final_agreed_price !== undefined) {
        updateData.final_agreed_price = data.final_agreed_price;
      }

      if (data.renegotiation_status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { data: result, error } = await supabase
        .from('material_renegotiations')
        .update(updateData)
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['renegotiations'] });
      toast.success('Status updated');
    },
    onError: (error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });
};
