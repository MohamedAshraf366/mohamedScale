import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Star, CheckCircle2, Users, Truck, DollarSign, Clock, Package, Building2, CreditCard, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CloseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    order_number: string;
    payment_status: string;
    clients?: { company_name: string } | null;
  } | null;
  onConfirm: (orderId: string, data: CloseOrderData) => void;
  isLoading?: boolean;
}

export interface CloseOrderData {
  // Payment
  payment_status: string;
  // Scale Side (Internal Evaluation)
  supplier_process_rating: number;
  client_behavior_rating: number;
  scale_notes: string;
  // Client Perspective
  quality_rating: number;
  delivery_time_rating: number;
  price_rating: number;
}
const StarRating = ({
  value,
  onChange,
  label,
  icon: Icon,
}: {
  value: number;
  onChange: (rating: number) => void;
  label: string;
  icon: React.ElementType;
}) => {
  const [hoveredRating, setHoveredRating] = useState(0);

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </Label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
            onMouseEnter={() => setHoveredRating(rating)}
            onMouseLeave={() => setHoveredRating(0)}
            className="p-0.5 transition-transform hover:scale-110 focus:outline-none"
          >
            <Star
              className={cn(
                'h-5 w-5 transition-colors',
                (hoveredRating || value) >= rating
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-muted-foreground/40'
              )}
            />
          </button>
        ))}
        {value > 0 && (
          <span className="ml-2 text-xs text-muted-foreground">
            {value}/5
          </span>
        )}
      </div>
    </div>
  );
};

export const CloseOrderDialog = ({
  open,
  onOpenChange,
  order,
  onConfirm,
  isLoading = false,
}: CloseOrderDialogProps) => {
  // Payment status
  const [paymentStatus, setPaymentStatus] = useState('not_paid');
  
  // Scale Side (Internal Evaluation)
  const [supplierProcessRating, setSupplierProcessRating] = useState(0);
  const [clientBehaviorRating, setClientBehaviorRating] = useState(0);
  const [scaleNotes, setScaleNotes] = useState('');
  
  // Client Perspective
  const [qualityRating, setQualityRating] = useState(0);
  const [deliveryTimeRating, setDeliveryTimeRating] = useState(0);
  const [priceRating, setPriceRating] = useState(0);

  // Reset state when dialog opens
  useEffect(() => {
    if (open && order) {
      setPaymentStatus(order.payment_status || 'not_paid');
      setSupplierProcessRating(0);
      setClientBehaviorRating(0);
      setScaleNotes('');
      setQualityRating(0);
      setDeliveryTimeRating(0);
      setPriceRating(0);
    }
  }, [open, order]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSubmit = () => {
    if (!order) return;

    onConfirm(order.id, {
      payment_status: paymentStatus,
      supplier_process_rating: supplierProcessRating,
      client_behavior_rating: clientBehaviorRating,
      scale_notes: scaleNotes,
      quality_rating: qualityRating,
      delivery_time_rating: deliveryTimeRating,
      price_rating: priceRating,
    });
  };

  // Check payment status - now based on the editable state
  const isPaid = paymentStatus === 'payment_completed';

  // Check if at least one rating is provided from each side AND payment is completed
  const isValid = isPaid && 
    (supplierProcessRating > 0 || clientBehaviorRating > 0) && 
    (qualityRating > 0 || deliveryTimeRating > 0 || priceRating > 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Close Order
          </DialogTitle>
          <DialogDescription>
            Close order <span className="font-mono font-semibold">{order?.order_number}</span>
            {order?.clients?.company_name && (
              <span> - {order.clients.company_name}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-2">
          {/* Payment Status */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payment Status
              </Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment status" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="not_paid">Not Paid</SelectItem>
                  <SelectItem value="first_payment_received">First Payment Received</SelectItem>
                  <SelectItem value="payment_completed">Payment Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {!isPaid && (
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Payment must be completed before closing the order.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Separator />

          {/* Scale Side - Internal Evaluation */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="font-medium text-sm">Scale Evaluation</h3>
              <span className="text-xs text-muted-foreground">(Internal)</span>
            </div>
            
            <div className="space-y-4 pl-6">
              <StarRating
                value={supplierProcessRating}
                onChange={setSupplierProcessRating}
                label="Supplier Process"
                icon={Truck}
              />
              
              <StarRating
                value={clientBehaviorRating}
                onChange={setClientBehaviorRating}
                label="Client (Payment, Attitude)"
                icon={Users}
              />
              
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">
                  Notes (Optional)
                </Label>
                <Textarea
                  value={scaleNotes}
                  onChange={(e) => setScaleNotes(e.target.value)}
                  placeholder="Any internal notes about this order..."
                  className="min-h-[60px] text-sm"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Client Perspective */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="font-medium text-sm">Client Perspective</h3>
              <span className="text-xs text-muted-foreground">(From client feedback)</span>
            </div>
            
            <div className="space-y-4 pl-6">
              <StarRating
                value={qualityRating}
                onChange={setQualityRating}
                label="Quality"
                icon={Package}
              />
              
              <StarRating
                value={deliveryTimeRating}
                onChange={setDeliveryTimeRating}
                label="Delivery Time"
                icon={Clock}
              />
              
              <StarRating
                value={priceRating}
                onChange={setPriceRating}
                label="Price"
                icon={DollarSign}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            className="gap-2"
          >
            {isLoading ? (
              'Closing...'
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Close Order
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
