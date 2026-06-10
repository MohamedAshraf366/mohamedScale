import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supplierFormSchema, type SupplierFormData } from '@/lib/supplier-schema';
import { MapLocationPicker } from '@/components/customers/MapLocationPicker';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Building2, Loader2, Save, Factory, Store, Truck, MapPin } from 'lucide-react';
import { SupplierRatingInput } from './SupplierRatingInput';

interface EditSupplierSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: {
    account_id: string;
    supplier_type: string;
    supplier_code: string | null;
    lead_time_days: number | null;
    rating: number | null;
    rating_price: number | null;
    rating_quality: number | null;
    rating_delivery: number | null;
    rating_responsiveness: number | null;
    bank_name: string | null;
    iban: string | null;
    notes: string | null;
    account?: {
      display_name: string | null;
      legal_name: string | null;
      tax_number: string | null;
      website: string | null;
      status: string;
      notes: string | null;
      location_id: string | null;
      location?: {
        id: string;
        address_text: string | null;
        city: string | null;
        country: string;
        address_link: string | null;
        place_name: string | null;
        place_id: string | null;
        lat: number | null;
        lng: number | null;
        zone_code: string | null;
      } | null;
    } | null;
  } | null;
}

export function EditSupplierSheet({ open, onOpenChange, supplier }: EditSupplierSheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierFormSchema),
  });

  useEffect(() => {
    if (open && supplier) {
      const loc = supplier.account?.location;
      form.reset({
        display_name: supplier.account?.display_name || '',
        legal_name: supplier.account?.legal_name || '',
        tax_number: supplier.account?.tax_number || '',
        website: supplier.account?.website || '',
        status: (supplier.account?.status as 'active' | 'inactive' | 'blocked') || 'active',
        account_notes: supplier.account?.notes || '',
        supplier_type: (supplier.supplier_type as 'manufacturer' | 'store' | 'distributor') || 'store',
        supplier_code: supplier.supplier_code || '',
        lead_time_days: supplier.lead_time_days,
        rating: supplier.rating,
        quality_grade: (supplier as any).quality_grade ?? null,
        rating_notes: (supplier as any).rating_notes || '',
        bank_name: supplier.bank_name || '',
        iban: supplier.iban || '',
        supplier_notes: supplier.notes || '',
        contact: null,
        location: loc ? {
          address_text: loc.address_text || '',
          city: loc.city || '',
          country: loc.country || 'SA',
          address_link: loc.address_link || '',
          place_name: loc.place_name || '',
          place_id: loc.place_id || '',
          lat: loc.lat,
          lng: loc.lng,
          region_code: 'RYD',
          zone_code: loc.zone_code,
        } : null,
      });
    }
  }, [open, supplier]);

  const onSubmit = async (data: SupplierFormData) => {
    if (!supplier) return;

    setIsSubmitting(true);
    try {
      // Handle location upsert
      let locationId = supplier.account?.location_id || null;
      const locData = data.location;
      const hasLocation = locData && (locData.address_text || locData.city || locData.lat);

      if (hasLocation) {
        const locationPayload = {
          address_text: locData.address_text || null,
          city: locData.city || null,
          country: locData.country || 'SA',
          address_link: locData.address_link || null,
          place_name: locData.place_name || null,
          place_id: locData.place_id || null,
          lat: locData.lat ?? null,
          lng: locData.lng ?? null,
          region_code: locData.region_code || 'RYD',
          zone_code: locData.zone_code || null,
          updated_by: user?.id || null,
        };

        if (locationId) {
          const { error: locErr } = await supabase
            .from('locations')
            .update(locationPayload as any)
            .eq('id', locationId);
          if (locErr) throw locErr;
        } else {
          const { data: newLoc, error: locErr } = await supabase
            .from('locations')
            .insert({ ...locationPayload, created_by: user?.id || null } as any)
            .select('id')
            .single();
          if (locErr) throw locErr;
          locationId = newLoc.id;
        }
      }

      // Update account
      const { error: accErr } = await supabase
        .from('accounts')
        .update({
          display_name: data.display_name,
          status: data.status,
          legal_name: data.legal_name || null,
          tax_number: data.tax_number || null,
          website: data.website || null,
          notes: data.account_notes || null,
          location_id: locationId,
          updated_by: user?.id || null,
        }).is('deleted_at', null)
        .eq('id', supplier.account_id);
      if (accErr) throw accErr;

      // Update supplier
      const { error: supErr } = await supabase
        .from('suppliers')
        .update({
          supplier_type: data.supplier_type,
          lead_time_days: data.lead_time_days,
          rating: data.rating,
          quality_grade: data.quality_grade ?? null,
          rating_notes: data.rating_notes || null,
          bank_name: data.bank_name || null,
          iban: data.iban || null,
          notes: data.supplier_notes || null,
          updated_by: user?.id || null,
        })
        .eq('account_id', supplier.account_id);
      if (supErr) throw supErr;

      toast({ title: 'Supplier Updated' });
      queryClient.invalidateQueries({ queryKey: ['supplier-detail'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Edit Supplier
          </SheetTitle>
          <SheetDescription>Update supplier details.</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <Form {...form}>
            <form id="edit-supplier-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Basic Info</h3>

                <FormField control={form.control} name="display_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Name *</FormLabel>
                    <FormControl><Input placeholder="Enter supplier name..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="supplier_type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="store"><div className="flex items-center gap-2"><Store className="h-4 w-4" />Store</div></SelectItem>
                          <SelectItem value="manufacturer"><div className="flex items-center gap-2"><Factory className="h-4 w-4" />Manufacturer</div></SelectItem>
                          <SelectItem value="distributor"><div className="flex items-center gap-2"><Truck className="h-4 w-4" />Distributor</div></SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="blocked">Blocked</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="lead_time_days" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Time (days)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g. 3" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <Separator />

              {/* Rating Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Rating</h3>
                <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                  <SupplierRatingInput
                    label="Overall Rating"
                    value={form.watch('rating') ?? null}
                    onChange={(v) => form.setValue('rating', v)}
                  />

                  <FormField control={form.control} name="quality_grade" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quality Grade</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select grade..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="not_accepted">Not Accepted</SelectItem>
                          <SelectItem value="accepted">Accepted</SelectItem>
                          <SelectItem value="high_quality">High Quality</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="rating_notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rating Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Notes about this supplier's performance..." {...field} value={field.value ?? ''} rows={2} />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
              </div>

              <Separator />

              {/* Location Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Location
                </h3>
                <div className="p-4 border rounded-lg bg-muted/30">
                  <MapLocationPicker
                    initialLat={form.watch('location.lat')}
                    initialLng={form.watch('location.lng')}
                    onLocationSelect={(loc) => {
                      form.setValue('location', {
                        address_text: loc.address_text || '',
                        city: loc.city || '',
                        country: loc.country || 'SA',
                        address_link: loc.address_link || '',
                        place_name: loc.place_name || '',
                        place_id: loc.place_id || '',
                        lat: loc.lat,
                        lng: loc.lng,
                        region_code: loc.region_code || 'RYD',
                        zone_code: loc.zone_code,
                      });
                    }}
                  />
                  {form.watch('location.city') && (
                    <p className="text-xs text-muted-foreground mt-2">
                      📍 {form.watch('location.city')}{form.watch('location.address_text') ? ` — ${form.watch('location.address_text')?.slice(0, 60)}` : ''}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Additional</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="legal_name" render={({ field }) => (
                    <FormItem><FormLabel>Legal Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="tax_number" render={({ field }) => (
                    <FormItem><FormLabel>Tax Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="website" render={({ field }) => (
                  <FormItem><FormLabel>Website</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="bank_name" render={({ field }) => (
                    <FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="iban" render={({ field }) => (
                    <FormItem><FormLabel>IBAN</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="account_notes" render={({ field }) => (
                  <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={3} className="resize-none" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </form>
          </Form>
        </ScrollArea>

        <div className="border-t px-6 py-4 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="edit-supplier-form" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save Changes</>}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
