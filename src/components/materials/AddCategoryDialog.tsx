import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

interface AddCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}

export function AddCategoryDialog({ open, onOpenChange, onCreated }: AddCategoryDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [code2, setCode2] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [defaultUom, setDefaultUom] = useState('unit');
  const [defaultMoq, setDefaultMoq] = useState<number | null>(null);
  const [defaultLeadTimeDays, setDefaultLeadTimeDays] = useState<number | null>(null);
  const [defaultDeliveryTimeDays, setDefaultDeliveryTimeDays] = useState<number | null>(null);
  const [defaultOrderWindowDays, setDefaultOrderWindowDays] = useState<number | null>(null);
  const [defaultOrderCutoffLocal, setDefaultOrderCutoffLocal] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCode2('');
    setNameEn('');
    setNameAr('');
    setDefaultUom('unit');
    setDefaultMoq(null);
    setDefaultLeadTimeDays(null);
    setDefaultDeliveryTimeDays(null);
    setDefaultOrderWindowDays(null);
    setDefaultOrderCutoffLocal('');
    setShowAdvanced(false);
  };

  const handleSubmit = async () => {
    const trimCode = code2.trim().toUpperCase();
    const trimName = nameEn.trim();
    if (trimCode.length !== 2) {
      toast.error('Code must be exactly 2 characters (e.g. CO, RB, SD)');
      return;
    }
    if (!/^[A-Z]{2}$/.test(trimCode)) {
    toast.error('Code must contain only letters A-Z (e.g. CO, RB, SD)');
    return;
  }
    if (!trimName) {
      toast.error('Name (EN) is required');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('material_categories')
        .insert({
          code2: trimCode,
          name_en: trimName,
          name_ar: nameAr.trim() || null,
          default_uom: defaultUom || null,
          default_moq: defaultMoq,
          default_lead_time_days: defaultLeadTimeDays,
          default_delivery_time_days: defaultDeliveryTimeDays,
          default_order_window_days: defaultOrderWindowDays,
          default_order_cutoff_local: defaultOrderCutoffLocal || null,
          created_by: user?.id || null,
        })
        .select('id')
        .single();

      if (error) throw error;

      toast.success(`Category "${trimName}" created`);
      queryClient.invalidateQueries({ queryKey: ['materials-registry'] });
      onCreated(data.id);
      reset();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to create category');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Category</DialogTitle>
          <DialogDescription>
            Create a top-level material category (e.g. Concrete, Rebar, Sand)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label>Code (2)</Label>
                <Input
                  value={code2}
                  onChange={(e) => {
                    // السماح فقط بالحروف A-Z وتحويلها لكبيرة تلقائياً
                    const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
                    setCode2(value.slice(0, 2));
                  }}
                  placeholder="CO"
                  maxLength={2}
                  className="font-mono uppercase"
                />
            </div>
            <div className="space-y-1.5">
              <Label>Name (EN)</Label>
              <Input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="Concrete"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name (AR)</Label>
              <Input
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder="خرسانة"
                dir="rtl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Default UOM</Label>
              <Select value={defaultUom} onValueChange={setDefaultUom}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="piece">Piece</SelectItem>
                  <SelectItem value="unit">Unit</SelectItem>
                  <SelectItem value="m3">m³</SelectItem>
                  <SelectItem value="ton">Ton</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="m2">m²</SelectItem>
                  <SelectItem value="m">m</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced defaults */}
          {!showAdvanced ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => setShowAdvanced(true)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Set operational defaults (MOQ, lead time…)
            </Button>
          ) : (
            <>
              <Separator />
              <p className="text-xs text-muted-foreground">
                These defaults are inherited by subcategories and materials unless overridden.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Default MOQ</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="e.g. 10"
                    value={defaultMoq ?? ''}
                    onChange={(e) => setDefaultMoq(e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Lead Time (days)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="e.g. 3"
                    value={defaultLeadTimeDays ?? ''}
                    onChange={(e) => setDefaultLeadTimeDays(e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Delivery Time (days)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="e.g. 1"
                    value={defaultDeliveryTimeDays ?? ''}
                    onChange={(e) => setDefaultDeliveryTimeDays(e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Order Window (days)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="e.g. 7"
                    value={defaultOrderWindowDays ?? ''}
                    onChange={(e) => setDefaultOrderWindowDays(e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Order Cutoff Time (local)</Label>
                <Input
                  type="time"
                  value={defaultOrderCutoffLocal}
                  onChange={(e) => setDefaultOrderCutoffLocal(e.target.value)}
                  placeholder="e.g. 14:00"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
