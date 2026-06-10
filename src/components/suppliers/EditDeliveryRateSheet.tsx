import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ZoneMapSelector } from '@/components/shared/ZoneMapSelector';
import { MapPin } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { DeliveryRate } from '@/hooks/useDeliveryRates';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rate: DeliveryRate | null;
}

export function EditDeliveryRateSheet({ open, onOpenChange, rate }: Props) {
  const queryClient = useQueryClient();
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (rate) {
      setSelectedZones(rate.zone_codes || []);
      setPrice(String(rate.price_per_moq));
      setNotes(rate.notes || '');
    }
  }, [rate]);

  const updateRate = useMutation({
    mutationFn: async () => {
      if (!rate) return;
      const { error } = await supabase
        .from('delivery_rates')
        .update({
          zone_codes: selectedZones,
          price_per_moq: parseFloat(price),
          notes: notes || null,
        } as any)
        .eq('id', rate.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-rates', rate?.supplier_account_id] });
      toast.success('Delivery rate updated');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-3xl flex flex-col">
        <SheetHeader>
          <SheetTitle>Edit Delivery Rate</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto py-4">
          {/* Materials (read-only) */}
          {rate && rate.material_names.length > 0 && (
            <div className="space-y-1">
              <Label>Materials</Label>
              <p className="text-sm text-muted-foreground">
                {rate.material_names.map(m => m.name).join(', ')}
              </p>
            </div>
          )}

          {/* Zones */}
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

          {/* Price */}
          <div className="space-y-2">
            <Label>Price per MOQ (SAR, pre-tax)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={e => setPrice(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <div className="pt-4 border-t">
          <Button
            className="w-full"
            disabled={!selectedZones.length || !price || updateRate.isPending}
            onClick={() => updateRate.mutate()}
          >
            {updateRate.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
