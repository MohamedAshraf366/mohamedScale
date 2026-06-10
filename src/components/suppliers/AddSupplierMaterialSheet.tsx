import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Alert, AlertDescription,
} from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { MaterialStepPicker, type PickedMaterial } from '@/components/shared/MaterialStepPicker';
import {
  supplierMaterialFormSchema,
  type SupplierMaterialFormData,
} from '@/lib/supplier-material-schema';
import { useTargetPriceCheck } from '@/hooks/useTargetPrices';

interface AddSupplierMaterialSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  supplierAccountId?: string;
  supplierName?: string;
}

export function AddSupplierMaterialSheet({
  open,
  onOpenChange,
  onSuccess,
  supplierAccountId: fixedSupplierId,
  supplierName: fixedSupplierName,
}: AddSupplierMaterialSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pickedMaterial, setPickedMaterial] = useState<PickedMaterial | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const { data: hasTargetPrice, isLoading: checkingTargetPrice } = useTargetPriceCheck(pickedMaterial?.id ?? null);
  const noTargetPrice = pickedMaterial && hasTargetPrice === false;

  const form = useForm<SupplierMaterialFormData>({
    resolver: zodResolver(supplierMaterialFormSchema),
    defaultValues: {
      supplier_account_id: fixedSupplierId || '',
      material_id: '',
      unit_price: null,
      delivery_price: null,
      moq: null,
      lead_time_days: null,
      price_valid_until: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (open) {
      setPickedMaterial(null);
      setDuplicateWarning(null);
      form.reset({
        supplier_account_id: fixedSupplierId || '',
        material_id: '',
        unit_price: null,
        delivery_price: null,
        moq: null,
        lead_time_days: null,
        price_valid_until: '',
        notes: '',
      });
      if (!fixedSupplierId) fetchSuppliers();
    }
  }, [open, fixedSupplierId]);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      //const { data: supData } = await supabase.from('suppliers').select('account_id');
      const { data: supData } = await supabase
        .from('suppliers')
        .select('account_id')
        .eq('is_blacklisted', false);

      if (supData) {
        const accountIds = supData.map(s => s.account_id);
        const { data: currentQuotes } = await supabase
          .from('supplier_quotes')
          .select('supplier_account_id, status')
          .in('supplier_account_id', accountIds)
          .neq('status', 'superseded');

        const eligibleAccountIds = accountIds.filter((accountId) => {
          const supplierCurrent = (currentQuotes || []).filter(q => q.supplier_account_id === accountId);
          if (supplierCurrent.length === 0) return true;
          return supplierCurrent.some(q => q.status !== 'rejected');
        });

        const { data: accounts } = await supabase
          .from('accounts')
          .select('id, display_name')
          // .in('id', accountIds)
          //.in('id', accountIds)
          .in('id', eligibleAccountIds)
          .eq('status', 'active')
          .in('id', eligibleAccountIds)
          .is('deleted_at', null)
        setSuppliers(accounts?.map(a => ({ id: a.id, name: a.display_name || 'Unnamed' })) || []);
      }
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkDuplicate = async (supplierId: string, materialId: string) => {
    try {
      const { data } = await supabase
        .from('supplier_materials')
        .select('id, unit_price, status, is_current')
        .eq('supplier_account_id', supplierId)
        .eq('material_id', materialId)
        .eq('is_current', true)
        .maybeSingle();

      if (data) {
        const priceStr = data.unit_price != null ? `SAR ${data.unit_price.toLocaleString()}` : 'no price';
        setDuplicateWarning(
          `An active quote already exists for this material (${priceStr}, status: ${data.status}). Submitting will create a new version and pass the old one.`
        );
      } else {
        setDuplicateWarning(null);
      }
    } catch {
      setDuplicateWarning(null);
    }
  };

  const handleMaterialPicked = (material: PickedMaterial) => {
    setPickedMaterial(material);
    form.setValue('material_id', material.id);

    const supplierId = fixedSupplierId || form.getValues('supplier_account_id');
    if (supplierId) {
      checkDuplicate(supplierId, material.id);
    }
  };

  const clearMaterial = () => {
    setPickedMaterial(null);
    form.setValue('material_id', '');
    setDuplicateWarning(null);
  };

  const onSubmit = async (values: SupplierMaterialFormData) => {
    setSubmitting(true);
    try {
      // The trigger trg_supplier_materials_versioning_v1 handles:
      // - Auto-incrementing quote_version
      // - Setting is_current = true
      // - Passing previous current quote to 'passed' status
      const { error } = await supabase
        .from('supplier_materials')
        .insert({
          supplier_account_id: values.supplier_account_id,
          material_id: values.material_id,
          unit_price: values.unit_price,
          delivery_price: values.delivery_price,
          moq: values.moq,
          lead_time_days: values.lead_time_days,
          price_valid_until: values.price_valid_until || null,
          notes: values.notes || null,
          status: 'submitted',
          quote_version: 0,
          created_by: user?.id || null,
        });

      if (error) throw error;

      toast.success('Supplier material added successfully');
      queryClient.invalidateQueries({ queryKey: ['supplier-materials'] });
      form.reset();
      setPickedMaterial(null);
      setDuplicateWarning(null);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('[AddSupplierMaterial] Error:', error);
      toast.error('Failed to add supplier material');
    } finally {
      setSubmitting(false);
    }
  };

  const isSupplierLocked = !!fixedSupplierId;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Supplier Quote</SheetTitle>
          <SheetDescription>
            Add a new material quote from a supplier for review
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
              {/* Supplier */}
              {isSupplierLocked ? (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Supplier</label>
                  <div className="p-2.5 rounded-md border bg-muted/30 text-sm font-medium">
                    {fixedSupplierName || fixedSupplierId}
                  </div>
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="supplier_account_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier *</FormLabel>
                      <Select onValueChange={(val) => {
                        field.onChange(val);
                        if (pickedMaterial) checkDuplicate(val, pickedMaterial.id);
                      }} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select supplier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover">
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Material — multi-step picker */}
              <FormField
                control={form.control}
                name="material_id"
                render={() => (
                  <FormItem>
                    <FormLabel>Material *</FormLabel>
                    {pickedMaterial ? (
                      <div className="flex items-center gap-2 p-2.5 rounded-md border bg-muted/30">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium block truncate">{pickedMaterial.name}</span>
                          {pickedMaterial.code && (
                            <span className="text-xs text-muted-foreground font-mono">{pickedMaterial.code}</span>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs shrink-0">{pickedMaterial.uom}</Badge>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={clearMaterial}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-md border p-3">
                        <MaterialStepPicker onSelect={handleMaterialPicked} />
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Duplicate warning */}
              {duplicateWarning && (
                <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {duplicateWarning}
                  </AlertDescription>
                </Alert>
              )}

              {/* Target price warning */}
              {noTargetPrice && (
                <Alert className="border-amber-500/50 bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
                    No target price set for this material. A target price will be required before approval.
                  </AlertDescription>
                </Alert>
              )}

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="unit_price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price (SAR, pre-tax)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="moq" render={({ field }) => (
                  <FormItem>
                    <FormLabel>MOQ (override)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Leave blank to use material default" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Leave blank to use material default</p>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="lead_time_days" render={({ field }) => (
                <FormItem>
                  <FormLabel>Lead Time (days)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="0" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any additional notes about this quote..." className="resize-none" rows={3} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</> : 'Add Quote'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </SheetContent>
    </Sheet>
  );
}
