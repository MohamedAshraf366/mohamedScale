import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { MapLocationPicker } from '@/components/customers/MapLocationPicker';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  supplierFormSchema,
  SupplierFormData,
} from '@/lib/supplier-schema';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Building2,
  User,
  MapPin,
  Loader2,
  Send,
  ChevronDown,
  Factory,
  Store,
  Truck,
} from 'lucide-react';

interface AddSupplierSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** Emits the new account id + display name once the supplier is created. */
  onCreated?: (accountId: string, name: string) => void;
}

export function AddSupplierSheet({ open, onOpenChange, onSuccess, onCreated }: AddSupplierSheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      display_name: '',
      legal_name: '',
      tax_number: '',
      website: '',
      status: 'active',
      account_notes: '',
      supplier_type: 'store',
      supplier_code: '',
      lead_time_days: null,
      rating: null,
      bank_name: '',
      iban: '',
      supplier_notes: '',
      contact: null,
      location: null,
    },
  });

  const handleAddContact = () => {
    form.setValue('contact', {
      full_name: '',
      phone: '',
      email: '',
      role_title: '',
      prefers_whatsapp: true,
      notes: '',
    });
    setContactOpen(true);
  };

  const handleRemoveContact = () => {
    form.setValue('contact', null);
    setContactOpen(false);
  };

  const handleAddLocation = () => {
    form.setValue('location', {
      address_text: '',
      city: '',
      country: 'SA',
      address_link: '',
      place_name: '',
      place_id: '',
      lat: null,
      lng: null,
      region_code: 'RYD',
      zone_code: null,
    });
    setLocationOpen(true);
  };

  const handleRemoveLocation = () => {
    form.setValue('location', null);
    setLocationOpen(false);
  };

  const onSubmit = async (data: SupplierFormData) => {
    setIsSubmitting(true);
    try {
      const hasContact = data.contact && data.contact.full_name;
      const hasLocation = data.location && (data.location.address_text || data.location.city);

      // 1. Create location if provided
      let locationId: string | null = null;
      if (hasLocation) {
        const { data: loc, error: locErr } = await supabase
          .from('locations')
          .insert({
            address_text: data.location!.address_text || null,
            city: data.location!.city || null,
            country: data.location!.country || 'SA',
            address_link: data.location!.address_link || null,
            place_name: data.location!.place_name || null,
            place_id: data.location!.place_id || null,
            lat: data.location!.lat,
            lng: data.location!.lng,
            region_code: data.location!.region_code || 'RYD',
            zone_code: data.location!.zone_code || null,
            created_by: user?.id || null,
          } as any)
          .select('id')
          .single();
        if (locErr) throw locErr;
        locationId = loc.id;
      }

      // 2. Create account
      const { data: account, error: accErr } = await supabase
        .from('accounts')
        .insert({
          display_name: data.display_name,
          status: data.status,
          legal_name: data.legal_name || null,
          tax_number: data.tax_number || null,
          website: data.website || null,
          notes: data.account_notes || null,
          location_id: locationId,
          created_by: user?.id || null,
          metadata: { account_kind: 'company' },
        }).is('deleted_at', null)
        .select('id')
        .single();
      if (accErr) throw accErr;

      // 3. Create supplier record
      const { error: supErr } = await supabase.from('suppliers').insert({
        account_id: account.id,
        supplier_type: data.supplier_type,
        lead_time_days: data.lead_time_days,
        rating: data.rating,
        bank_name: data.bank_name || null,
        iban: data.iban || null,
        notes: data.supplier_notes || null,
        created_by: user?.id || null,
      });
      if (supErr) throw supErr;

      // 4. Create contact if provided
      if (hasContact) {
        const { data: contact, error: contErr } = await supabase
          .from('contacts')
          .insert({
            account_id: account.id,
            full_name: data.contact!.full_name!,
            phone: data.contact!.phone || null,
            email: data.contact!.email || null,
            role_title: data.contact!.role_title || null,
            is_primary: true,
            prefers_whatsapp: data.contact!.prefers_whatsapp,
            notes: data.contact!.notes || null,
            created_by: user?.id || null,
          })
          .select('id')
          .single();
        if (contErr) throw contErr;

        // Set POC on account
        await supabase
          .from('accounts')
          .update({ poc_contact_id: contact.id }).is('deleted_at', null)
          .eq('id', account.id);
      }

      toast({
        title: 'Supplier Created',
        description: 'The supplier has been successfully added.',
      });

      onCreated?.(account.id, data.display_name);
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error creating supplier:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create supplier',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasContact = form.watch('contact') !== null;
  const hasLocation = form.watch('location') !== null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Add Supplier
          </SheetTitle>
          <SheetDescription>
            Add a new supplier to your vendor directory.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <Form {...form}>
            <form
              id="add-supplier-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6 py-4"
            >
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Basic Info
                </h3>
                
                <FormField
                  control={form.control}
                  name="display_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter supplier name..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="supplier_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="store">
                              <div className="flex items-center gap-2">
                                <Store className="h-4 w-4" />
                                Store
                              </div>
                            </SelectItem>
                            <SelectItem value="manufacturer">
                              <div className="flex items-center gap-2">
                                <Factory className="h-4 w-4" />
                                Manufacturer
                              </div>
                            </SelectItem>
                            <SelectItem value="distributor">
                              <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4" />
                                Distributor
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="blocked">Blocked</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="lead_time_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lead Time (days)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="e.g. 3"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.value ? parseInt(e.target.value) : null)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Additional Details (Collapsible) */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" type="button" className="w-full justify-between">
                    <span className="text-sm font-medium">Additional Details</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="legal_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Legal Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Legal entity name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="tax_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tax Number</FormLabel>
                          <FormControl>
                            <Input placeholder="VAT/Tax ID" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="bank_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Bank name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="iban"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IBAN</FormLabel>
                          <FormControl>
                            <Input placeholder="SA..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="account_notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Additional notes..."
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Contact Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Contact Person
                  </h3>
                  {!hasContact ? (
                    <Button type="button" variant="outline" size="sm" onClick={handleAddContact}>
                      Add Contact
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={handleRemoveContact}
                    >
                      Remove
                    </Button>
                  )}
                </div>

                {hasContact && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <FormField
                      control={form.control}
                      name="contact.full_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Contact name" {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="contact.phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <PhoneInput
                                value={field.value ?? ''}
                                onChange={field.onChange}
                                placeholder="5XX XXX XXXX"
                                defaultCountry="966"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="contact.email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input placeholder="email@example.com" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="contact.role_title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role/Title</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Sales Manager" {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="contact.prefers_whatsapp"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <FormLabel>Prefers WhatsApp</FormLabel>
                          <FormControl>
                            <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>

              <Separator />

              {/* Location Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </h3>
                  {!hasLocation ? (
                    <Button type="button" variant="outline" size="sm" onClick={handleAddLocation}>
                      Add Location
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={handleRemoveLocation}
                    >
                      Remove
                    </Button>
                  )}
                </div>

                {hasLocation && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <MapLocationPicker
                      initialLat={form.watch('location.lat')}
                      initialLng={form.watch('location.lng')}
                      onLocationSelect={(loc) => {
                        form.setValue('location.address_text', loc.address_text);
                        form.setValue('location.city', loc.city);
                        form.setValue('location.country', loc.country || 'SA');
                        form.setValue('location.address_link', loc.address_link);
                        form.setValue('location.place_name', loc.place_name);
                        form.setValue('location.place_id', loc.place_id);
                        form.setValue('location.lat', loc.lat);
                        form.setValue('location.lng', loc.lng);
                        form.setValue('location.region_code', loc.region_code || 'RYD');
                        form.setValue('location.zone_code', loc.zone_code);
                      }}
                    />
                    {form.watch('location.city') && (
                      <p className="text-xs text-muted-foreground">
                        📍 {form.watch('location.city')}{form.watch('location.address_text') ? ` — ${form.watch('location.address_text')?.slice(0, 60)}` : ''}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </form>
          </Form>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="add-supplier-form" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Add Supplier
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
