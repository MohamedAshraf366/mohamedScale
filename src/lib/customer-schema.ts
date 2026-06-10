import { z } from 'zod';

// Contact schema
export const contactSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').max(100),
  phone: z.string().min(1, 'Phone is required').max(20),
  email: z.string().email('Invalid email').max(255).optional().or(z.literal('')),
  role_title: z.string().max(100).optional().or(z.literal('')),
  is_primary: z.boolean().default(false),
  prefers_whatsapp: z.boolean().default(true),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

// Location schema - all fields optional, any field is enough to include it
export const locationSchema = z.object({
  address_text: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  country: z.string().max(100).optional().or(z.literal('')),
  address_link: z.string().url().max(500).optional().or(z.literal('')),
  place_name: z.string().max(200).optional().or(z.literal('')),
  place_id: z.string().max(200).optional().or(z.literal('')),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  region_code: z.string().max(10).optional().or(z.literal('')).default('RYD'),
  zone_code: z.string().nullable().optional(),
});

// Custom field schema
export const customFieldSchema = z.object({
  key: z.string().min(1, 'Field name is required').max(100),
  value: z.string().max(1000),
});

// Customer type options
export const CUSTOMER_TYPES = [
  { value: 'SME', label: 'SME' },
  { value: 'RED', label: 'RED' },
  { value: 'Large Contractor', label: 'Large Contractor' },
  { value: 'Individual', label: 'Individual' },
  { value: 'Other', label: 'Other' },
] as const;

export const LIFECYCLE_STAGES = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'lead', label: 'Lead' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'blacklisted', label: 'Blacklisted' },
  { value: 'churned', label: 'Churned' },
] as const;

export type CustomerType = typeof CUSTOMER_TYPES[number]['value'];

// Main customer form schema
export const customerFormSchema = z.object({
  // Customer Type
  customer_type: z.enum(['SME', 'RED', 'Large Contractor', 'Individual', 'Other']).default('SME'),
  
  // Account Details
  display_name: z.string().min(1, 'Company/Customer name is required').max(200),
  legal_name: z.string().max(200).optional().or(z.literal('')),
  tax_number: z.string().max(50).optional().or(z.literal('')),
  website: z.string().url('Invalid URL').max(500).optional().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'blocked']).default('active'),
  account_notes: z.string().max(2000).optional().or(z.literal('')),
  
  // Contacts
  contacts: z.array(contactSchema).min(1, 'At least one contact is required'),
  
  // Location (single, optional)
  location: locationSchema.nullable().optional(),
  
  // Customer Settings
  lifecycle_stage: z.enum(['lead', 'prospect', 'active', 'inactive']).nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  payment_terms_days: z.number().int().min(0).max(365).nullable().optional(),
  credit_limit: z.number().min(0).nullable().optional(),
  pricing_tier: z.string().max(50).optional().or(z.literal('')),
  customer_notes: z.string().max(2000).optional().or(z.literal('')),
  
  // Custom Fields
  custom_fields: z.array(customFieldSchema).optional().default([]),
});

export type CustomerFormData = z.infer<typeof customerFormSchema>;
export type ContactData = z.infer<typeof contactSchema>;
export type LocationData = z.infer<typeof locationSchema>;
export type CustomFieldData = z.infer<typeof customFieldSchema>;

// Helper to clean empty optional fields
export const cleanOptionalFields = <T extends Record<string, unknown>>(obj: T): Partial<T> => {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== '' && value !== null && value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned as Partial<T>;
};

// Transform form data to n8n payload
export const transformToPayload = (
  data: CustomerFormData,
  actorUserId: string | null,
  staffPhone: string | null
) => {
  // Clean accounts data
  const accounts = cleanOptionalFields({
    display_name: data.display_name,
    legal_name: data.legal_name || undefined,
    status: data.status,
    tax_number: data.tax_number || undefined,
    website: data.website || undefined,
    notes: data.account_notes || undefined,
  });

  // Clean contacts data
  const contacts = data.contacts.map(contact => cleanOptionalFields({
    full_name: contact.full_name,
    phone: contact.phone,
    email: contact.email || undefined,
    role_title: contact.role_title || undefined,
    is_primary: contact.is_primary,
    prefers_whatsapp: contact.prefers_whatsapp,
    notes: contact.notes || undefined,
  }));

  // Clean location data - only include if any field is filled
  let locations: Record<string, unknown>[] = [];
  if (data.location) {
    const cleanedLocation = cleanOptionalFields({
      address_text: data.location.address_text || undefined,
      city: data.location.city || undefined,
      country: data.location.country || undefined,
      address_link: data.location.address_link || undefined,
      place_name: data.location.place_name || undefined,
      place_id: data.location.place_id || undefined,
      lat: data.location.lat ?? undefined,
      lng: data.location.lng ?? undefined,
      region_code: data.location.region_code || 'RYD',
      zone_code: data.location.zone_code ?? undefined,
    });
    // Only add if at least one field is present
    if (Object.keys(cleanedLocation).length > 0) {
      locations = [cleanedLocation];
    }
  }

  // Clean customers data
  const customers = cleanOptionalFields({
    customer_type: data.customer_type,
    lifecycle_stage: data.lifecycle_stage || undefined,
    assigned_to: data.assigned_to ?? undefined,
    payment_terms_days: data.payment_terms_days ?? undefined,
    credit_limit: data.credit_limit ?? undefined,
    pricing_tier: data.pricing_tier || undefined,
    notes: data.customer_notes || undefined,
  });

  // Build unmapped from custom fields
  const unmapped: Record<string, string> = {};
  data.custom_fields?.forEach(field => {
    if (field.key && field.value) {
      unmapped[field.key] = field.value;
    }
  });

  return {
    channel: 'lovable',
    lang: 'en',
    action: 'plan',
    tool: 'add_customer.v1',
    actor_user_id: actorUserId || '',
    staff_phone: staffPhone || '',
    input: {
      accounts,
      contacts,
      locations,
      customers,
      unmapped,
    },
  };
};
