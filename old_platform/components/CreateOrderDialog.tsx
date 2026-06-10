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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  CalendarIcon, 
  Plus, 
  Trash2, 
  ShoppingCart, 
  Package,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  opportunityName: string;
  onSuccess: () => void;
}

interface OrderItem {
  id: string;
  material_name: string;
  quantity: string;
  unit: string;
  unit_price: string;
  is_soft_quotation: boolean;
}

export const CreateOrderDialog = ({
  open,
  onOpenChange,
  opportunityId,
  opportunityName,
  onSuccess,
}: CreateOrderDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<OrderItem[]>([
    {
      id: crypto.randomUUID(),
      material_name: '',
      quantity: '',
      unit: 'units',
      unit_price: '',
      is_soft_quotation: false,
    },
  ]);

  // Load existing opportunity materials if any
  useEffect(() => {
    if (open && opportunityId) {
      loadOpportunityMaterials();
    }
  }, [open, opportunityId]);

  const loadOpportunityMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('opportunity_materials')
        .select('*')
        .eq('opportunity_id', opportunityId);

      if (error) throw error;

      if (data && data.length > 0) {
        setItems(data.map(m => ({
          id: crypto.randomUUID(),
          material_name: m.material_name,
          quantity: m.quantity?.toString() || '',
          unit: 'units',
          unit_price: '',
          is_soft_quotation: m.pricing_type === 'soft_quotation',
        })));
        // Set delivery date from first material if available
        if (data[0].expected_delivery_date) {
          setExpectedDeliveryDate(new Date(data[0].expected_delivery_date));
        }
      }
    } catch (error) {
      console.error('Error loading opportunity materials:', error);
    }
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        material_name: '',
        quantity: '',
        unit: 'units',
        unit_price: '',
        is_soft_quotation: false,
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof OrderItem, value: any) => {
    setItems(
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const calculateTotal = () => {
    return items.reduce((total, item) => {
      if (item.is_soft_quotation) return total;
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      return total + (qty * price);
    }, 0);
  };

  const handleSubmit = async () => {
    // Validate items
    const validItems = items.filter((item) => item.material_name.trim());
    if (validItems.length === 0) {
      toast.error('Please add at least one material');
      return;
    }

    // Validate quantities for non-soft-quotation items
    for (const item of validItems) {
      if (!item.is_soft_quotation && !item.quantity) {
        toast.error(`Please enter quantity for "${item.material_name}" or mark as Soft Quotation`);
        return;
      }
    }

    setLoading(true);
    try {
      // Create activity for order creation
      const { data: { user } } = await supabase.auth.getUser();
      
      const orderSummary = validItems.map(item => {
        if (item.is_soft_quotation) {
          return `${item.material_name} (Soft Quotation)`;
        }
        return `${item.material_name}: ${item.quantity} ${item.unit}${item.unit_price ? ` @ SAR ${item.unit_price}` : ''}`;
      }).join('\n');

      const { error } = await supabase
        .from('activities')
        .insert({
          client_id: await getClientIdFromOpportunity(opportunityId),
          opportunity_id: opportunityId,
          activity_type: 'order_created',
          channel: 'system',
          summary: `Order created for ${opportunityName}`,
          notes: `Materials:\n${orderSummary}\n\n${notes ? `Notes: ${notes}` : ''}${expectedDeliveryDate ? `\nExpected Delivery: ${format(expectedDeliveryDate, 'PPP')}` : ''}`,
          created_by: user?.id,
        });

      if (error) throw error;

      toast.success('Order created successfully');
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  const getClientIdFromOpportunity = async (oppId: string): Promise<string> => {
    const { data } = await supabase
      .from('opportunities')
      .select('client_id')
      .eq('id', oppId)
      .single();
    return data?.client_id || '';
  };

  const resetForm = () => {
    setItems([
      {
        id: crypto.randomUUID(),
        material_name: '',
        quantity: '',
        unit: 'units',
        unit_price: '',
        is_soft_quotation: false,
      },
    ]);
    setExpectedDeliveryDate(undefined);
    setNotes('');
  };

  const total = calculateTotal();
  const hasSoftQuotations = items.some(item => item.is_soft_quotation && item.material_name.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Create Order
          </DialogTitle>
          <DialogDescription>
            Create an order for {opportunityName}. Orders are optional and only created when the client explicitly requests.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Order Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Materials
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                  className="h-8"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Material
                </Button>
              </div>

              <div className="space-y-4">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-4 border border-border rounded-lg bg-muted/20 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Material {index + 1}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`soft-${item.id}`}
                            checked={item.is_soft_quotation}
                            onCheckedChange={(checked) =>
                              updateItem(item.id, 'is_soft_quotation', checked)
                            }
                          />
                          <Label htmlFor={`soft-${item.id}`} className="text-xs text-muted-foreground">
                            Soft Quotation
                          </Label>
                        </div>
                        {items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div>
                        <Label className="text-xs">Material Name *</Label>
                        <Input
                          placeholder="e.g., Steel Rebar 12mm"
                          value={item.material_name}
                          onChange={(e) =>
                            updateItem(item.id, 'material_name', e.target.value)
                          }
                        />
                      </div>

                      {!item.is_soft_quotation && (
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Quantity *</Label>
                            <Input
                              type="number"
                              placeholder="100"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(item.id, 'quantity', e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Unit</Label>
                            <Input
                              placeholder="units"
                              value={item.unit}
                              onChange={(e) =>
                                updateItem(item.id, 'unit', e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Unit Price (SAR)</Label>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={item.unit_price}
                              onChange={(e) =>
                                updateItem(item.id, 'unit_price', e.target.value)
                              }
                            />
                          </div>
                        </div>
                      )}

                      {item.is_soft_quotation && (
                        <div className="flex items-center gap-2 p-2 bg-amber-500/10 rounded-md">
                          <FileText className="h-4 w-4 text-amber-600" />
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            Soft quotation - final pricing depends on actual quantities
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Expected Delivery Date */}
            <div className="space-y-2">
              <Label>Expected Delivery Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !expectedDeliveryDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expectedDeliveryDate
                      ? format(expectedDeliveryDate, 'PPP')
                      : 'Select delivery date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={expectedDeliveryDate}
                    onSelect={setExpectedDeliveryDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Any additional notes about this order..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Order Summary */}
            {(total > 0 || hasSoftQuotations) && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Order Summary</span>
                </div>
                {total > 0 && (
                  <div className="flex items-center justify-between text-lg">
                    <span className="text-muted-foreground">Estimated Total:</span>
                    <span className="font-bold">SAR {total.toLocaleString()}</span>
                  </div>
                )}
                {hasSoftQuotations && (
                  <p className="text-xs text-muted-foreground">
                    * Some items are marked as Soft Quotation - final pricing TBD
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            {loading ? 'Creating...' : 'Create Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateOrderDialog;
