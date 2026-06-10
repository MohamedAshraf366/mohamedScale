import { useState, useEffect, useRef } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  AlertTriangle, 
  CheckCircle, 
  ArrowRight, 
  Package, 
  FileText,
  Lock,
  Building2,
  Briefcase,
  Target,
  User,
  Calendar,
  MapPin,
  Upload,
  CreditCard,
  X,
  Plus,
  Trash2
} from 'lucide-react';
import { useConvertToDeal } from '@/hooks/useConvertToDeal';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

type PaymentStatus = 'not_paid' | 'first_payment_received' | 'payment_completed';

interface ConvertToDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: {
    id: string;
    name: string;
    client_id: string;
    project_id: string;
    expected_value?: number | null;
    notes?: string | null;
    interest_level?: string | null;
  };
  onSuccess?: () => void;
}

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string | null;
}

export const ConvertToDealDialog = ({
  open,
  onOpenChange,
  opportunity,
  onSuccess,
}: ConvertToDealDialogProps) => {
  const convertToDeal = useConvertToDeal();
  const [isConverting, setIsConverting] = useState(false);

  // Order items state
  interface OrderItem {
    id: string;
    item: string;
    quantity: number | '';
    price: number | '';
  }
  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    { id: crypto.randomUUID(), item: '', quantity: '', price: '' }
  ]);

  // Form state
  const [deliveryDate, setDeliveryDate] = useState('');
  const [receiverNumber, setReceiverNumber] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryDistrict, setDeliveryDistrict] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');

  // Payment state
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('not_paid');
  const [firstPaymentProof, setFirstPaymentProof] = useState<File | null>(null);
  const [finalPaymentProof, setFinalPaymentProof] = useState<File | null>(null);
  const [isUploadingFirstPayment, setIsUploadingFirstPayment] = useState(false);
  const [isUploadingFinalPayment, setIsUploadingFinalPayment] = useState(false);
  const firstPaymentInputRef = useRef<HTMLInputElement>(null);
  const finalPaymentInputRef = useRef<HTMLInputElement>(null);

  // Fetch client details
  const { data: clientData } = useQuery({
    queryKey: ['client-details', opportunity.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('company_name, city, district')
        .eq('id', opportunity.client_id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch project details
  const { data: projectData } = useQuery({
    queryKey: ['project-details', opportunity.project_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('name, city, district')
        .eq('id', opportunity.project_id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');
      
      if (error) throw error;
      return data as TeamMember[];
    },
    enabled: open,
  });

  // Fetch opportunity materials
  const { data: materials = [] } = useQuery({
    queryKey: ['opportunity-materials', opportunity.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunity_materials')
        .select('*')
        .eq('opportunity_id', opportunity.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Set default delivery city/district from project or client
  useEffect(() => {
    if (projectData?.city) {
      setDeliveryCity(projectData.city);
      setDeliveryDistrict(projectData.district || '');
    } else if (clientData?.city) {
      setDeliveryCity(clientData.city);
      setDeliveryDistrict(clientData.district || '');
    }
  }, [projectData, clientData]);

  // Check if project already has city/district defined
  const hasProjectLocation = !!(projectData?.city || projectData?.district);

  const getInterestBadge = (level: string | null | undefined) => {
    switch (level) {
      case 'High':
        return <Badge className="bg-green-500/20 text-green-700 border-0">High</Badge>;
      case 'Medium':
        return <Badge className="bg-amber-500/20 text-amber-700 border-0">Medium</Badge>;
      case 'Low':
        return <Badge className="bg-orange-500/20 text-orange-700 border-0">Low</Badge>;
      default:
        return <Badge variant="outline">Not set</Badge>;
    }
  };

  // Upload payment proof file
  const uploadPaymentProof = async (file: File, type: 'first' | 'final'): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${opportunity.id}-${type}-${Date.now()}.${fileExt}`;
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

  // Order items handlers
  const addOrderItem = () => {
    setOrderItems([...orderItems, { id: crypto.randomUUID(), item: '', quantity: '', price: '' }]);
  };

  const removeOrderItem = (id: string) => {
    if (orderItems.length > 1) {
      setOrderItems(orderItems.filter(item => item.id !== id));
    }
  };

  const updateOrderItem = (id: string, field: keyof Omit<OrderItem, 'id'>, value: string | number) => {
    setOrderItems(orderItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateTotalValue = () => {
    return orderItems.reduce((sum, item) => {
      const qty = typeof item.quantity === 'number' ? item.quantity : 0;
      const price = typeof item.price === 'number' ? item.price : 0;
      return sum + (qty * price);
    }, 0);
  };

  const handleConvert = async () => {
    // Validate order items
    const validItems = orderItems.filter(item => item.item.trim() !== '');
    if (validItems.length === 0) {
      toast.error('At least one item is required');
      return;
    }
    
    for (const item of validItems) {
      if (!item.quantity || item.quantity <= 0) {
        toast.error(`Quantity is required for "${item.item}"`);
        return;
      }
      if (!item.price || item.price <= 0) {
        toast.error(`Price must be positive for "${item.item}"`);
        return;
    }

    if (!deliveryDate) {
      toast.error('Delivery date is required');
      return;
    }

    if (!receiverNumber.trim()) {
      toast.error('Receiver number is required');
      return;
    }
    }

    if (!hasProjectLocation && (!deliveryCity)) {
      toast.error('Delivery city is required');
      return;
    }

    setIsConverting(true);
    try {
      // Upload payment proofs if provided
      let firstPaymentProofUrl: string | null = null;
      let finalPaymentProofUrl: string | null = null;

      if (firstPaymentProof && paymentStatus !== 'not_paid') {
        firstPaymentProofUrl = await uploadPaymentProof(firstPaymentProof, 'first');
      }
      if (finalPaymentProof && paymentStatus === 'payment_completed') {
        finalPaymentProofUrl = await uploadPaymentProof(finalPaymentProof, 'final');
      }

      // Use orderItems from the form (with user-entered prices)
      const validItems = orderItems.filter(item => item.item.trim() !== '');
      
      await convertToDeal.mutateAsync({
        opportunityId: opportunity.id,
        clientId: opportunity.client_id,
        projectId: opportunity.project_id,
        materials: validItems.map(item => ({
          material_name: item.item,
          quantity: item.quantity !== '' ? Number(item.quantity) : null,
          unit_price: item.price !== '' ? Number(item.price) : null,
          expected_delivery_date: deliveryDate || null,
          pricing_type: 'fixed',
          notes: null,
        })),
        paymentStatus,
        firstPaymentProofUrl,
        finalPaymentProofUrl,
      });

      // Update opportunity with additional fields
      const totalValue = calculateTotalValue();
      await supabase
        .from('opportunities')
        .update({
          expected_value: totalValue,
          notes: notes || opportunity.notes,
          assigned_to: assignedTo || undefined,
        })
        .eq('id', opportunity.id);

      onOpenChange(false);
      onSuccess?.();
    } finally {
      setIsConverting(false);
    }
  };

  const resetForm = () => {
    setOrderItems([{ id: crypto.randomUUID(), item: '', quantity: '', price: '' }]);
    setDeliveryDate('');
    setReceiverNumber('');
    setDeliveryCity('');
    setDeliveryDistrict('');
    setAssignedTo('');
    setNotes('');
    setPaymentStatus('not_paid');
    setFirstPaymentProof(null);
    setFinalPaymentProof(null);
  };

  const handleFirstPaymentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please upload a PDF or image file (JPEG, PNG, WebP)');
        return;
      }
      // Validate file size (max 10MB)
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
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please upload a PDF or image file (JPEG, PNG, WebP)');
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setFinalPaymentProof(file);
    }
  };

  // Pre-fill order items from opportunity materials
  useEffect(() => {
    if (open && materials.length > 0) {
      setOrderItems(materials.map(m => ({
        id: crypto.randomUUID(),
        item: m.material_name || '',
        quantity: m.quantity || '',
        price: '',
      })));
    } else if (open) {
      resetForm();
    }
  }, [open, materials]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-primary" />
            Convert Opportunity → Deal (Order)
          </DialogTitle>
          <DialogDescription>
            This will hand over the opportunity to Operations as a confirmed order.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {/* A) Summary Section (Read-only) */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                Summary
              </h4>
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30 border">
                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Client</p>
                    <p className="font-medium">{clientData?.company_name || 'Loading...'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Briefcase className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Project</p>
                    <p className="font-medium">{projectData?.name || 'Loading...'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Target className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Opportunity</p>
                    <p className="font-medium">{opportunity.name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Interest Level</p>
                    {getInterestBadge(opportunity.interest_level)}
                  </div>
                </div>
              </div>

              {/* Materials preview */}
              {materials.length > 0 && (
                <div className="border rounded-lg p-3 bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <h5 className="text-xs font-semibold text-muted-foreground">Materials ({materials.length})</h5>
                  </div>
                  <div className="space-y-1">
                    {materials.slice(0, 3).map((m, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{m.material_name}</span>
                        <span className="text-muted-foreground">{m.quantity || '-'}</span>
                      </div>
                    ))}
                    {materials.length > 3 && (
                      <p className="text-xs text-muted-foreground">+{materials.length - 3} more...</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* B) Required Fields - Order Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                  Required Information
                </h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOrderItem}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Item
                </Button>
              </div>
              
              {/* Order Items Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_100px_120px_40px] gap-2 p-2 bg-muted/30 text-xs font-medium text-muted-foreground">
                  <span>Item *</span>
                  <span>Quantity *</span>
                  <span>Price (SAR) *</span>
                  <span></span>
                </div>
                <div className="divide-y">
                  {orderItems.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-[1fr_100px_120px_40px] gap-2 p-2 items-center">
                      <Input
                        value={item.item}
                        onChange={(e) => updateOrderItem(item.id, 'item', e.target.value)}
                        placeholder="Enter item name"
                        className="h-8 text-sm"
                      />
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateOrderItem(item.id, 'quantity', e.target.value ? parseInt(e.target.value) : '')}
                        placeholder="Qty"
                        className="h-8 text-sm"
                      />
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.price}
                        onChange={(e) => updateOrderItem(item.id, 'price', e.target.value ? parseFloat(e.target.value) : '')}
                        placeholder="Price"
                        className="h-8 text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOrderItem(item.id)}
                        disabled={orderItems.length === 1}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                {/* Total */}
                <div className="grid grid-cols-[1fr_100px_120px_40px] gap-2 p-2 bg-muted/20 border-t">
                  <span className="text-sm font-medium text-right pr-2">Total:</span>
                  <span></span>
                  <span className="text-sm font-semibold text-primary">
                    {calculateTotalValue().toLocaleString()} SAR
                  </span>
                  <span></span>
                </div>
              </div>

              {/* Delivery Date and Receiver Number */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deliveryDate" className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Delivery Date *
                  </Label>
                  <Input
                    id="deliveryDate"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="receiverNumber" className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Receiver Number *
                  </Label>
                  <Input
                    id="receiverNumber"
                    type="tel"
                    value={receiverNumber}
                    onChange={(e) => setReceiverNumber(e.target.value)}
                    placeholder="e.g. 05XXXXXXXX"
                    required
                  />
                </div>
              </div>

              {!hasProjectLocation && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="deliveryCity" className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      Delivery City *
                    </Label>
                    <Input
                      id="deliveryCity"
                      value={deliveryCity}
                      onChange={(e) => setDeliveryCity(e.target.value)}
                      placeholder="Enter city"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deliveryDistrict">Delivery District</Label>
                    <Input
                      id="deliveryDistrict"
                      value={deliveryDistrict}
                      onChange={(e) => setDeliveryDistrict(e.target.value)}
                      placeholder="Enter district (optional)"
                    />
                  </div>
                </div>
              )}

              {hasProjectLocation && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Delivery location: {[projectData?.city, projectData?.district].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="assignedTo" className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Assigned To
                </Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.full_name || member.email || member.id}>
                        {member.full_name || member.email || 'Unknown'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes for the order..."
                  rows={3}
                />
              </div>
            </div>

            <Separator />

            {/* C) Payment Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                Payment Status *
              </h4>
              
              <RadioGroup
                value={paymentStatus}
                onValueChange={(value) => setPaymentStatus(value as PaymentStatus)}
                className="grid grid-cols-3 gap-3"
              >
                <Label
                  htmlFor="not_paid"
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    paymentStatus === 'not_paid' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <RadioGroupItem value="not_paid" id="not_paid" />
                  <span className="text-sm font-medium">Not Paid</span>
                </Label>
                <Label
                  htmlFor="first_payment_received"
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    paymentStatus === 'first_payment_received' 
                      ? 'border-amber-500 bg-amber-500/5' 
                      : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <RadioGroupItem value="first_payment_received" id="first_payment_received" />
                  <span className="text-sm font-medium">First Payment</span>
                </Label>
                <Label
                  htmlFor="payment_completed"
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    paymentStatus === 'payment_completed' 
                      ? 'border-green-500 bg-green-500/5' 
                      : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <RadioGroupItem value="payment_completed" id="payment_completed" />
                  <span className="text-sm font-medium">Completed</span>
                </Label>
              </RadioGroup>

              {/* Payment Attachments - conditional based on payment status */}
              {paymentStatus !== 'not_paid' && (
                <div className="space-y-3 p-4 rounded-lg bg-muted/20 border">
                  {/* First Payment Proof */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      First Payment Proof (Optional)
                    </Label>
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
                        Upload First Payment Proof
                      </Button>
                    )}
                  </div>

                  {/* Final Payment Proof - only show if payment completed */}
                  {paymentStatus === 'payment_completed' && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5" />
                        Final Payment Proof (Optional)
                      </Label>
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
                          Upload Final Payment Proof
                        </Button>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Accepted formats: PDF, JPEG, PNG, WebP (max 10MB)
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* D) Attachments Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <Upload className="h-4 w-4" />
                Attachments (Optional)
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-muted/20 cursor-pointer transition-colors">
                  <FileText className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Final Quotation</p>
                  <p className="text-xs text-muted-foreground">Upload PDF or image</p>
                </div>
                <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-muted/20 cursor-pointer transition-colors">
                  <FileText className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">PO / Client Confirmation</p>
                  <p className="text-xs text-muted-foreground">Upload any format</p>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  This action cannot be undone
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  The opportunity will be marked as converted and locked. A new order will be created in Operations.
                </p>
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isConverting}>
            Cancel
          </Button>
          <Button 
            onClick={handleConvert} 
            disabled={isConverting}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            {isConverting ? (
              'Converting...'
            ) : (
              <>
                <ArrowRight className="h-4 w-4" />
                Convert & Create Deal
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConvertToDealDialog;
