import { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Material {
  id?: string;
  material_name: string;
  pricing_type: string;
  quantity: string;
  expected_delivery_date: Date | undefined;
  notes: string;
}

interface RFPDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: {
    id: string;
    name: string;
    stage?: string;
  } | null;
  onSuccess: () => void;
}

export const RFPDetailsDialog = ({
  open,
  onOpenChange,
  opportunity,
  onSuccess,
}: RFPDetailsDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [notes, setNotes] = useState('');

  // Fetch existing materials when dialog opens
  useEffect(() => {
    if (opportunity && open) {
      fetchMaterials();
      fetchOpportunityNotes();
    }
  }, [opportunity, open]);

  const fetchMaterials = async () => {
    if (!opportunity) return;
    
    const { data, error } = await supabase
      .from('opportunity_materials')
      .select('*')
      .eq('opportunity_id', opportunity.id)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching materials:', error);
      return;
    }
    
    if (data && data.length > 0) {
      setMaterials(data.map(m => ({
        id: m.id,
        material_name: m.material_name,
        pricing_type: m.pricing_type || 'Soft',
        quantity: m.quantity?.toString() || '',
        expected_delivery_date: m.expected_delivery_date ? new Date(m.expected_delivery_date) : undefined,
        notes: m.notes || '',
      })));
    } else {
      // Start with one empty material row
      setMaterials([{
        material_name: '',
        pricing_type: 'Soft',
        quantity: '',
        expected_delivery_date: undefined,
        notes: '',
      }]);
    }
  };

  const fetchOpportunityNotes = async () => {
    if (!opportunity) return;
    const { data } = await supabase
      .from('opportunities')
      .select('notes')
      .eq('id', opportunity.id)
      .maybeSingle();
    if (data) {
      setNotes(data.notes || '');
    }
  };

  const addMaterial = () => {
    setMaterials([...materials, {
      material_name: '',
      pricing_type: 'Soft',
      quantity: '',
      expected_delivery_date: undefined,
      notes: '',
    }]);
  };

  const removeMaterial = (index: number) => {
    if (materials.length === 1) return;
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const updateMaterial = (index: number, field: keyof Material, value: any) => {
    const updated = [...materials];
    updated[index] = { ...updated[index], [field]: value };
    setMaterials(updated);
  };

  const handleSubmit = async () => {
    if (!opportunity) return;
    
    // Validate at least one material has a name
    const validMaterials = materials.filter(m => m.material_name.trim());
    if (validMaterials.length === 0) {
      toast.error('Please add at least one material');
      return;
    }

    setLoading(true);
    try {
      // Delete existing materials
      await supabase
        .from('opportunity_materials')
        .delete()
        .eq('opportunity_id', opportunity.id);
      
      // Insert new materials
      const materialsToInsert = validMaterials.map(m => ({
        opportunity_id: opportunity.id,
        material_name: m.material_name.trim(),
        pricing_type: m.pricing_type,
        quantity: m.quantity ? parseFloat(m.quantity) : null,
        expected_delivery_date: m.expected_delivery_date 
          ? format(m.expected_delivery_date, 'yyyy-MM-dd') 
          : null,
        notes: m.notes || null,
      }));

      const { error: insertError } = await supabase
        .from('opportunity_materials')
        .insert(materialsToInsert);

      if (insertError) throw insertError;

      // Update opportunity stage to RFP and notes, also reset closed state
      const { error: updateError } = await supabase
        .from('opportunities')
        .update({ 
          stage: 'RFP',
          notes: notes || null,
          is_closed: false,
          won: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', opportunity.id);

      if (updateError) throw updateError;

      toast.success('RFP details saved successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save RFP details');
    } finally {
      setLoading(false);
    }
  };

  if (!opportunity) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>RFP Details</DialogTitle>
          <DialogDescription>
            Add requested materials for {opportunity.name}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {/* Requested Materials Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Requested Materials</h3>
              <Button type="button" variant="outline" size="sm" onClick={addMaterial}>
                <Plus className="h-4 w-4 mr-1" />
                Add Material
              </Button>
            </div>

            <div className="space-y-4">
              {materials.map((material, index) => (
                <div key={index} className="p-4 border border-border rounded-lg space-y-4 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Material {index + 1}</span>
                    {materials.length > 1 && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeMaterial(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-3">
                    <div className="grid gap-2">
                      <Label>Material Name *</Label>
                      <Input
                        value={material.material_name}
                        onChange={(e) => updateMaterial(index, 'material_name', e.target.value)}
                        placeholder="e.g. Steel, Concrete, Tiles..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <Label>Pricing Type</Label>
                        <Select
                          value={material.pricing_type}
                          onValueChange={(value) => updateMaterial(index, 'pricing_type', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Soft">Soft</SelectItem>
                            <SelectItem value="Quantity based">Quantity based</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          value={material.quantity}
                          onChange={(e) => updateMaterial(index, 'quantity', e.target.value)}
                          placeholder="Optional"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label>Expected Order Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "justify-start text-left font-normal",
                              !material.expected_delivery_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {material.expected_delivery_date 
                              ? format(material.expected_delivery_date, 'MMMM do, yyyy')
                              : 'Select date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={material.expected_delivery_date}
                            onSelect={(date) => updateMaterial(index, 'expected_delivery_date', date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {material.pricing_type === 'Soft' && (
                      <p className="text-xs text-amber-500">
                        Soft: indicative pricing, final depends on actual quantities
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Notes */}
            <div className="grid gap-2 pt-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about this opportunity..."
                rows={3}
              />
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : 'Save RFP Details'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
