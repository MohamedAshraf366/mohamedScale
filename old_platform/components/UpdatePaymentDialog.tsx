import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { 
  CreditCard, 
  FileText, 
  Upload, 
  X, 
  Building2,
  Package,
  Download,
  Lock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type PaymentStatus = 'not_paid' | 'first_payment_received' | 'payment_completed';

interface Order {
  id: string;
  order_number: string;
  deal_id: string;
  payment_status: string;
  first_payment_proof_url: string | null;
  final_payment_proof_url: string | null;
  clients?: { company_name: string } | null;
  opportunities?: { name: string; expected_value: number | null } | null;
}

interface UpdatePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  onSuccess?: () => void;
}

export const UpdatePaymentDialog = ({
  open,
  onOpenChange,
  order,
  onSuccess,
}: UpdatePaymentDialogProps) => {
  const queryClient = useQueryClient();
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('not_paid');
  const [firstPaymentProof, setFirstPaymentProof] = useState<File | null>(null);
  const [finalPaymentProof, setFinalPaymentProof] = useState<File | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const firstPaymentInputRef = useRef<HTMLInputElement>(null);
  const finalPaymentInputRef = useRef<HTMLInputElement>(null);

  // Initialize state from order when dialog opens
  useEffect(() => {
    if (order && open) {
      setPaymentStatus((order.payment_status as PaymentStatus) || 'not_paid');
      setFirstPaymentProof(null);
      setFinalPaymentProof(null);
    }
  }, [order, open]);

  const uploadPaymentProof = async (file: File, type: 'first' | 'final'): Promise<string | null> => {
    if (!order) return null;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${order.id}-${type}-${Date.now()}.${fileExt}`;
    const filePath = `payment-proofs/${fileName}`;

    const { error } = await supabase.storage
      .from('project-documents')
      .upload(filePath, file);

    if (error) {
      console.error('Error uploading payment proof:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('project-documents')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  const updatePaymentMutation = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error('No order selected');

      let firstPaymentProofUrl = order.first_payment_proof_url;
      let finalPaymentProofUrl = order.final_payment_proof_url;

      // Upload new proofs if provided
      if (firstPaymentProof) {
        const url = await uploadPaymentProof(firstPaymentProof, 'first');
        if (url) firstPaymentProofUrl = url;
      }
      if (finalPaymentProof && paymentStatus === 'payment_completed') {
        const url = await uploadPaymentProof(finalPaymentProof, 'final');
        if (url) finalPaymentProofUrl = url;
      }

      const { error } = await supabase
        .from('operations_orders')
        .update({
          payment_status: paymentStatus,
          first_payment_proof_url: firstPaymentProofUrl,
          final_payment_proof_url: finalPaymentProofUrl,
        })
        .eq('id', order.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Payment status updated successfully');
      queryClient.invalidateQueries({ queryKey: ['operations-orders'] });
      queryClient.invalidateQueries({ queryKey: ['client-deals'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Error updating payment:', error);
      toast.error('Failed to update payment status');
    },
  });

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await updatePaymentMutation.mutateAsync();
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFirstPaymentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please upload a PDF or image file (JPEG, PNG, WebP)');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setFirstPaymentProof(file);
    }
  };

  const handleFinalPaymentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please upload a PDF or image file (JPEG, PNG, WebP)');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setFinalPaymentProof(file);
    }
  };

  const getPaymentStatusBadge = (status: string | null) => {
    switch (status) {
      case 'not_paid':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Not Paid</Badge>;
      case 'first_payment_received':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">First Payment</Badge>;
      case 'payment_completed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Paid</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Update Payment Status
          </DialogTitle>
          <DialogDescription>
            Update payment information for order {order.order_number}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-5">
            {/* Order Summary */}
            <div className="p-4 rounded-lg bg-muted/30 border space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{order.order_number}</span>
                <Badge variant="outline" className="text-xs">{order.deal_id}</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>{order.clients?.company_name || 'Unknown Client'}</span>
              </div>
              {order.opportunities?.expected_value && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Value: </span>
                  <span className="font-medium">SAR {order.opportunities.expected_value.toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Current Status:</span>
                {getPaymentStatusBadge(order.payment_status)}
              </div>
            </div>

            <Separator />

            {/* Payment Status Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payment Status
              </Label>
              
              <RadioGroup
                value={paymentStatus}
                onValueChange={(value) => setPaymentStatus(value as PaymentStatus)}
                className="space-y-2"
              >
                <Label
                  htmlFor="update_not_paid"
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    paymentStatus === 'not_paid' 
                      ? 'border-red-500 bg-red-500/5' 
                      : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <RadioGroupItem value="not_paid" id="update_not_paid" />
                  <div>
                    <span className="text-sm font-medium">Not Paid</span>
                    <p className="text-xs text-muted-foreground">No payment received yet</p>
                  </div>
                </Label>
                <Label
                  htmlFor="update_first_payment"
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    paymentStatus === 'first_payment_received' 
                      ? 'border-amber-500 bg-amber-500/5' 
                      : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <RadioGroupItem value="first_payment_received" id="update_first_payment" />
                  <div>
                    <span className="text-sm font-medium">First Payment Received</span>
                    <p className="text-xs text-muted-foreground">Partial payment received</p>
                  </div>
                </Label>
                <Label
                  htmlFor="update_payment_completed"
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    paymentStatus === 'payment_completed' 
                      ? 'border-green-500 bg-green-500/5' 
                      : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <RadioGroupItem value="payment_completed" id="update_payment_completed" />
                  <div>
                    <span className="text-sm font-medium">Payment Completed</span>
                    <p className="text-xs text-muted-foreground">Full payment received</p>
                  </div>
                </Label>
              </RadioGroup>
            </div>

            {/* Payment Proofs Section */}
            {paymentStatus !== 'not_paid' && (
              <>
                <Separator />
                <div className="space-y-4">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Payment Proofs
                  </Label>

                  {/* First Payment Proof */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">First Payment Proof</Label>
                    
                    {order.first_payment_proof_url && !firstPaymentProof && (
                      <div className="flex items-center gap-2 p-2 rounded border bg-muted/20">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm flex-1">Existing proof uploaded</span>
                        <a
                          href={order.first_payment_proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" />
                          View
                        </a>
                      </div>
                    )}

                    <input
                      ref={firstPaymentInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handleFirstPaymentFileChange}
                      className="hidden"
                    />
                    
                    {firstPaymentProof ? (
                      <div className="flex items-center gap-2 p-2 rounded border bg-background">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm flex-1 truncate">{firstPaymentProof.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFirstPaymentProof(null)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => firstPaymentInputRef.current?.click()}
                        className="w-full"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {order.first_payment_proof_url ? 'Replace First Payment Proof' : 'Upload First Payment Proof'}
                      </Button>
                    )}
                  </div>

                  {/* Final Payment Proof - only show if payment completed */}
                  {paymentStatus === 'payment_completed' && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Final Payment Proof</Label>
                      
                      {order.final_payment_proof_url && !finalPaymentProof && (
                        <div className="flex items-center gap-2 p-2 rounded border bg-muted/20">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm flex-1">Existing proof uploaded</span>
                          <a
                            href={order.final_payment_proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <Download className="h-3 w-3" />
                            View
                          </a>
                        </div>
                      )}

                      <input
                        ref={finalPaymentInputRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={handleFinalPaymentFileChange}
                        className="hidden"
                      />
                      
                      {finalPaymentProof ? (
                        <div className="flex items-center gap-2 p-2 rounded border bg-background">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm flex-1 truncate">{finalPaymentProof.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setFinalPaymentProof(null)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => finalPaymentInputRef.current?.click()}
                          className="w-full"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {order.final_payment_proof_url ? 'Replace Final Payment Proof' : 'Upload Final Payment Proof'}
                        </Button>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Accepted formats: PDF, JPEG, PNG, WebP (max 10MB)
                  </p>
                </div>
              </>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={isUpdating}>
            {isUpdating ? 'Updating...' : 'Update Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpdatePaymentDialog;
