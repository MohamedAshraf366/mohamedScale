import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, differenceInDays } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CalendarIcon, Plus, Trash2, Star, Package, MapPin, Truck, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { logAudit } from '@/lib/auditLogger';

interface CloseDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineItem: {
    id: string;
    company_name: string | null;
    created_at: string | null;
    city?: string | null;
    district?: string | null;
    location?: string | null;
    related_supplier_id?: string | null;
  } | null;
  onSuccess: () => void;
}

interface DealItem {
  id: string;
  material_id: string;
  quantity: number | null;
  unit: string;
  final_unit_price: number | null;
}

interface Material {
  id: string;
  name: string;
  uom: string;
  scale_price: number | null;
}

interface Supplier {
  id: string;
  name: string;
}

const UNIT_OPTIONS = ['m³', 'pcs', 'pallet', 'ton', 'kg', 'm', 'm²', 'bag', 'roll', 'set'];

const StarRating = ({ 
  value, 
  onChange, 
  max = 5 
}: { 
  value: number; 
  onChange: (val: number) => void; 
  max?: number;
}) => {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i + 1)}
          className="focus:outline-none"
        >
          <Star
            className={cn(
              "h-5 w-5 transition-colors",
              i < value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
            )}
          />
        </button>
      ))}
    </div>
  );
};

export function CloseDealDialog({ open, onOpenChange, pipelineItem, onSuccess }: CloseDealDialogProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Deal Summary
  const [dealStartDate, setDealStartDate] = useState<Date>(new Date());
  const [dealCloseDate, setDealCloseDate] = useState<Date>(new Date());

  // Ordered Materials
  const [dealItems, setDealItems] = useState<DealItem[]>([]);

  // Project Location
  const [projectName, setProjectName] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [locationNotes, setLocationNotes] = useState('');

  // Supplier & Delivery
  const [supplierId, setSupplierId] = useState('');
  const [supplierRating, setSupplierRating] = useState(0);
  const [supplierFeedback, setSupplierFeedback] = useState('');
  const [deliveryType, setDeliveryType] = useState('delivered_by_supplier');
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [deliveryFeedback, setDeliveryFeedback] = useState('');

  // Client Evaluation
  const [priceSatisfaction, setPriceSatisfaction] = useState(0);
  const [deliverySatisfaction, setDeliverySatisfaction] = useState(0);
  const [qualitySatisfaction, setQualitySatisfaction] = useState(0);
  const [overallSatisfaction, setOverallSatisfaction] = useState(0);
  const [clientLiked, setClientLiked] = useState('');
  const [clientImprovements, setClientImprovements] = useState('');
  const [retentionIdeas, setRetentionIdeas] = useState('');

  useEffect(() => {
    if (open) {
      fetchMaterials();
      fetchSuppliers();
      if (pipelineItem) {
        // Set start date from creation date
        if (pipelineItem.created_at) {
          setDealStartDate(new Date(pipelineItem.created_at));
        }
        // Prefill location from pipeline item
        setCity(pipelineItem.city || '');
        setDistrict(pipelineItem.district || '');
        setLocationNotes(pipelineItem.location || '');
        // Prefill supplier if available
        if (pipelineItem.related_supplier_id) {
          setSupplierId(pipelineItem.related_supplier_id);
        }
      }
    }
  }, [open, pipelineItem]);

  const resetForm = () => {
    setDealStartDate(new Date());
    setDealCloseDate(new Date());
    setDealItems([]);
    setProjectName('');
    setCity('');
    setDistrict('');
    setLocationNotes('');
    setSupplierId('');
    setSupplierRating(0);
    setSupplierFeedback('');
    setDeliveryType('delivered_by_supplier');
    setDeliveryRating(0);
    setDeliveryFeedback('');
    setPriceSatisfaction(0);
    setDeliverySatisfaction(0);
    setQualitySatisfaction(0);
    setOverallSatisfaction(0);
    setClientLiked('');
    setClientImprovements('');
    setRetentionIdeas('');
  };

  const fetchMaterials = async () => {
    const { data } = await supabase
      .from('materials')
      .select('id, name, uom, scale_price')
      .order('name');
    if (data) setMaterials(data);
  };

  const fetchSuppliers = async () => {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name')
      .order('name');
    if (data) setSuppliers(data);
  };

  const addDealItem = () => {
    setDealItems([
      ...dealItems,
      { id: crypto.randomUUID(), material_id: '', quantity: null, unit: 'pcs', final_unit_price: null }
    ]);
  };

  const removeDealItem = (id: string) => {
    setDealItems(dealItems.filter(item => item.id !== id));
  };

  const updateDealItem = (id: string, field: keyof DealItem, value: any) => {
    setDealItems(dealItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Auto-fill unit from material
        if (field === 'material_id') {
          const material = materials.find(m => m.id === value);
          if (material) {
            updated.unit = material.uom || 'pcs';
            if (material.scale_price && !updated.final_unit_price) {
              updated.final_unit_price = material.scale_price;
            }
          }
        }
        return updated;
      }
      return item;
    }));
  };

  const calculateLineTotal = (item: DealItem) => {
    if (item.quantity && item.final_unit_price) {
      return item.quantity * item.final_unit_price;
    }
    return 0;
  };

  const totalDealValue = dealItems.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  const dealDuration = differenceInDays(dealCloseDate, dealStartDate);

  const handleCloseDeal = async () => {
    if (!pipelineItem) return;

    if (!supplierId) {
      toast.error('Please select a supplier');
      return;
    }

    setLoading(true);
    try {
      // Update communication_log with deal closure data
      const { error: updateError } = await supabase
        .from('communication_log')
        .update({
          deal_completed: true,
          status: 'Closed',
          deal_closed_at: dealCloseDate.toISOString(),
          deal_started_at: dealStartDate.toISOString(),
          deal_duration_days: dealDuration,
          deal_value_total: totalDealValue,
          deal_project_name: projectName,
          deal_city: city,
          deal_district: district,
          deal_location_notes: locationNotes,
          deal_supplier_id: supplierId,
          deal_supplier_rating: supplierRating,
          deal_supplier_feedback: supplierFeedback,
          deal_delivery_type: deliveryType,
          deal_delivery_rating: deliveryRating,
          deal_delivery_feedback: deliveryFeedback,
          client_price_satisfaction: priceSatisfaction,
          client_delivery_satisfaction: deliverySatisfaction,
          client_quality_satisfaction: qualitySatisfaction,
          client_overall_satisfaction: overallSatisfaction,
          client_liked: clientLiked,
          client_improvements: clientImprovements,
          client_retention_ideas: retentionIdeas,
        })
        .eq('id', pipelineItem.id);

      if (updateError) throw updateError;

      // Insert deal items
      if (dealItems.length > 0) {
        const itemsToInsert = dealItems
          .filter(item => item.material_id)
          .map(item => ({
            communication_id: pipelineItem.id,
            material_id: item.material_id,
            quantity: item.quantity,
            unit: item.unit,
            final_unit_price: item.final_unit_price,
            line_total: calculateLineTotal(item),
          }));

        if (itemsToInsert.length > 0) {
          const { error: itemsError } = await supabase
            .from('closed_deal_items')
            .insert(itemsToInsert);

          if (itemsError) throw itemsError;
        }
      }

      // Close any open follow-ups for this deal
      await supabase
        .from('follow_up_history')
        .update({ status_after: 'Closed' })
        .eq('communication_log_id', pipelineItem.id)
        .eq('status_after', 'Open');

      // Log to audit
      await logAudit({
        action: 'deal_closed',
        module: 'Pipeline',
        recordId: pipelineItem.id,
        newValues: {
          company_name: pipelineItem.company_name,
          deal_value_total: totalDealValue,
          deal_duration_days: dealDuration,
          supplier_rating: supplierRating,
          overall_satisfaction: overallSatisfaction,
        },
        description: `Deal closed for ${pipelineItem.company_name} - Value: ${totalDealValue.toLocaleString()} SAR, Duration: ${dealDuration} days`,
      });

      toast.success('Deal closed successfully!');
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error closing deal:', error);
      toast.error(error.message || 'Failed to close deal');
    } finally {
      setLoading(false);
    }
  };

  if (!pipelineItem) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Close Deal — {pipelineItem.company_name || 'Unknown'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-8 py-4">
          {/* A) Deal Summary */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-primary">
              <Package className="h-5 w-5" />
              Deal Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Deal Start Date</Label>
                <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center">
                  <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{format(dealStartDate, 'PPP')}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Deal Close Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dealCloseDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dealCloseDate}
                      onSelect={(date) => date && setDealCloseDate(date)}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Deal Duration</Label>
                <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center">
                  <span className="font-semibold">{dealDuration} days</span>
                </div>
              </div>
            </div>
          </section>

          {/* B) Ordered Materials */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-primary">
              <Package className="h-5 w-5" />
              Ordered Materials
            </h3>
            
            <div className="space-y-3">
              {dealItems.map((item, index) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/50 rounded-lg">
                  <div className="col-span-4 space-y-1">
                    <Label className="text-xs">Material</Label>
                    <Select value={item.material_id} onValueChange={(v) => updateDealItem(item.id, 'material_id', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select material" />
                      </SelectTrigger>
                      <SelectContent>
                        {materials.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      value={item.quantity || ''}
                      onChange={(e) => updateDealItem(item.id, 'quantity', parseFloat(e.target.value) || null)}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Unit</Label>
                    <Select value={item.unit} onValueChange={(v) => updateDealItem(item.id, 'unit', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIT_OPTIONS.map(u => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Price (SAR)</Label>
                    <Input
                      type="number"
                      value={item.final_unit_price || ''}
                      onChange={(e) => updateDealItem(item.id, 'final_unit_price', parseFloat(e.target.value) || null)}
                      placeholder="Price"
                    />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <Label className="text-xs">Total</Label>
                    <div className="h-10 flex items-center text-sm font-medium">
                      {calculateLineTotal(item).toLocaleString()}
                    </div>
                  </div>
                  <div className="col-span-1">
                    <Button variant="ghost" size="icon" onClick={() => removeDealItem(item.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={addDealItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>

            <div className="flex justify-end pt-2 border-t">
              <div className="text-right">
                <span className="text-sm text-muted-foreground">Total Deal Value (SAR)</span>
                <div className="text-2xl font-bold text-primary">
                  {totalDealValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </section>

          {/* C) Project Location */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-primary">
              <MapPin className="h-5 w-5" />
              Project Location
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Project Name / Site Name</Label>
                <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Al Nakheel Tower" />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Riyadh" />
              </div>
              <div className="space-y-2">
                <Label>District / Area</Label>
                <Input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="e.g. Al Olaya" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Detailed Location Notes</Label>
                <Textarea 
                  value={locationNotes} 
                  onChange={(e) => setLocationNotes(e.target.value)} 
                  placeholder="Landmarks, gate details, access instructions..." 
                  rows={2}
                />
              </div>
            </div>
          </section>

          {/* D) Supplier & Delivery */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-primary">
              <Truck className="h-5 w-5" />
              Supplier & Delivery Performance
            </h3>
            
            {/* Supplier Select - Full Width */}
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Delivery Type - Full Width */}
            <div className="space-y-2">
              <Label>Delivery Type</Label>
              <RadioGroup value={deliveryType} onValueChange={setDeliveryType} className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="delivered_by_supplier" id="d1" />
                  <Label htmlFor="d1" className="font-normal">Delivered by supplier</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="delivered_by_third_party" id="d2" />
                  <Label htmlFor="d2" className="font-normal">Delivered by third party</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="client_pickup" id="d3" />
                  <Label htmlFor="d3" className="font-normal">Client pick-up</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Supplier Rating & Feedback */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Supplier Rating</Label>
                  <StarRating value={supplierRating} onChange={setSupplierRating} />
                </div>
                <div className="space-y-2">
                  <Label>Supplier Feedback</Label>
                  <Textarea 
                    value={supplierFeedback} 
                    onChange={(e) => setSupplierFeedback(e.target.value)} 
                    placeholder="What went well? Any issues?"
                    rows={3}
                  />
                </div>
              </div>

              {/* Delivery Rating & Feedback */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Delivery Rating</Label>
                  <StarRating value={deliveryRating} onChange={setDeliveryRating} />
                </div>
                <div className="space-y-2">
                  <Label>Delivery Feedback</Label>
                  <Textarea 
                    value={deliveryFeedback} 
                    onChange={(e) => setDeliveryFeedback(e.target.value)} 
                    placeholder="On-time? Handling? Offloading?"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* E) Client Evaluation */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-primary">
              <Users className="h-5 w-5" />
              Client Feedback & Retention
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Price Satisfaction</Label>
                <StarRating value={priceSatisfaction} onChange={setPriceSatisfaction} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Delivery Time</Label>
                <StarRating value={deliverySatisfaction} onChange={setDeliverySatisfaction} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Quality</Label>
                <StarRating value={qualitySatisfaction} onChange={setQualitySatisfaction} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Overall</Label>
                <StarRating value={overallSatisfaction} onChange={setOverallSatisfaction} />
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>What did the client like the most about this order?</Label>
                <Textarea 
                  value={clientLiked} 
                  onChange={(e) => setClientLiked(e.target.value)} 
                  placeholder="e.g. Fast delivery, competitive pricing, quality materials..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>What issues did the client mention or what can we improve?</Label>
                <Textarea 
                  value={clientImprovements} 
                  onChange={(e) => setClientImprovements(e.target.value)} 
                  placeholder="e.g. Delay in first delivery, packaging could be better..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Ideas to make this client order again</Label>
                <Textarea 
                  value={retentionIdeas} 
                  onChange={(e) => setRetentionIdeas(e.target.value)} 
                  placeholder="e.g. Offer volume discount, quarterly check-ins, loyalty program..."
                  rows={2}
                />
              </div>
            </div>
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCloseDeal} disabled={loading}>
            {loading ? 'Closing...' : 'Close Deal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
