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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, CreditCard, Truck } from 'lucide-react';

interface DeliveryConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    order_number: string;
    payment_status: string;
    clients?: { company_name: string } | null;
  } | null;
  onConfirm: (orderId: string, data: DeliveryConfirmationData) => void;
  isLoading?: boolean;
}

export interface DeliveryConfirmationData {
  client_confirmed: boolean;
  payment_status: string;
}

export const DeliveryConfirmationDialog = ({
  open,
  onOpenChange,
  order,
  onConfirm,
  isLoading = false,
}: DeliveryConfirmationDialogProps) => {
  const [clientConfirmed, setClientConfirmed] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('not_paid');

  // Sync payment status when dialog opens or order changes
  useEffect(() => {
    if (open && order) {
      setPaymentStatus(order.payment_status || 'not_paid');
      setClientConfirmed(false);
    }
  }, [open, order]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSubmit = () => {
    if (!order || !clientConfirmed) return;

    onConfirm(order.id, {
      client_confirmed: clientConfirmed,
      payment_status: paymentStatus,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Confirm Delivery
          </DialogTitle>
          <DialogDescription>
            Confirm delivery for order <span className="font-mono font-semibold">{order?.order_number}</span>
            {order?.clients?.company_name && (
              <span> - {order.clients.company_name}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Client Delivery Confirmation */}
          <div className="flex items-start space-x-3 p-4 rounded-lg border border-border bg-muted/30">
            <Checkbox
              id="client-confirmed"
              checked={clientConfirmed}
              onCheckedChange={(checked) => setClientConfirmed(checked === true)}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label
                htmlFor="client-confirmed"
                className="flex items-center gap-2 cursor-pointer font-medium"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Client Delivery Confirmation *
              </Label>
              <p className="text-xs text-muted-foreground">
                I confirm that the client has received and accepted the delivery
              </p>
            </div>
          </div>

          {/* Payment Status */}
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

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!clientConfirmed || isLoading}
            className="gap-2"
          >
            {isLoading ? (
              'Confirming...'
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirm Delivery
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
