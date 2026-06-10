import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useCreateDeliveryRate } from '@/hooks/useDeliveryRates';
import type { SupplierMaterial } from '@/hooks/useSupplierMaterials';
import { Search, Package, MapPin } from 'lucide-react';
import { ZoneMapSelector } from '@/components/shared/ZoneMapSelector';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierAccountId: string;
  supplierMaterials: SupplierMaterial[];
}

export function AddDeliveryRateSheet({ open, onOpenChange, supplierAccountId, supplierMaterials }: Props) {
  const [isDefault, setIsDefault] = useState(true);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');

  const createRate = useCreateDeliveryRate();

  const currentMaterials = supplierMaterials.filter(sm => sm.status !== 'rejected');

  const filteredMaterials = currentMaterials.filter(sm => {
    const s = materialSearch.toLowerCase();
    return !s || sm.material_name?.toLowerCase().includes(s) || sm.material_code?.toLowerCase().includes(s);
  });

  const toggleMaterial = (id: string) => {
    setSelectedMaterials(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAllMaterials = () => {
    if (selectedMaterials.length === currentMaterials.length) {
      setSelectedMaterials([]);
    } else {
      setSelectedMaterials(currentMaterials.map(m => m.id));
    }
  };

  const handleSubmit = () => {
    if (!selectedZones.length || !price) return;
    if (!isDefault && !selectedMaterials.length) return;

    createRate.mutate({
      supplier_account_id: supplierAccountId,
      supplier_material_ids: isDefault ? [] : selectedMaterials,
      zone_ids: selectedZones,
      price_per_moq: parseFloat(price),
      notes: notes || undefined,
      is_default: isDefault,
    }, {
      onSuccess: () => {
        setSelectedMaterials([]);
        setSelectedZones([]);
        setPrice('');
        setNotes('');
        setIsDefault(true);
        onOpenChange(false);
      },
    });
  };

  const canSubmit = selectedZones.length > 0 && !!price && (isDefault || selectedMaterials.length > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-3xl flex flex-col">
        <SheetHeader>
          <SheetTitle>Add Delivery Rate</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto py-4">
          {/* Default vs Override toggle */}
          <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/20">
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            <div>
              <Label className="text-sm font-medium">
                {isDefault ? 'Default rate' : 'Material-specific override'}
              </Label>
              <p className="text-xs text-muted-foreground">
                {isDefault
                  ? 'Applies to all materials for this supplier'
                  : 'Override rate for specific materials only'}
              </p>
            </div>
            {isDefault && <Badge variant="secondary" className="ml-auto">Default</Badge>}
          </div>

          {/* Step 1: Select materials (only for overrides) */}
          {!isDefault && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Supplier Materials
                </Label>
                <Button variant="link" size="sm" onClick={selectAllMaterials} className="h-auto p-0 text-xs">
                  {selectedMaterials.length === currentMaterials.length ? 'Deselect all' : 'Select all'}
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search materials..."
                  value={materialSearch}
                  onChange={e => setMaterialSearch(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
              <ScrollArea className="h-36 border rounded-md p-2">
                {filteredMaterials.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No materials</p>
                ) : (
                  filteredMaterials.map(sm => (
                    <label
                      key={sm.id}
                      className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedMaterials.includes(sm.id)}
                        onCheckedChange={() => toggleMaterial(sm.id)}
                      />
                      <span className="text-sm flex-1">{sm.material_name}</span>
                      <span className="text-xs text-muted-foreground">{sm.material_code}</span>
                    </label>
                  ))
                )}
              </ScrollArea>
              <p className="text-xs text-muted-foreground">{selectedMaterials.length} selected</p>
            </div>
          )}

          {/* Step 2: Select zones on map */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Delivery Zones
              <span className="text-xs text-muted-foreground ml-1">({selectedZones.length} selected)</span>
            </Label>
            <ZoneMapSelector
              selectedZoneCodes={selectedZones}
              onSelectionChange={setSelectedZones}
              showZoneGroups
              mapHeight="300px"
              layout="compact"
            />
          </div>

          {/* Step 3: Price */}
          <div className="space-y-2">
            <Label>Price per MOQ (SAR, pre-tax)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 150"
              value={price}
              onChange={e => setPrice(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Any delivery notes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <div className="pt-4 border-t">
          <Button
            className="w-full"
            disabled={!canSubmit || createRate.isPending}
            onClick={handleSubmit}
          >
            {createRate.isPending ? 'Saving...' : `Save ${isDefault ? 'Default' : selectedMaterials.length + ' material'} rate for ${selectedZones.length} zone(s)`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
