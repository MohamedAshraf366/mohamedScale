import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface OpportunityMaterial {
  material_name: string;
  quantity: number | null;
  unit_price: number | null;
  expected_delivery_date: string | null;
  pricing_type: string;
  notes: string | null;
}

interface ConvertToDealInput {
  opportunityId: string;
  clientId: string;
  projectId: string;
  materials: OpportunityMaterial[];
  paymentStatus?: 'not_paid' | 'first_payment_received' | 'payment_completed';
  firstPaymentProofUrl?: string | null;
  finalPaymentProofUrl?: string | null;
}

export const useConvertToDeal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      opportunityId, 
      clientId, 
      projectId, 
      materials,
      paymentStatus = 'not_paid',
      firstPaymentProofUrl,
      finalPaymentProofUrl,
    }: ConvertToDealInput) => {
      // 1. Generate Deal ID
      const { data: dealIdResult, error: dealIdError } = await supabase
        .rpc('generate_deal_id');
      
      if (dealIdError) throw dealIdError;
      const dealId = dealIdResult as string;

      // 2. Update Opportunity: mark as deal, set stage to Closed (won), lock it
      const { error: updateError } = await supabase
        .from('opportunities')
        .update({
          is_deal: true,
          deal_id: dealId,
          stage: 'Closed',
          is_closed: true,
          won: true,
          is_locked: true,
          converted_to_deal_at: new Date().toISOString(),
        })
        .eq('id', opportunityId);

      if (updateError) throw updateError;

      // 3. Generate Order Number
      const { data: orderNumberResult, error: orderNumberError } = await supabase
        .rpc('generate_order_number');
      
      if (orderNumberError) throw orderNumberError;
      const orderNumber = orderNumberResult as string;

      // 4. Create Operations Order in DRAFT status with payment info
      const { data: user } = await supabase.auth.getUser();
      
      const { data: operationsOrder, error: orderError } = await supabase
        .from('operations_orders')
        .insert({
          order_number: orderNumber,
          client_id: clientId,
          project_id: projectId,
          opportunity_id: opportunityId,
          deal_id: dealId,
          status: 'DRAFT',
          created_by: user?.user?.id,
          payment_status: paymentStatus,
          first_payment_proof_url: firstPaymentProofUrl,
          final_payment_proof_url: finalPaymentProofUrl,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 5. Copy materials to operations_order_materials with prices
      if (materials.length > 0) {
        const orderMaterials = materials.map(m => ({
          order_id: operationsOrder.id,
          material_name: m.material_name,
          quantity: m.quantity,
          unit_price: m.unit_price,
          expected_delivery_date: m.expected_delivery_date,
          pricing_type: m.pricing_type,
          notes: m.notes,
        }));

        const { error: materialsError } = await supabase
          .from('operations_order_materials')
          .insert(orderMaterials);

        if (materialsError) throw materialsError;
      }

      // 6. Create system task for Operations handover
      const { error: taskError } = await supabase
        .from('system_tasks')
        .insert({
          task_type: 'order_review',
          title: 'Review New Order',
          description: `New order ${orderNumber} from Deal ${dealId} has been handed over from Sales. Please review and process.`,
          related_entity_type: 'operations_order',
          related_entity_id: operationsOrder.id,
          assigned_to_role: 'operations',
          status: 'pending',
        });

      if (taskError) throw taskError;

      return { dealId, orderNumber, operationsOrderId: operationsOrder.id };
    },
    onSuccess: (data) => {
      toast({
        title: 'Converted to Deal',
        description: `Deal ${data.dealId} created. Order ${data.orderNumber} handed over to Operations.`,
      });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['operations-orders'] });
      queryClient.invalidateQueries({ queryKey: ['system-tasks'] });
    },
    onError: (error) => {
      console.error('Error converting to deal:', error);
      toast({
        title: 'Error',
        description: 'Failed to convert opportunity to deal.',
        variant: 'destructive',
      });
    },
  });
};

export const useOperationsOrders = (clientId?: string) => {
  const queryClient = useQueryClient();

  const fetchOrders = async () => {
    let query = supabase
      .from('operations_orders')
      .select(`
        *,
        clients(company_name),
        projects(name),
        opportunities(name, deal_id)
      `)
      .order('created_at', { ascending: false });

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  };

  return {
    queryKey: ['operations-orders', clientId],
    queryFn: fetchOrders,
  };
};
