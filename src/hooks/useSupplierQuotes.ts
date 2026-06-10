import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SupplierQuoteStatus = 'submitted' | 'under_review' | 'rejected' | 'negotiating' | 'approved' | 'superseded';

export interface SupplierQuoteItem {
  id: string;
  supplier_quote_id: string;
  material_id: string;
  unit_price: number | null;
  moq: number | null;
  lead_time_days: number | null;
  delivery_price: number | null;
  notes: string | null;
  status: string;
  is_current: boolean;
  quote_version: number;
  created_at: string;
  material_name: string | null;
  material_code: string | null;
  material_uom: string | null;
}

export interface SupplierQuote {
  id: string;
  supplier_account_id: string;
  supplier_name: string | null;
  status: SupplierQuoteStatus;
  source: string;
  notes: string | null;
  submitted_at: string;
  valid_until: string | null;
  created_at: string;
  items: SupplierQuoteItem[];
  delivery_lines: SupplierQuoteDeliveryLine[];
}

export interface SupplierQuoteDeliveryLine {
  id: string;
  supplier_quote_id: string;
  zone_codes: string[];
  price_per_moq: number;
  material_ids: string[];
  notes: string | null;
}

export function useSupplierQuotes(statusFilter?: SupplierQuoteStatus | 'all') {
  return useQuery({
    queryKey: ['supplier-quotes', statusFilter],
    queryFn: async (): Promise<SupplierQuote[]> => {
      let quotesQuery = supabase
        .from('supplier_quotes')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        quotesQuery = quotesQuery.eq('status', statusFilter);
      }

      const { data: quotes, error: qErr } = await quotesQuery;
      if (qErr) throw qErr;
      if (!quotes || quotes.length === 0) return [];

      const quoteIds = quotes.map(q => q.id);
      const supplierIds = [...new Set(quotes.map(q => q.supplier_account_id))];

      const [itemsRes, deliveryRes, accountsRes] = await Promise.all([
        supabase
          .from('supplier_materials')
          .select('*')
          .in('supplier_quote_id', quoteIds)
          .eq('is_current', true),
        supabase
          .from('supplier_quote_delivery_lines')
          .select('*')
          .in('supplier_quote_id', quoteIds),
        supabase
          .from('accounts')
          .select('id, display_name').is('deleted_at', null)
          .in('id', supplierIds),
      ]);

      const materialIds = [...new Set((itemsRes.data || []).map(i => i.material_id))];
      const materialsRes = materialIds.length > 0
        ? await supabase.from('materials').select('id, name, code, uom').in('id', materialIds)
        : { data: [] as Array<{ id: string; name: string; code: string | null; uom: string }> };

      const accountMap = new Map((accountsRes.data || []).map(a => [a.id, a] as const));
      const materialMap = new Map((materialsRes.data || []).map(m => [m.id, m] as const));

      const itemsByQuote = new Map<string, typeof itemsRes.data>();
      (itemsRes.data || []).forEach(item => {
        const arr = itemsByQuote.get(item.supplier_quote_id!) || [];
        arr.push(item);
        itemsByQuote.set(item.supplier_quote_id!, arr);
      });

      const deliveryByQuote = new Map<string, typeof deliveryRes.data>();
      (deliveryRes.data || []).forEach(dl => {
        const arr = deliveryByQuote.get(dl.supplier_quote_id) || [];
        arr.push(dl);
        deliveryByQuote.set(dl.supplier_quote_id, arr);
      });

      return quotes.map(q => {
        const account = accountMap.get(q.supplier_account_id);
        const items = (itemsByQuote.get(q.id) || []).map(item => {
          const mat = materialMap.get(item.material_id);
          return {
            id: item.id,
            supplier_quote_id: item.supplier_quote_id!,
            material_id: item.material_id,
            unit_price: item.unit_price,
            moq: item.moq,
            lead_time_days: item.lead_time_days,
            delivery_price: item.delivery_price,
            notes: item.notes,
            status: item.status,
            is_current: item.is_current,
            quote_version: item.quote_version,
            created_at: item.created_at,
            material_name: mat?.name || null,
            material_code: mat?.code || null,
            material_uom: mat?.uom || null,
          } as SupplierQuoteItem;
        });

        const delivery_lines = (deliveryByQuote.get(q.id) || []).map(dl => ({
          id: dl.id,
          supplier_quote_id: dl.supplier_quote_id,
          zone_codes: dl.zone_codes,
          price_per_moq: dl.price_per_moq,
          material_ids: dl.material_ids,
          notes: dl.notes,
        } as SupplierQuoteDeliveryLine));

        return {
          id: q.id,
          supplier_account_id: q.supplier_account_id,
          supplier_name: account?.display_name || null,
          status: q.status as SupplierQuoteStatus,
          source: q.source,
          notes: q.notes,
          submitted_at: q.submitted_at,
          valid_until: q.valid_until || null,
          created_at: q.created_at,
          items,
          delivery_lines,
        } as SupplierQuote;
      });
    },
  });
}
