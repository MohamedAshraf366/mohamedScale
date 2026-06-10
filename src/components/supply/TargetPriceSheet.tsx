import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MaterialStepPicker, type PickedMaterial } from '@/components/shared/MaterialStepPicker';
import { useCreateTargetPrice } from '@/hooks/useTargetPrices';
import { useSubcategoryAreas, type SubcategoryArea } from '@/hooks/useSubcategoryAreas';
import { supabase } from '@/integrations/supabase/client';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillMaterialId?: string | null;
  prefillAreaId?: string | null;
}

export function TargetPriceSheet({ open, onOpenChange, prefillMaterialId, prefillAreaId }: Props) {
  const [selectedMaterials, setSelectedMaterials] = useState<PickedMaterial[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [targetPrice, setTargetPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);

  const { data: areas } = useSubcategoryAreas(subcategoryId);
  const createMut = useCreateTargetPrice();

  useEffect(() => {
    if (open && prefillMaterialId) {
      supabase.from('materials').select('id, name, code, uom, subcategory_id').eq('id', prefillMaterialId).single().then(({ data }) => {
        if (data) {
          setSelectedMaterials([{ id: data.id, name: data.name, code: data.code, uom: data.uom }]);
          setSubcategoryId(data.subcategory_id);
        }
      });
    }
    if (open && prefillAreaId) {
      setSelectedAreaId(prefillAreaId);
    }
  }, [open, prefillMaterialId, prefillAreaId]);

  // When materials change, derive subcategory
  const handleAddMaterial = (mat: PickedMaterial) => {
    setSelectedMaterials(prev => {
      if (prev.some(m => m.id === mat.id)) return prev;
      return [...prev, mat];
    });
    // Fetch subcategory_id for the material
    supabase.from('materials').select('subcategory_id').eq('id', mat.id).single().then(({ data }) => {
      if (data?.subcategory_id) setSubcategoryId(data.subcategory_id);
    });
  };

  const removeMaterial = (id: string) => {
    setSelectedMaterials(prev => prev.filter(m => m.id !== id));
  };

  const handleSubmit = () => {
    if (selectedMaterials.length === 0 || !selectedAreaId || !targetPrice) return;
    createMut.mutate(
      {
        material_ids: selectedMaterials.map(m => m.id),
        scope_type: 'area',
        scope_id: selectedAreaId,
        target_price: Number(targetPrice),
        notes,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedMaterials([]);
          setSelectedAreaId('');
          setTargetPrice('');
          setNotes('');
          setSubcategoryId(null);
        },
      }
    );
  };

  const canSubmit = selectedMaterials.length > 0 && !!selectedAreaId && Number(targetPrice) > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full flex flex-col">
        <SheetHeader>
          <SheetTitle>Set Target Price</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-4">
            {/* Materials */}
            <div className="space-y-2">
              <Label>Materials</Label>
              {selectedMaterials.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedMaterials.map(m => (
                    <Badge key={m.id} variant="secondary" className="gap-1 pr-1">
                      <span className="text-xs">{m.code || m.name}</span>
                      <button type="button" onClick={() => removeMaterial(m.id)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <MaterialStepPicker
                multi
                onSelect={handleAddMaterial}
                onBulkSelect={(picked) => {
                  setSelectedMaterials(prev => {
                    const existing = new Set(prev.map(m => m.id));
                    return [...prev, ...picked.filter(p => !existing.has(p.id))];
                  });
                  if (picked.length > 0) {
                    supabase.from('materials').select('subcategory_id').eq('id', picked[0].id).single().then(({ data }) => {
                      if (data?.subcategory_id) setSubcategoryId(data.subcategory_id);
                    });
                  }
                }}
                excludeIds={selectedMaterials.map(m => m.id)}
                className="border rounded-lg p-3 bg-muted/30"
              />
            </div>

            <Separator />

            {/* Area Selector */}
            <div className="space-y-2">
              <Label>Target Area</Label>
              <p className="text-xs text-muted-foreground">Select the area this target price applies to. The price is all-inclusive (material + delivery).</p>
              {!subcategoryId ? (
                <p className="text-xs text-muted-foreground italic">Select a material first to see available areas.</p>
              ) : (areas || []).length === 0 ? (
                <p className="text-xs text-amber-600">No areas defined for this subcategory. Define areas first.</p>
              ) : (
                <Select value={selectedAreaId} onValueChange={setSelectedAreaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an area…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(areas || []).map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                          {a.name} ({a.zone_codes.length} zones)
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Separator />

            {/* Price */}
            <div className="space-y-2">
              <Label>Target Price (SAR per unit, all-inclusive)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={targetPrice}
                onChange={e => setTargetPrice(e.target.value)}
                placeholder="e.g. 12.50"
              />
              <p className="text-xs text-muted-foreground">This price includes material cost + delivery to the selected area.</p>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Benchmark source, reasoning…"
                rows={2}
              />
            </div>
          </div>
        </ScrollArea>

        <div className="pt-4 border-t">
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!canSubmit || createMut.isPending}
          >
            {createMut.isPending ? 'Saving…' : `Set Target for ${selectedMaterials.length} material(s)`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
