import { z } from 'zod';

export const supplierQualityOptions = ['not_accepted', 'accepted', 'high_quality'] as const;

export const supplierFormSchema = z.object({
  display_name: z.string().min(1, 'Supplier name is required'),
  legal_name: z.string().optional().default(''),
  tax_number: z.string().optional().default(''),
  website: z.string().optional().default(''),
  status: z.enum(['active', 'inactive', 'blocked']).default('active'),
  account_notes: z.string().optional().default(''),

  supplier_type: z.enum(['manufacturer', 'store', 'distributor']).default('store'),
  supplier_code: z.string().optional().default(''),
  lead_time_days: z.number().nullable().optional(),
  rating: z.number().min(1).max(5).nullable().optional(),
  quality_grade: z.enum(supplierQualityOptions).nullable().optional(),
  rating_notes: z.string().optional().default(''),
  bank_name: z.string().optional().default(''),
  iban: z.string().optional().default(''),
  supplier_notes: z.string().optional().default(''),

  contact: z.object({
    full_name: z.string().optional().default(''),
    phone: z.string().optional().default(''),
    email: z.string().email().optional().or(z.literal('')).default(''),
    role_title: z.string().optional().default(''),
    prefers_whatsapp: z.boolean().default(true),
    notes: z.string().optional().default(''),
  }).nullable().default(null),

  location: z.object({
    address_text: z.string().optional().default(''),
    city: z.string().optional().default(''),
    country: z.string().optional().default('SA'),
    address_link: z.string().optional().default(''),
    place_name: z.string().optional().default(''),
    place_id: z.string().optional().default(''),
    lat: z.number().nullable().optional(),
    lng: z.number().nullable().optional(),
    region_code: z.string().optional().default('RYD'),
    zone_code: z.string().nullable().optional(),
  }).nullable().default(null),
});

export type SupplierFormData = z.infer<typeof supplierFormSchema>;

export function transformSupplierToPayload(
  data: SupplierFormData,
  actorUserId: string | null,
  staffPhone: string | null
) {
  const hasContact = data.contact && data.contact.full_name;
  const hasLocation = data.location && (data.location.address_text || data.location.city);

  const accounts: Record<string, unknown> = {
    account_kind: 'company',
    display_name: data.display_name,
    status: data.status,
  };
  if (data.legal_name) accounts.legal_name = data.legal_name;
  if (data.tax_number) accounts.tax_number = data.tax_number;
  if (data.website) accounts.website = data.website;
  if (data.account_notes) accounts.notes = data.account_notes;

  const suppliers: Record<string, unknown> = {
    supplier_type: data.supplier_type,
  };
  if (data.lead_time_days != null) suppliers.lead_time_days = data.lead_time_days;
  if (data.rating != null) suppliers.rating = data.rating;
  if (data.quality_grade) suppliers.quality_grade = data.quality_grade;
  if (data.rating_notes) suppliers.rating_notes = data.rating_notes;
  if (data.bank_name) suppliers.bank_name = data.bank_name;
  if (data.iban) suppliers.iban = data.iban;
  if (data.supplier_notes) suppliers.notes = data.supplier_notes;

  const contacts: Record<string, unknown>[] = [];
  if (hasContact) {
    const contact: Record<string, unknown> = {
      full_name: data.contact!.full_name,
      is_primary: true,
      prefers_whatsapp: data.contact!.prefers_whatsapp,
    };
    if (data.contact!.phone) contact.phone = data.contact!.phone;
    if (data.contact!.email) contact.email = data.contact!.email;
    if (data.contact!.role_title) contact.role_title = data.contact!.role_title;
    if (data.contact!.notes) contact.notes = data.contact!.notes;
    contacts.push(contact);
  }

  const locations: Record<string, unknown>[] = [];
  if (hasLocation) {
    const location: Record<string, unknown> = {
      country: data.location!.country || 'SA',
    };
    if (data.location!.address_text) location.address_text = data.location!.address_text;
    if (data.location!.city) location.city = data.location!.city;
    if (data.location!.address_link) location.address_link = data.location!.address_link;
    if (data.location!.place_name) location.place_name = data.location!.place_name;
    if (data.location!.place_id) location.place_id = data.location!.place_id;
    if (data.location!.lat) location.lat = data.location!.lat;
    if (data.location!.lng) location.lng = data.location!.lng;
    if (data.location!.zone_code) location.zone_code = data.location!.zone_code;
    if (data.location!.region_code) location.region_code = data.location!.region_code;
    locations.push(location);
  }

  return {
    channel: 'lovable',
    lang: 'en',
    action: 'plan',
    tool: 'add_supplier.v1',
    actor_user_id: actorUserId || '',
    staff_phone: staffPhone || '',
    input: {
      accounts,
      contacts,
      locations,
      suppliers,
    },
  };
}
