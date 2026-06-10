import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SupplierMaterialStatus = 'submitted' | 'under_review' | 'rejected' | 'negotiating' | 'approved' | 'shortlisted';

export interface SupplierMaterial {
  id: string;
  supplier_account_id: string;
  material_id: string;
  unit_price: number | null;
  delivery_price: number | null;
  moq: number | null;
  lead_time_days: number | null;
  price_valid_until: string | null;
  notes: string | null;
  status: SupplierMaterialStatus;
  metadata: Record<string, unknown>;
  quotation_file_id: string | null;
  created_at: string;
  updated_at: string;
  supplier_name: string | null;
  material_name: string | null;
  material_code: string | null;
  material_uom: string | null;
}

export function useSupplierMaterials(statusFilter?: SupplierMaterialStatus | 'all') {
  return useQuery({
    queryKey: ['supplier-materials', statusFilter],
    queryFn: async (): Promise<SupplierMaterial[]> => {
      let query = supabase
        .from('supplier_materials')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data: materials, error } = await query;
      if (error) throw error;
      if (!materials || materials.length === 0) return [];

      const supplierIds = [...new Set(materials.map(m => m.supplier_account_id))];
      const materialIds = [...new Set(materials.map(m => m.material_id))];

      const [accountsRes, materialsRes] = await Promise.all([
        supabase.from('accounts').select('id, display_name').in('id', supplierIds).is('deleted_at', null),
        supabase.from('materials').select('id, name, code, uom').in('id', materialIds),
      ]);

      const accountMap = new Map(accountsRes.data?.map(a => [a.id, a]) || []);
      const materialMap = new Map(materialsRes.data?.map(m => [m.id, m]) || []);

      return materials.map(sm => {
        const account = accountMap.get(sm.supplier_account_id);
        const material = materialMap.get(sm.material_id);

        return {
          ...sm,
          status: sm.status as SupplierMaterialStatus,
          metadata: (sm.metadata as Record<string, unknown>) || {},
          supplier_name: account?.display_name || null,
          material_name: material?.name || null,
          material_code: material?.code || null,
          material_uom: material?.uom || null,
        };
      });
    },
  });
}

export interface SupplierMaterialWithTarget extends SupplierMaterial {
  target_price: number | null;
  target_scope_id: string | null;
  supplier_rating: number | null;
}

export function useSupplierMaterialsWithTargets() {
  return useQuery({
    queryKey: ['supplier-materials-with-targets'],
    queryFn: async (): Promise<SupplierMaterialWithTarget[]> => {
      const { data: materials, error } = await supabase
        .from('supplier_materials')
        .select('*')
        .eq('is_current', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!materials || materials.length === 0) return [];

      const supplierIds = [...new Set(materials.map(m => m.supplier_account_id))];
      const materialIds = [...new Set(materials.map(m => m.material_id))];

      const [accountsRes, materialsRes, targetPricesRes, suppliersRes] = await Promise.all([
        supabase.from('accounts').select('id, display_name').in('id', supplierIds).is('deleted_at', null),
        supabase.from('materials').select('id, name, code, uom').in('id', materialIds),
        supabase.from('target_prices').select('material_id, target_price, scope_type, scope_id').in('id', materialIds),
        supabase.from('suppliers').select('account_id, rating').in('account_id', supplierIds),
      ]);

      const accountMap = new Map(accountsRes.data?.map(a => [a.id, a]) || []);
      const materialMap = new Map(materialsRes.data?.map(m => [m.id, m]) || []);

      const targetMap = new Map<string, { target_price: number; scope_id: string }>();
      targetPricesRes.data?.forEach((tp: any) => {
        const existing = targetMap.get(tp.material_id);
        if (!existing || tp.target_price < existing.target_price) {
          targetMap.set(tp.material_id, { target_price: tp.target_price, scope_id: tp.scope_id });
        }
      });

      const ratingMap = new Map<string, number>();
      suppliersRes.data?.forEach((s: any) => {
        if (s.rating != null) {
          ratingMap.set(s.account_id, Number(s.rating));
        }
      });

      return materials.map(sm => {
        const account = accountMap.get(sm.supplier_account_id);
        const material = materialMap.get(sm.material_id);
        const target = targetMap.get(sm.material_id);

        return {
          ...sm,
          status: sm.status as SupplierMaterialStatus,
          metadata: (sm.metadata as Record<string, unknown>) || {},
          supplier_name: account?.display_name || null,
          material_name: material?.name || null,
          material_code: material?.code || null,
          material_uom: material?.uom || null,
          target_price: target?.target_price ?? null,
          target_scope_id: target?.scope_id ?? null,
          supplier_rating: ratingMap.get(sm.supplier_account_id) ?? null,
        };
      });
    },
  });
}
