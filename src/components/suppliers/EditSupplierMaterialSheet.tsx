import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import type { SupplierMaterial } from '@/hooks/useSupplierMaterials';

const editSchema = z.object({
  unit_price: z.number().nullable().optional(),
  moq: z.number().nullable().optional(),
  lead_time_days: z.number().nullable().optional(),
  notes: z.string().optional().default(''),
});

type EditFormData = z.infer<typeof editSchema>;

interface EditSupplierMaterialSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: SupplierMaterial | null;
}

export function EditSupplierMaterialSheet({ open, onOpenChange, material }: EditSupplierMaterialSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
  });

  useEffect(() => {
    if (open && material) {
      form.reset({
        unit_price: material.unit_price,
        moq: material.moq,
        lead_time_days: material.lead_time_days,
        notes: material.notes || '',
      });
    }
  }, [open, material]);

  const onSubmit = async (values: EditFormData) => {
    if (!material) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('supplier_materials')
        .update({
          unit_price: values.unit_price,
          moq: values.moq,
          lead_time_days: values.lead_time_days,
          notes: values.notes || null,
          updated_by: user?.id || null,
        })
        .eq('id', material.id);

      if (error) throw error;

      toast.success('Supplier material updated');
      queryClient.invalidateQueries({ queryKey: ['supplier-materials'] });
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to update');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Supplier Quote</SheetTitle>
          <SheetDescription>Update pricing and terms for this material.</SheetDescription>
        </SheetHeader>

        {material && (
          <div className="mt-4 p-3 rounded-md border bg-muted/30">
            <p className="text-sm font-medium">{material.material_name}</p>
            <div className="flex items-center gap-2 mt-1">
              {material.material_code && <span className="text-xs text-muted-foreground font-mono">{material.material_code}</span>}
              <Badge variant="secondary" className="text-xs">{material.material_uom}</Badge>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
            <FormField control={form.control} name="unit_price" render={({ field }) => (
              <FormItem>
                <FormLabel>Unit Price (SAR, pre-tax)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
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
              <FormField control={form.control} name="lead_time_days" render={({ field }) => (
                <FormItem>
                  <FormLabel>Lead Time (days)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="0" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea placeholder="Additional notes..." rows={3} className="resize-none" {...field} value={field.value ?? ''} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
