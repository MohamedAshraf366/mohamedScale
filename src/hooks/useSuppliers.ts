import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SupplierWithDetails {
  account_id: string;
  supplier_code: string | null;
  supplier_type: string;
  lead_time_days: number | null;
  rating: number | null;
  quality_grade: string | null;
  rating_notes: string | null;
  notes: string | null;
  bank_name: string | null;
  iban: string | null;
  created_at: string;
  updated_at: string;
  display_name: string | null;
  legal_name: string | null;
  status: string;
  website: string | null;
  tax_number: string | null;
  metadata: Record<string, unknown>;
  location_city: string | null;
  location_address: string | null;
  location_link: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  zone_id: string | null;
  zone_name: string | null;
  is_blacklisted: boolean;
}

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async (): Promise<SupplierWithDetails[]> => {
      const { data: suppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false });

      if (suppliersError) throw suppliersError;
      if (!suppliers || suppliers.length === 0) return [];

      const accountIds = suppliers.map(s => s.account_id);

      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('id, display_name, legal_name, status, website, tax_number, metadata, location_id, poc_contact_id')
        .in('id', accountIds).is('deleted_at', null);

      if (accountsError) throw accountsError;

      const visibleAccountIds = new Set((accounts || []).map(a => a.id));
      const filteredSuppliers = suppliers.filter(s => visibleAccountIds.has(s.account_id));
      if (filteredSuppliers.length === 0) return [];

      const locationIds = (accounts || []).map(a => a.location_id).filter(Boolean) as string[];
      const { data: locations } = await supabase
        .from('locations')
        .select('id, city, address_text, address_link, zone_code')
        .in('id', locationIds);

      const contactIds = (accounts || []).map(a => a.poc_contact_id).filter(Boolean) as string[];
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, full_name, phone, email')
        .in('id', contactIds);

      const zoneCodes = locations?.map(l => l.zone_code).filter(Boolean) as string[] || [];
      const { data: zones } = zoneCodes.length > 0
        ? await supabase.from('zones').select('id, name_ar, code').in('code', zoneCodes)
        : { data: [] as { id: string; name_ar: string | null; code: string | null }[] };

      const accountMap = new Map(accounts?.map(a => [a.id, a]) || []);
      const locationMap = new Map(locations?.map(l => [l.id, l]) || []);
      const contactMap = new Map(contacts?.map(c => [c.id, c]) || []);
      const zoneMap = new Map(zones?.map(z => [z.code, z]) || []);

      return filteredSuppliers.map(supplier => {
        const account = accountMap.get(supplier.account_id);
        const location = account?.location_id ? locationMap.get(account.location_id) : null;
        const contact = account?.poc_contact_id ? contactMap.get(account.poc_contact_id) : null;
        const locAny = location as any;
        const supplierAny = supplier as any;

        return {
          ...supplier,
          quality_grade: supplierAny.quality_grade ?? null,
          rating_notes: supplierAny.rating_notes ?? null,
          display_name: account?.display_name || null,
          legal_name: account?.legal_name || null,
          status: account?.status || 'active',
          website: account?.website || null,
          tax_number: account?.tax_number || null,
          metadata: (account?.metadata as Record<string, unknown>) || {},
          location_city: locAny?.city || null,
          location_address: locAny?.address_text || null,
          location_link: locAny?.address_link || null,
          contact_name: contact?.full_name || null,
          contact_phone: contact?.phone || null,
          contact_email: contact?.email || null,
          zone_id: locAny?.zone_code || null,
          zone_name: locAny?.zone_code ? (zoneMap.get(locAny.zone_code)?.name_ar || null) : null,
          is_blacklisted: supplier.is_blacklisted ?? false,
        };
      });
    },
  });
}
