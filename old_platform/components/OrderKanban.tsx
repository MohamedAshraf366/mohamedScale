import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, useDroppable, useDraggable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  MapPin, 
  Calendar, 
  Package,
  CreditCard,
  FileText,
  Truck,
  CheckCircle2,
  MoreVertical,
  Download,
  ExternalLink,
  GripVertical,
  User,
  Clock
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { UpdatePaymentDialog } from '@/components/UpdatePaymentDialog';
import { OrderConfirmationDialog } from '@/components/OrderConfirmationDialog';
import { DeliveryConfirmationDialog, DeliveryConfirmationData } from '@/components/DeliveryConfirmationDialog';
import { CloseOrderDialog, CloseOrderData } from '@/components/CloseOrderDialog';
import { ViewDealDialog } from '@/components/ViewDealDialog';
import { useNavigate } from 'react-router-dom';

interface Order {
  id: string;
  order_number: string;
  deal_id: string;
  status: string;
  payment_status: string;
  first_payment_proof_url: string | null;
  final_payment_proof_url: string | null;
  created_at: string;
  closed_at: string | null;
  closed_by_name: string | null;
  client_id: string;
  opportunity_id: string;
  clients?: { company_name: string; city?: string; district?: string; primary_contact_phone?: string } | null;
  projects?: { name: string; location?: string; city?: string; district?: string } | null;
  opportunities?: { name: string; expected_value: number | null; stage?: string } | null;
}

interface OrderMaterial {
  id: string;
  order_id: string;
  material_name: string;
  quantity: number | null;
  unit_price?: number | null;
}

interface OpportunityMaterial {
  id: string;
  opportunity_id: string;
  material_name: string;
  quantity: number | null;
}

interface OrderKanbanProps {
  orders: Order[];
  orderMaterials: OrderMaterial[];
  opportunityMaterials?: OpportunityMaterial[];
}

const ORDER_STATUSES = ['DRAFT', 'IN_PROGRESS', 'DELIVERED', 'CLOSED'] as const;

const STATUS_CONFIG = {
  DRAFT: { 
    label: 'Draft', 
    icon: FileText, 
    color: 'bg-muted text-muted-foreground',
    headerBg: 'bg-muted/50'
  },
  IN_PROGRESS: { 
    label: 'In Progress', 
    icon: Truck, 
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/25',
    headerBg: 'bg-amber-500/10'
  },
  DELIVERED: { 
    label: 'Delivered', 
    icon: Package, 
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25',
    headerBg: 'bg-emerald-500/10'
  },
  CLOSED: { 
    label: 'Closed', 
    icon: CheckCircle2, 
    color: 'bg-green-500/10 text-green-600 border-green-500/25',
    headerBg: 'bg-green-500/10'
  },
};

const getPaymentBadge = (status: string | null) => {
  switch (status) {
    case 'not_paid':
      return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 text-xs">Not Paid</Badge>;
    case 'first_payment_received':
      return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">1st Payment</Badge>;
    case 'payment_completed':
      return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">Paid</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">Unknown</Badge>;
  }
};

export const OrderKanban = ({ orders, orderMaterials, opportunityMaterials = [] }: OrderKanbanProps) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [pendingConfirmationOrder, setPendingConfirmationOrder] = useState<Order | null>(null);
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [pendingDeliveryOrder, setPendingDeliveryOrder] = useState<Order | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [pendingCloseOrder, setPendingCloseOrder] = useState<Order | null>(null);
  const [viewDealDialogOpen, setViewDealDialogOpen] = useState(false);
  const [viewDealOrder, setViewDealOrder] = useState<Order | null>(null);

  // Use pointer sensor with activation constraint to allow clicks on interactive elements
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before drag starts
      },
    })
  );

  // Get opportunity materials for an order (from Sales panel)
  const getOpportunityMaterialsForOrder = (order: Order) => {
    const opportunityId = (order as any).opportunity_id;
    if (!opportunityId) return [];
    return opportunityMaterials.filter(m => m.opportunity_id === opportunityId);
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus, confirmationData, deliveryData, closeData, closedByName }: { 
      orderId: string; 
      newStatus: string; 
      confirmationData?: any; 
      deliveryData?: DeliveryConfirmationData;
      closeData?: CloseOrderData;
      closedByName?: string;
    }) => {
      const updateData: any = { status: newStatus };
      
      // If we have confirmation data (DRAFT -> IN_PROGRESS), store it in notes and update payment status
      if (confirmationData) {
        const confirmationNote = `
Order Confirmed:
- Quantity: ${confirmationData.confirmed_quantity}
- Price: SAR ${confirmationData.confirmed_price}
- Delivery Location: ${confirmationData.delivery_location}
- Receiver Contact: ${confirmationData.receiver_contact}
- Supplier: ${confirmationData.supplier_name}
- Expected Delivery: ${confirmationData.expected_delivery_time}
- Driver: ${confirmationData.driver_number}
- Payment Status: ${confirmationData.payment_status}
        `.trim();
        updateData.notes = confirmationNote;
        // Update payment status from confirmation
        if (confirmationData.payment_status) {
          updateData.payment_status = confirmationData.payment_status;
        }
      }
      
      // If we have delivery data (IN_PROGRESS -> DELIVERED), update payment status
      if (deliveryData) {
        updateData.payment_status = deliveryData.payment_status;
        const deliveryNote = `
Delivery Confirmed:
- Payment Status: ${deliveryData.payment_status}
        `.trim();
        updateData.notes = updateData.notes ? `${updateData.notes}\n\n${deliveryNote}` : deliveryNote;
      }
      
      // If we have close data (DELIVERED -> CLOSED), store ratings, payment status, and audit info
      if (closeData) {
        updateData.payment_status = closeData.payment_status;
        updateData.closed_at = new Date().toISOString();
        updateData.closed_by_name = closedByName || 'Unknown';
        const closeNote = `
Order Closed:
=== Scale Evaluation ===
- Supplier Process: ${closeData.supplier_process_rating}/5
- Client Behavior: ${closeData.client_behavior_rating}/5
${closeData.scale_notes ? `- Notes: ${closeData.scale_notes}` : ''}

=== Client Perspective ===
- Quality: ${closeData.quality_rating}/5
- Delivery Time: ${closeData.delivery_time_rating}/5
- Price: ${closeData.price_rating}/5
        `.trim();
        updateData.notes = updateData.notes ? `${updateData.notes}\n\n${closeNote}` : closeNote;
      }
      
      const { error } = await supabase
        .from('operations_orders')
        .update(updateData)
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operations-orders'] });
      toast.success('Order status updated');
      setConfirmationDialogOpen(false);
      setPendingConfirmationOrder(null);
      setDeliveryDialogOpen(false);
      setPendingDeliveryOrder(null);
      setCloseDialogOpen(false);
      setPendingCloseOrder(null);
    },
    onError: () => {
      toast.error('Failed to update order status');
    },
  });

  const handleStatusChange = (order: Order, newStatus: string) => {
    // If moving from DRAFT to IN_PROGRESS, show confirmation dialog
    if (order.status === 'DRAFT' && newStatus === 'IN_PROGRESS') {
      setPendingConfirmationOrder(order);
      setConfirmationDialogOpen(true);
    // If moving from IN_PROGRESS to DELIVERED, show delivery confirmation dialog
    } else if (order.status === 'IN_PROGRESS' && newStatus === 'DELIVERED') {
      setPendingDeliveryOrder(order);
      setDeliveryDialogOpen(true);
    // If moving from DELIVERED to CLOSED, show close order dialog with ratings
    } else if (order.status === 'DELIVERED' && newStatus === 'CLOSED') {
      setPendingCloseOrder(order);
      setCloseDialogOpen(true);
    } else {
      updateStatusMutation.mutate({ orderId: order.id, newStatus });
    }
  };

  const handleConfirmOrder = (orderId: string, confirmationData: any) => {
    updateStatusMutation.mutate({ 
      orderId, 
      newStatus: 'IN_PROGRESS',
      confirmationData 
    });
  };

  const handleConfirmDelivery = (orderId: string, deliveryData: DeliveryConfirmationData) => {
    updateStatusMutation.mutate({ 
      orderId, 
      newStatus: 'DELIVERED',
      deliveryData 
    });
  };

  const handleCloseOrder = async (orderId: string, closeData: CloseOrderData) => {
    // Get current user's name for audit
    const { data: { user } } = await supabase.auth.getUser();
    let userName = 'Unknown';
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single();
      userName = profile?.full_name || profile?.email || user.email || 'Unknown';
    }

    updateStatusMutation.mutate({ 
      orderId, 
      newStatus: 'CLOSED',
      closeData,
      closedByName: userName 
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const order = orders.find(o => o.id === event.active.id);
    setActiveOrder(order || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveOrder(null);
    const { active, over } = event;
    
    if (!over) return;
    
    const orderId = active.id as string;
    const newStatus = over.id as string;
    
    const order = orders.find(o => o.id === orderId);
    if (order && order.status !== newStatus && ORDER_STATUSES.includes(newStatus as any)) {
      handleStatusChange(order, newStatus);
    }
  };

  const getMaterialsForOrder = (orderId: string) => {
    return orderMaterials?.filter(m => m.order_id === orderId) || [];
  };

  const getOrdersByStatus = (status: string) => {
    return orders.filter(o => o.status === status);
  };

  const handleUpdatePayment = (order: Order) => {
    setSelectedOrder(order);
    setPaymentDialogOpen(true);
  };

  const handleViewClient = (clientId: string) => {
    navigate(`/client-profile/${clientId}`);
  };

  const handleViewDeal = (order: Order) => {
    setViewDealOrder(order);
    setViewDealDialogOpen(true);
  };

  const DraggableOrderCard = ({ order }: { order: Order }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: order.id,
    });
    
    const style = transform ? {
      transform: CSS.Translate.toString(transform),
    } : undefined;

    const materials = getMaterialsForOrder(order.id);
    
    return (
      <div ref={setNodeRef} style={style}>
        <Card className={`scale-card mb-3 ${isDragging ? 'opacity-50 z-50' : ''}`}>
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            {/* Drag Handle */}
            <div 
              {...listeners} 
              {...attributes}
              className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-muted rounded"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-semibold text-sm">{order.order_number}</span>
                <Badge variant="outline" className="text-xs shrink-0">{order.deal_id}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {order.opportunities?.name || 'N/A'}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleViewClient(order.client_id)}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Client
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleViewDeal(order)}>
                  <FileText className="h-4 w-4 mr-2" />
                  View Deal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleUpdatePayment(order)}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Update Payment
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {ORDER_STATUSES.map(status => (
                  status !== order.status && (
                    <DropdownMenuItem 
                      key={status}
                      onClick={() => handleStatusChange(order, status)}
                    >
                      Move to {STATUS_CONFIG[status].label}
                    </DropdownMenuItem>
                  )
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Client & Project */}
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{order.clients?.company_name || 'Unknown Client'}</span>
            </div>
            {order.projects?.name && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{order.projects.name}</span>
              </div>
            )}
          </div>

          {/* Materials */}
          {materials.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {materials.slice(0, 2).map(mat => (
                <Badge key={mat.id} variant="secondary" className="text-xs">
                  {mat.material_name}
                </Badge>
              ))}
              {materials.length > 2 && (
                <Badge variant="secondary" className="text-xs">+{materials.length - 2}</Badge>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {format(new Date(order.created_at), 'MMM dd')}
            </div>
            <div className="flex items-center gap-2">
              {getPaymentBadge(order.payment_status)}
              {(order.first_payment_proof_url || order.final_payment_proof_url) && (
                <div className="flex gap-1">
                  {order.first_payment_proof_url && (
                    <a href={order.first_payment_proof_url} target="_blank" rel="noopener noreferrer" title="First Payment Proof">
                      <Download className="h-3.5 w-3.5 text-primary" />
                    </a>
                  )}
                  {order.final_payment_proof_url && (
                    <a href={order.final_payment_proof_url} target="_blank" rel="noopener noreferrer" title="Final Payment Proof">
                      <Download className="h-3.5 w-3.5 text-green-600" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Closed Audit Info */}
          {order.status === 'CLOSED' && order.closed_at && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 cursor-help">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    <span>Closed {format(new Date(order.closed_at), 'MMM dd, yyyy')}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      <span>{format(new Date(order.closed_at), 'MMM dd, yyyy HH:mm')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3" />
                      <span>By: {order.closed_by_name || 'Unknown'}</span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Value */}
          {order.opportunities?.expected_value && (
            <div className="text-right">
              <span className="text-sm font-semibold text-primary">
                SAR {order.opportunities.expected_value.toLocaleString()}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    );
  };

  const OrderCard = ({ order }: { order: Order }) => {
    const materials = getMaterialsForOrder(order.id);
    
    return (
      <Card className="scale-card mb-3">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-semibold text-sm">{order.order_number}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {order.opportunities?.name || 'N/A'}
              </p>
            </div>
          </div>
          {order.clients?.company_name && (
            <p className="text-sm">{order.clients.company_name}</p>
          )}
        </CardContent>
      </Card>
    );
  };

  const DroppableColumn = ({ status, children }: { status: string; children: React.ReactNode }) => {
    const { setNodeRef, isOver } = useDroppable({
      id: status,
    });
    
    return (
      <div 
        ref={setNodeRef}
        className={`min-h-[400px] bg-muted/30 rounded-b-lg p-3 border border-t-0 border-border/50 transition-colors ${isOver ? 'bg-primary/10 border-primary/30' : ''}`}
      >
        {children}
      </div>
    );
  };

  return (
    <>
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {ORDER_STATUSES.map(status => {
            const config = STATUS_CONFIG[status];
            const StatusIcon = config.icon;
            const statusOrders = getOrdersByStatus(status);
            
            return (
              <div key={status} className="flex flex-col">
                <Card className={`${config.headerBg} border-b-0 rounded-b-none`}>
                  <CardHeader className="p-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <StatusIcon className="h-4 w-4" />
                      {config.label}
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {statusOrders.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                </Card>
                
                <DroppableColumn status={status}>
                  {statusOrders.map(order => (
                    <DraggableOrderCard key={order.id} order={order} />
                  ))}
                  {statusOrders.length === 0 && (
                    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                      No orders
                    </div>
                  )}
                </DroppableColumn>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeOrder && <OrderCard order={activeOrder} />}
        </DragOverlay>
      </DndContext>

      <UpdatePaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        order={selectedOrder}
      />

      <OrderConfirmationDialog
        open={confirmationDialogOpen}
        onOpenChange={setConfirmationDialogOpen}
        order={pendingConfirmationOrder}
        materials={pendingConfirmationOrder ? getMaterialsForOrder(pendingConfirmationOrder.id) : []}
        onConfirm={handleConfirmOrder}
        isLoading={updateStatusMutation.isPending}
      />

      <DeliveryConfirmationDialog
        open={deliveryDialogOpen}
        onOpenChange={setDeliveryDialogOpen}
        order={pendingDeliveryOrder}
        onConfirm={handleConfirmDelivery}
        isLoading={updateStatusMutation.isPending}
      />

      <CloseOrderDialog
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        order={pendingCloseOrder}
        onConfirm={handleCloseOrder}
        isLoading={updateStatusMutation.isPending}
      />

      <ViewDealDialog
        open={viewDealDialogOpen}
        onOpenChange={setViewDealDialogOpen}
        order={viewDealOrder}
        materials={viewDealOrder ? getMaterialsForOrder(viewDealOrder.id) : []}
      />
    </>
  );
};
