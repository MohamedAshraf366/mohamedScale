import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, MapPin, Phone, Factory, Truck, Calendar, User, ShoppingCart, ClipboardCheck, Clock, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmedMaterialItem {
  id: string;
  material_name: string;
  confirmed_quantity: string;
  confirmed_unit_price: string;
  confirmed_price: string;
}

interface OrderConfirmationFormData {
  confirmed_items: ConfirmedMaterialItem[];
  delivery_location: string;
  receiver_contact: string;
  supplier_name: string;
  expected_delivery_time: string;
  driver_number: string;
  payment_status: string;
}

interface OrderMaterial {
  id: string;
  opportunity_id?: string;
  order_id?: string;
  material_name: string;
  quantity: number | null;
  unit_price?: number | null;
}

interface OrderConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    order_number: string;
    payment_status?: string;
    clients?: { company_name: string; primary_contact_phone?: string; city?: string; district?: string } | null;
    projects?: { name: string; location?: string; city?: string; district?: string } | null;
    opportunities?: { expected_value: number | null } | null;
  } | null;
  materials?: OrderMaterial[];
  onConfirm: (orderId: string, data: OrderConfirmationFormData) => void;
  isLoading?: boolean;
}

export const OrderConfirmationDialog = ({
  open,
  onOpenChange,
  order,
  materials = [],
  onConfirm,
  isLoading = false,
}: OrderConfirmationDialogProps) => {
  // State for per-item confirmed values
  const [confirmedItems, setConfirmedItems] = useState<ConfirmedMaterialItem[]>([]);
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>();
  const [deliveryTime, setDeliveryTime] = useState<string>('06:00-10:00');
  const [paymentStatus, setPaymentStatus] = useState<string>('not_paid');
  
  // Calculate total quantity from materials
  const totalQuantity = materials?.reduce((sum, m) => sum + (m.quantity || 0), 0) || 0;
  
  // Calculate total price from materials (quantity * unit_price)
  const totalPrice = materials?.reduce((sum, m) => {
    const qty = m.quantity || 0;
    const price = m.unit_price || 0;
    return sum + (qty * price);
  }, 0) || 0;

  // Calculate confirmed totals
  const confirmedTotalQuantity = confirmedItems.reduce((sum, item) => sum + (parseFloat(item.confirmed_quantity) || 0), 0);
  const confirmedTotalPrice = confirmedItems.reduce((sum, item) => sum + (parseFloat(item.confirmed_price) || 0), 0);
  
  // Build delivery location from project data
  const getDeliveryLocation = () => {
    if (!order) return '';
    const parts = [
      order.projects?.location,
      order.projects?.district,
      order.projects?.city
    ].filter(Boolean);
    
    // Fallback to client location if project has none
    if (parts.length === 0) {
      const clientParts = [
        order.clients?.district,
        order.clients?.city
      ].filter(Boolean);
      return clientParts.join(', ');
    }
    return parts.join(', ');
  };

  const { register, handleSubmit, reset, formState: { errors } } = useForm<OrderConfirmationFormData>();

  // Initialize confirmed items when materials change
  useEffect(() => {
    if (materials && materials.length > 0) {
      setConfirmedItems(materials.map(m => ({
        id: m.id,
        material_name: m.material_name,
        confirmed_quantity: (m.quantity || 0).toString(),
        confirmed_unit_price: (m.unit_price || 0).toString(),
        confirmed_price: ((m.quantity || 0) * (m.unit_price || 0)).toString()
      })));
    }
  }, [materials]);

  // Reset form with sales values when order changes
  useEffect(() => {
    if (order) {
      reset({
        delivery_location: getDeliveryLocation(),
        receiver_contact: order.clients?.primary_contact_phone || '',
        supplier_name: '',
        expected_delivery_time: '',
        driver_number: '',
      });
      setPaymentStatus(order.payment_status || 'not_paid');
    }
  }, [order, reset]);

  const updateConfirmedItem = (id: string, field: 'confirmed_quantity' | 'confirmed_unit_price', value: string) => {
    setConfirmedItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updatedItem = { ...item, [field]: value };
      // Auto-calculate total price from qty × unit price
      const qty = parseFloat(field === 'confirmed_quantity' ? value : item.confirmed_quantity) || 0;
      const unitPrice = parseFloat(field === 'confirmed_unit_price' ? value : item.confirmed_unit_price) || 0;
      updatedItem.confirmed_price = (qty * unitPrice).toString();
      
      return updatedItem;
    }));
  };

  const onSubmit = (data: OrderConfirmationFormData) => {
    if (order) {
      // Format the delivery date and time
      const formattedDeliveryTime = deliveryDate 
        ? `${format(deliveryDate, 'MMM d, yyyy')} at ${deliveryTime}`
        : '';
      
      // Include confirmed items in the data
      const formDataWithItems = {
        ...data,
        expected_delivery_time: formattedDeliveryTime,
        confirmed_items: confirmedItems,
        confirmed_quantity: confirmedTotalQuantity.toString(),
        confirmed_price: confirmedTotalPrice.toString(),
        payment_status: paymentStatus,
      };
      onConfirm(order.id, formDataWithItems as any);
      reset();
      setConfirmedItems([]);
      setDeliveryDate(undefined);
      setDeliveryTime('06:00-10:00');
      setPaymentStatus('not_paid');
    }
  };

  const handleClose = () => {
    reset();
    setConfirmedItems([]);
    onOpenChange(false);
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Confirm Order: {order.order_number}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Compare Sales data with your confirmation before moving to In-Progress.
          </p>
        </DialogHeader>

        <DialogBody>
          <form id="order-confirmation-form" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* LEFT SIDE: Sales Data (Read-only) */}
              <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground">Sales Data</span>
                  <Badge variant="secondary" className="ml-auto text-xs">Read-only</Badge>
                </div>
                
                <Separator />

                {/* Items List */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Items</Label>
                  <ScrollArea className="max-h-48">
                    <div className="space-y-2">
                      {materials.length > 0 ? (
                        materials.map((material) => (
                          <div key={material.id} className="rounded-md border bg-background p-3 space-y-1">
                            <p className="font-medium text-sm text-foreground">{material.material_name}</p>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Qty: {material.quantity || 0}</span>
                              <span>Price: {(material.unit_price || 0).toLocaleString()} SAR</span>
                              <span className="font-medium text-foreground">
                                = {((material.quantity || 0) * (material.unit_price || 0)).toLocaleString()} SAR
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No items from Sales</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                <Separator />

                {/* Totals */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Quantity</span>
                    <span className="font-semibold text-foreground">{totalQuantity.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Price</span>
                    <span className="font-semibold text-primary">{totalPrice.toLocaleString()} SAR</span>
                  </div>
                </div>
              </div>

              {/* RIGHT SIDE: Order Confirmation (Editable) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground">Order Confirmation</span>
                  <Badge variant="outline" className="ml-auto text-xs">Editable</Badge>
                </div>

                <Separator />

                {/* Per-item confirmation */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Confirm Items</Label>
                  <ScrollArea className="max-h-64" type="always">
                    <div className="space-y-2">
                      {confirmedItems.length > 0 ? (
                        confirmedItems.map((item) => (
                          <div key={item.id} className="rounded-md border bg-background p-3 space-y-2">
                            <p className="font-medium text-sm text-foreground">{item.material_name}</p>
                            <div className="grid grid-cols-3 gap-3 items-end">
                              <div>
                                <Label className="text-xs text-muted-foreground">Qty</Label>
                                <Input
                                  type="number"
                                  value={item.confirmed_quantity}
                                  onChange={(e) => updateConfirmedItem(item.id, 'confirmed_quantity', e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">× Price</Label>
                                <Input
                                  type="number"
                                  value={item.confirmed_unit_price}
                                  onChange={(e) => updateConfirmedItem(item.id, 'confirmed_unit_price', e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Total (SAR)</Label>
                                <div className="h-8 flex items-center px-3 text-sm bg-muted rounded-md border">
                                  {parseFloat(item.confirmed_price).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No items to confirm</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                <Separator />

                {/* Confirmed Totals */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Confirmed Total Qty</span>
                    <span className="font-semibold text-foreground">{confirmedTotalQuantity.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Confirmed Total Price</span>
                    <span className="font-semibold text-primary">{confirmedTotalPrice.toLocaleString()} SAR</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="delivery_location" className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      Confirm Delivery Location *
                    </Label>
                    <Input
                      id="delivery_location"
                      placeholder="Enter delivery location"
                      {...register('delivery_location', { required: 'Delivery location is required' })}
                    />
                    {errors.delivery_location && (
                      <p className="text-xs text-destructive">{errors.delivery_location.message}</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="receiver_contact" className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      Confirm Receiver Contact Number *
                    </Label>
                    <Input
                      id="receiver_contact"
                      placeholder="Enter contact number"
                      {...register('receiver_contact', { required: 'Receiver contact is required' })}
                    />
                    {errors.receiver_contact && (
                      <p className="text-xs text-destructive">{errors.receiver_contact.message}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Supply & Logistics Section - Full Width */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Truck className="h-4 w-4 text-primary" />
                Supply & Logistics Details
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="supplier_name" className="flex items-center gap-1.5">
                    <Factory className="h-3.5 w-3.5" />
                    Supplier / Factory Name *
                  </Label>
                  <Input
                    id="supplier_name"
                    placeholder="Enter supplier or factory name"
                    {...register('supplier_name', { required: 'Supplier name is required' })}
                  />
                  {errors.supplier_name && (
                    <p className="text-xs text-destructive">{errors.supplier_name.message}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="expected_delivery_time" className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Expected Delivery Time *
                  </Label>
                  <div className="space-y-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !deliveryDate && "text-muted-foreground"
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {deliveryDate ? format(deliveryDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={deliveryDate}
                          onSelect={setDeliveryDate}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    
                    <Select value={deliveryTime} onValueChange={setDeliveryTime}>
                      <SelectTrigger className="w-full">
                        <Clock className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="Time Range" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border z-50">
                        <SelectItem value="06:00-10:00">06:00 - 10:00</SelectItem>
                        <SelectItem value="10:00-14:00">10:00 - 14:00</SelectItem>
                        <SelectItem value="14:00-18:00">14:00 - 18:00</SelectItem>
                        <SelectItem value="18:00-22:00">18:00 - 22:00</SelectItem>
                        <SelectItem value="22:00-02:00">22:00 - 02:00</SelectItem>
                        <SelectItem value="02:00-06:00">02:00 - 06:00</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {!deliveryDate && (
                    <p className="text-xs text-destructive">Please select a delivery date</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="driver_number" className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Driver Number
                  </Label>
                  <Input
                    id="driver_number"
                    placeholder="Enter driver contact number"
                    {...register('driver_number')}
                  />
                </div>

                <div className="grid gap-2">
                  <Label className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" />
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
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="order-confirmation-form" disabled={isLoading}>
            {isLoading ? 'Confirming...' : 'Confirm & Start Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
