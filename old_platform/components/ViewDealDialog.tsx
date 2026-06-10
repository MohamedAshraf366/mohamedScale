import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Building2, MapPin, Calendar, Package, CreditCard, FileText, User } from 'lucide-react';
import { format } from 'date-fns';

interface Order {
  id: string;
  order_number: string;
  deal_id: string;
  status: string;
  payment_status: string;
  first_payment_proof_url: string | null;
  final_payment_proof_url: string | null;
  created_at: string;
  notes?: string | null;
  client_id: string;
  clients?: { company_name: string; city?: string; district?: string } | null;
  projects?: { name: string; location?: string } | null;
  opportunities?: { name: string; expected_value: number | null; stage?: string } | null;
}

interface OrderMaterial {
  id: string;
  order_id: string;
  material_name: string;
  quantity: number | null;
}

interface ViewDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  materials: OrderMaterial[];
}

const getPaymentStatusLabel = (status: string | null) => {
  switch (status) {
    case 'not_paid':
      return { label: 'Not Paid', className: 'bg-red-500/10 text-red-600 border-red-500/30' };
    case 'first_payment_received':
      return { label: 'First Payment Received', className: 'bg-amber-500/10 text-amber-600 border-amber-500/30' };
    case 'payment_completed':
      return { label: 'Payment Completed', className: 'bg-green-500/10 text-green-600 border-green-500/30' };
    default:
      return { label: 'Unknown', className: '' };
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'DRAFT':
      return { label: 'Draft', className: 'bg-muted text-muted-foreground' };
    case 'IN_PROGRESS':
      return { label: 'In Progress', className: 'bg-amber-500/10 text-amber-600 border-amber-500/30' };
    case 'DELIVERED':
      return { label: 'Delivered', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' };
    case 'CLOSED':
      return { label: 'Closed', className: 'bg-green-500/10 text-green-600 border-green-500/30' };
    default:
      return { label: status, className: '' };
  }
};

export function ViewDealDialog({ open, onOpenChange, order, materials }: ViewDealDialogProps) {
  if (!order) return null;

  const paymentStatus = getPaymentStatusLabel(order.payment_status);
  const orderStatus = getStatusLabel(order.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Deal Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Order Info */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono font-semibold text-lg">{order.order_number}</span>
              <Badge variant="outline" className={orderStatus.className}>
                {orderStatus.label}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Deal ID: <span className="font-medium text-foreground">{order.deal_id}</span>
            </div>
          </section>

          {/* Client & Project */}
          <section className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Client & Project</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{order.clients?.company_name || 'Unknown Client'}</span>
              </div>
              {order.clients?.city && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>{order.clients.city}{order.clients.district ? `, ${order.clients.district}` : ''}</span>
                </div>
              )}
              {order.projects?.name && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4 shrink-0" />
                  <span>{order.projects.name}</span>
                </div>
              )}
              {order.opportunities?.name && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4 shrink-0" />
                  <span>{order.opportunities.name}</span>
                </div>
              )}
            </div>
          </section>

          {/* Materials */}
          {materials.length > 0 && (
            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Materials</h4>
              <div className="space-y-2">
                {materials.map(mat => (
                  <div key={mat.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <span className="text-sm">{mat.material_name}</span>
                    {mat.quantity && (
                      <Badge variant="secondary" className="text-xs">
                        Qty: {mat.quantity}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Payment & Value */}
          <section className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Payment</h4>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Payment Status</span>
              </div>
              <Badge variant="outline" className={paymentStatus.className}>
                {paymentStatus.label}
              </Badge>
            </div>
            {order.opportunities?.expected_value && (
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <span className="text-sm text-muted-foreground">Expected Value</span>
                <span className="text-lg font-semibold text-primary">
                  SAR {order.opportunities.expected_value.toLocaleString()}
                </span>
              </div>
            )}
          </section>

          {/* Dates */}
          <section className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Created: {format(new Date(order.created_at), 'PPP')}</span>
          </section>

          {/* Notes */}
          {order.notes && (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Notes</h4>
              <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-lg">{order.notes}</p>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
