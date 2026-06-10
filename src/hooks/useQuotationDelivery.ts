import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveInherited } from "@/lib/resolve-inherited";

export interface DeliveryLineItem {
  delivery_rate_id: string;
  supplier_account_id: string;
  supplier_name: string;
  material_names: string[];
  material_names_ar: string[];
  supplier_material_ids: string[];
  total_quantity: number;
  moq: number;
  trips: number;
  price_per_trip: number;
  total_cost: number;
  zone_name: string;
}

export interface MissingRateItem {
  material_id: string;
  material_name: string;
  supplier_material_id: string;
  supplier_name: string;
}

export interface QuotationDeliveryResult {
  deliveryLines: DeliveryLineItem[];
  missingRateItems: MissingRateItem[];
  deliveryTotal: number;
  hasBlockers: boolean;
}

interface QuotationItemForDelivery {
  material_id: string;
  name: string;
  name_ar?: string;
  quantity?: number;
  supplier_material_id?: string;
  supplier_name?: string;
}

export function useQuotationDelivery(
  items: QuotationItemForDelivery[],
  zoneCode: string | null | undefined
) {
  const supplierMaterialIds = items
    .filter((i) => i.supplier_material_id)
    .map((i) => i.supplier_material_id!);

  return useQuery({
    queryKey: ["quotation-delivery", zoneCode, ...supplierMaterialIds.sort()],
    enabled: !!zoneCode && supplierMaterialIds.length > 0,
    queryFn: async (): Promise<QuotationDeliveryResult> => {
      if (!zoneCode || supplierMaterialIds.length === 0) {
        return { deliveryLines: [], missingRateItems: [], deliveryTotal: 0, hasBlockers: false };
      }

      const { data: rates, error } = await supabase
        .from("delivery_rates")
        .select("*")
        .contains("zone_codes", [zoneCode]);

      if (error) throw error;

      const { data: zone } = await supabase
        .from("zones")
        .select("name")
        .eq("code", zoneCode)
        .maybeSingle();

      const zoneName = zone?.name || zoneCode;

      const supplierAccountIds = [...new Set((rates || []).map((r: any) => r.supplier_account_id))];
      const { data: suppliers } = supplierAccountIds.length > 0
        ? await supabase
            .from("suppliers")
            .select("account_id, account:accounts!suppliers_account_id_fkey(display_name)")
            .in("account_id", supplierAccountIds)
        : { data: [] };

      const supplierNameMap = new Map<string, string>();
      for (const s of suppliers || []) {
        supplierNameMap.set(s.account_id, (s.account as any)?.display_name || "Unknown Supplier");
      }

      const { data: smData } = supplierMaterialIds.length > 0
        ? await supabase
            .from("supplier_materials")
            .select("id, moq, material:materials!supplier_materials_material_id_fkey(default_moq, subcategory:material_subcategories!materials_subcategory_fkey(default_moq, category:material_categories!material_subcategories_category_id_fkey(default_moq)))")
            .in("id", supplierMaterialIds)
        : { data: [] };

      const moqMap = new Map<string, number>();
      for (const sm of smData || []) {
        const matRaw = (sm as any).material as Record<string, unknown> | null;
        const sub = (matRaw?.subcategory ?? null) as Record<string, unknown> | null;
        const cat = (sub?.category ?? null) as Record<string, unknown> | null;
        const moq = resolveInherited<number>('default_moq', [sm as any, matRaw, sub, cat], 1);
        moqMap.set((sm as any).id, Number(moq));
      }

      const itemsWithSupplier = items.filter((i) => i.supplier_material_id);
      const matchedItems = new Map<string, { rateRow: any; items: QuotationItemForDelivery[] }>();
      const unmatchedItems: MissingRateItem[] = [];

      // Resolve a rate for (supplier_material_id, supplier_account_id):
      //   1. Override — a rate that explicitly lists this supplier_material_id.
      //   2. Default — `is_default = true` OR empty `supplier_material_ids[]`, for the same supplier.
      // Among matches at each level, the cheapest rate wins (mirrors landedPrice.ts::resolveZoneRate).
      const rateForItem = (smId: string, supplierAccountId: string) => {
        const supplierRates = (rates || []).filter(
          (r: any) => r.supplier_account_id === supplierAccountId,
        );
        let override: any = null;
        let def: any = null;
        for (const r of supplierRates) {
          const ids: string[] = (r as any).supplier_material_ids || [];
          const isOverride = ids.includes(smId);
          const isDefault = (r as any).is_default || ids.length === 0;
          if (isOverride) {
            if (!override || Number(r.price_per_moq) < Number(override.price_per_moq)) override = r;
          } else if (isDefault) {
            if (!def || Number(r.price_per_moq) < Number(def.price_per_moq)) def = r;
          }
        }
        return override || def || null;
      };

      // We need supplier_account_id per supplier_material — fetch once.
      const { data: smOwners } = supplierMaterialIds.length > 0
        ? await supabase
            .from("supplier_materials")
            .select("id, supplier_account_id")
            .in("id", supplierMaterialIds)
        : { data: [] };
      const smOwnerMap = new Map<string, string>(
        (smOwners || []).map((r: any) => [r.id, r.supplier_account_id]),
      );

      for (const item of itemsWithSupplier) {
        const smId = item.supplier_material_id!;
        const ownerId = smOwnerMap.get(smId);
        const matchingRate = ownerId ? rateForItem(smId, ownerId) : null;

        if (matchingRate) {
          const key = matchingRate.id;
          if (!matchedItems.has(key)) {
            matchedItems.set(key, { rateRow: matchingRate, items: [] });
          }
          matchedItems.get(key)!.items.push(item);
        } else {
          unmatchedItems.push({
            material_id: item.material_id,
            material_name: item.name,
            supplier_material_id: smId,
            supplier_name: item.supplier_name || "Unknown Supplier",
          });
        }
      }

      const deliveryLines: DeliveryLineItem[] = [];

      for (const [rateId, { rateRow, items: groupItems }] of matchedItems) {
        const totalQty = groupItems.reduce((sum, i) => sum + (i.quantity || 0), 0);
        const firstSmId = groupItems[0]?.supplier_material_id;
        const moq = firstSmId ? moqMap.get(firstSmId) || 1 : 1;
        const trips = totalQty > 0 ? Math.ceil(totalQty / moq) : 0;
        const pricePerTrip = Number(rateRow.price_per_moq);
        const totalCost = trips * pricePerTrip;

        deliveryLines.push({
          delivery_rate_id: rateId,
          supplier_account_id: rateRow.supplier_account_id,
          supplier_name: supplierNameMap.get(rateRow.supplier_account_id) || "Unknown Supplier",
          material_names: groupItems.map((i) => i.name),
          material_names_ar: groupItems.map((i) => i.name_ar || i.name),
          supplier_material_ids: groupItems.map((i) => i.supplier_material_id!),
          total_quantity: totalQty,
          moq,
          trips,
          price_per_trip: pricePerTrip,
          total_cost: totalCost,
          zone_name: zoneName,
        });
      }

      const deliveryTotal = deliveryLines.reduce((sum, l) => sum + l.total_cost, 0);

      return {
        deliveryLines,
        missingRateItems: unmatchedItems,
        deliveryTotal,
        hasBlockers: unmatchedItems.length > 0,
      };
    },
  });
}
