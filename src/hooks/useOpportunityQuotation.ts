import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { QuotationItem } from "@/components/sales/QuotationBuilder";
import { type DeliveryMode, computeCommercialTotals, DEFAULT_DELIVERY_MODE } from "@/lib/quotation-commercial";
import { resolveMarginHierarchy } from "@/lib/quotation-commercial";

interface QuotationData {
  id: string;
  code: string | null;
  status: string;
  est_delivery_date: string | null;
  sent_at: string | null;
  created_at: string;
  version: number;
  subtotal: number | null;
  delivery_total: number | null;
  total: number | null;
  delivery_mode: DeliveryMode;
  items: QuotationItemRow[];
}

interface QuotationItemRow {
  id: string;
  material_id: string | null;
  material_name: string;
  material_name_ar: string | null;
  quantity: number | null;
  uom: string | null;
  uom_ar: string | null;
  supplier_material_id: string | null;
  supplier_account_id: string | null;
  supplier_name: string | null;
  supplier_name_ar: string | null;
  unit_price: number | null;
  delivery_price: number | null;
  line_total: number | null;
  position: number;
  status: string;
  effective_margin_pct: number | null;
  is_custom_item: boolean;
  custom_name: string | null;
  custom_description: string | null;
  item_kind: "material" | "addon";
  parent_line_id: string | null;
  addon_definition_id: string | null;
}

// Fetch the current quotation for an opportunity (draft or sent)
export function useOpportunityQuotation(opportunityId: string | undefined) {
  return useQuery({
    queryKey: ["opportunity-quotation", opportunityId],
    queryFn: async (): Promise<QuotationData | null> => {
      if (!opportunityId) return null;

      // Get the latest quotation for this opportunity (draft or sent, but prefer draft if exists)
      const { data: quotation, error: quotationError } = await supabase
        .from("quotations")
        .select("*")
        .eq("opportunity_id", opportunityId)
        .in("status", ["draft", "sent", "accepted"])
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (quotationError) throw quotationError;
      if (!quotation) return null;

      // Get the quotation items with material and supplier info
      const { data: items, error: itemsError } = await supabase
        .from("quotation_items")
        .select(`
          id,
          material_id,
          quantity,
          uom,
          supplier_material_id,
          supplier_account_id,
          unit_price,
          delivery_price,
          line_total,
          position,
          status,
          effective_margin_pct,
          is_custom_item,
          custom_name,
          custom_description,
          item_kind,
          parent_line_id,
          addon_definition_id,
          material:materials!quotation_items_material_id_fkey(name, name_ar, uom),
          supplier:suppliers!quotation_items_supplier_account_id_fkey(
            account:accounts!suppliers_account_id_fkey(display_name, display_name_ar)
          )
        `)
        .eq("quotation_id", quotation.id)
        .eq("status", "active")
        .is("removed_at", null)
        .order("position");

      if (itemsError) throw itemsError;

      const mappedItems: QuotationItemRow[] = (items || []).map((item: any) => ({
        id: item.id,
        material_id: item.material_id,
        material_name: item.is_custom_item ? (item.custom_name || "Custom Item") : (item.material?.name || (item.item_kind === "addon" ? (item.custom_name || "Add-on") : "Unknown Material")),
        material_name_ar: item.material?.name_ar || null,
        quantity: item.quantity,
        uom: item.uom || item.material?.uom || null,
        uom_ar: null,
        supplier_material_id: item.supplier_material_id,
        supplier_account_id: item.supplier_account_id,
        supplier_name: item.supplier?.account?.display_name || null,
        supplier_name_ar: item.supplier?.account?.display_name_ar || null,
        unit_price: item.unit_price,
        delivery_price: item.delivery_price,
        line_total: item.line_total,
        position: item.position,
        status: item.status,
        effective_margin_pct: item.effective_margin_pct ?? null,
        is_custom_item: item.is_custom_item || false,
        custom_name: item.custom_name || null,
        custom_description: item.custom_description || null,
        item_kind: (item.item_kind === "addon" ? "addon" : "material"),
        parent_line_id: item.parent_line_id ?? null,
        addon_definition_id: item.addon_definition_id ?? null,
      }));

      const metadata = (quotation as any).metadata || {};
      const colMode = (quotation as any).delivery_mode;
      const deliveryMode: DeliveryMode =
        colMode === "separate" || colMode === "embedded"
          ? colMode
          : metadata.delivery_mode === "separate"
            ? "separate"
            : metadata.delivery_mode === "embedded"
              ? "embedded"
              : DEFAULT_DELIVERY_MODE;

      return {
        id: quotation.id,
        code: quotation.code || null,
        status: quotation.status,
        est_delivery_date: quotation.est_delivery_date,
        sent_at: quotation.sent_at,
        created_at: quotation.created_at,
        version: quotation.version,
        subtotal: quotation.subtotal,
        delivery_total: quotation.delivery_total,
        total: quotation.total,
        delivery_mode: deliveryMode,
        items: mappedItems,
      };
    },
    enabled: !!opportunityId,
  });
}

// Convert quotation items to QuotationBuilder format
export function quotationItemsToBuilderFormat(items: QuotationItemRow[]): QuotationItem[] {
  return items.map((item) => ({
    line_id: item.id, // DB id as stable line identity
    material_id: item.material_id ?? undefined,
    name: item.is_custom_item ? (item.custom_name || "Custom Item") : item.material_name,
    name_ar: item.material_name_ar ?? undefined,
    quantity: item.quantity ?? undefined,
    uom: item.uom ?? undefined,
    uom_ar: item.uom_ar ?? undefined,
    supplier_material_id: item.supplier_material_id ?? undefined,
    unit_price: item.unit_price ?? undefined,
    delivery_price: item.delivery_price ?? undefined,
    supplier_name: item.supplier_name ?? undefined,
    supplier_name_ar: item.supplier_name_ar ?? undefined,
    effective_margin_pct: item.effective_margin_pct,
    is_custom_item: item.is_custom_item || false,
    custom_name: item.custom_name ?? undefined,
    custom_description: item.custom_description ?? undefined,
    item_kind: item.item_kind,
    parent_line_id: item.parent_line_id ?? null,
    addon_definition_id: item.addon_definition_id ?? null,
  }));
}

interface SaveQuotationParams {
  opportunityId: string;
  customerAccountId: string;
  projectId: string;
  items: QuotationItem[];
  deliveryDate: Date | null;
  deliveryTotal?: number;
  deliveryBreakdown?: any[];
  deliveryMode?: DeliveryMode;
  /** Builder's current global margin — used as fallback during margin hierarchy resolution for new lines */
  globalMargin?: number;
}

/**
 * Standalone save function — same logic as `useSaveQuotation`, callable from any
 * async context (mutationFn, edge function caller, scripts).
 * Returns { quotationId }.
 */
export async function saveQuotation({
  opportunityId,
  customerAccountId,
  projectId,
  items,
  deliveryDate,
  deliveryTotal: passedDeliveryTotal,
  deliveryBreakdown,
  deliveryMode,
  globalMargin = 0,
}: SaveQuotationParams): Promise<{ quotationId: string }> {
  // 1. Get or create draft quotation
  let { data: existingDraft } = await supabase
    .from("quotations")
    .select("id, version")
    .eq("opportunity_id", opportunityId)
    .eq("status", "draft")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  let quotationId: string;

  if (existingDraft) {
    quotationId = existingDraft.id;
    const updatePayload: any = {
      est_delivery_date: deliveryDate?.toISOString().split("T")[0] || null,
    };
    if (deliveryMode) updatePayload.delivery_mode = deliveryMode;
    if (deliveryBreakdown || deliveryMode) {
      const { data: existingQ } = await supabase
        .from("quotations")
        .select("metadata")
        .eq("id", quotationId)
        .single();
      const existingMeta = (existingQ?.metadata as any) || {};
      updatePayload.metadata = {
        ...existingMeta,
        ...(deliveryBreakdown ? { delivery_breakdown: deliveryBreakdown } : {}),
        ...(deliveryMode ? { delivery_mode: deliveryMode } : {}),
      };
    }
    const { error: updateError } = await supabase
      .from("quotations")
      .update(updatePayload)
      .eq("id", quotationId);
    if (updateError) throw updateError;
  } else {
    const { data: sentQuotation } = await supabase
      .from("quotations")
      .select("id, version, is_soft")
      .eq("opportunity_id", opportunityId)
      .in("status", ["sent", "accepted"])
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = sentQuotation ? sentQuotation.version + 1 : 1;

    const { data: newQuotation, error: createError } = await supabase
      .from("quotations")
      .insert({
        opportunity_id: opportunityId,
        customer_account_id: customerAccountId,
        project_id: projectId,
        status: "draft",
        quote_type: "order",
        is_soft: sentQuotation?.is_soft ?? false,
        version: nextVersion,
        est_delivery_date: deliveryDate?.toISOString().split("T")[0] || null,
        delivery_mode: deliveryMode || DEFAULT_DELIVERY_MODE,
        metadata: deliveryMode ? { delivery_mode: deliveryMode } : {},
      })
      .select("id")
      .single();
    if (createError) throw createError;
    quotationId = newQuotation.id;
  }

  // 2. Existing items
  const { data: existingItems } = await supabase
    .from("quotation_items")
    .select("id")
    .eq("quotation_id", quotationId)
    .is("removed_at", null);

  const existingIds = new Set((existingItems || []).map((i) => i.id));
  const incomingLineIds = new Set(items.map((i) => i.line_id));

  // 3. Remove items not in incoming
  const itemsToRemove = (existingItems || []).filter((i) => !incomingLineIds.has(i.id));
  if (itemsToRemove.length > 0) {
    const { error: removeError } = await supabase
      .from("quotation_items")
      .update({ removed_at: new Date().toISOString(), status: "removed" })
      .in("id", itemsToRemove.map((i) => i.id));
    if (removeError) throw removeError;
  }

  // 3a. Margin hierarchy resolution for NEW lines only
  const newRegistryMaterialIds = items
    .filter(i => !existingIds.has(i.line_id) && !i.is_custom_item && i.material_id)
    .map(i => i.material_id!);

  const subcategoryMargins = new Map<string, number>();
  const materialSubcategoryMap = new Map<string, string>();

  if (newRegistryMaterialIds.length > 0) {
    const [{ data: matRows }, { data: subDefaults }] = await Promise.all([
      supabase.from("materials").select("id, subcategory_id").in("id", newRegistryMaterialIds),
      supabase.from("subcategory_margin_defaults").select("subcategory_id, default_margin_pct"),
    ]);
    for (const m of matRows || []) {
      if (m.subcategory_id) materialSubcategoryMap.set(m.id, m.subcategory_id);
    }
    for (const s of subDefaults || []) {
      if (s.default_margin_pct != null && Number(s.default_margin_pct) > 0) {
        subcategoryMargins.set(s.subcategory_id, Number(s.default_margin_pct));
      }
    }
  }

  const resolvedItems = items.map(item => {
    if (existingIds.has(item.line_id)) return item;
    const resolved = resolveMarginHierarchy(
      {
        material_id: item.material_id,
        margin_pct: item.margin_pct,
        effective_margin_pct: item.effective_margin_pct,
      },
      subcategoryMargins,
      materialSubcategoryMap,
      globalMargin,
    );
    return { ...item, effective_margin_pct: resolved };
  });

  // 4. Upsert items
  for (let i = 0; i < resolvedItems.length; i++) {
    const item = resolvedItems[i];
    const lineTotal = item.quantity && item.unit_price ? item.quantity * item.unit_price : null;
    const commonFields = {
      quantity: item.quantity || null,
      uom: item.uom || null,
      supplier_material_id: item.supplier_material_id || null,
      supplier_account_id: item.supplier_material_id
        ? await getSupplierAccountId(item.supplier_material_id)
        : null,
      unit_price: item.unit_price || null,
      delivery_price: item.delivery_price || null,
      line_total: lineTotal,
      position: i,
      effective_margin_pct: item.effective_margin_pct ?? null,
      is_custom_item: item.is_custom_item || false,
      custom_name: item.custom_name || null,
      custom_description: item.custom_description || null,
      item_kind: item.item_kind === "addon" ? "addon" : "material",
      parent_line_id: item.parent_line_id ?? null,
      addon_definition_id: item.addon_definition_id ?? null,
    };

    if (existingIds.has(item.line_id)) {
      const { effective_margin_pct: _ignored, ...updateFields } = commonFields;
      const { error: updateError } = await supabase
        .from("quotation_items")
        .update({
          ...updateFields,
          material_id: item.material_id || null,
          status: "active",
          removed_at: null,
        })
        .eq("id", item.line_id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase.from("quotation_items").insert({
        id: item.line_id,
        quotation_id: quotationId,
        material_id: item.material_id || null,
        ...commonFields,
      });
      if (insertError) throw insertError;
    }
  }

  // 5. Persist global_margin into metadata so the backend engine can use it as system default
  {
    const { data: qMeta } = await supabase
      .from("quotations")
      .select("metadata")
      .eq("id", quotationId)
      .single();
    const meta = (qMeta?.metadata as any) || {};
    await supabase
      .from("quotations")
      .update({ metadata: { ...meta, global_margin: globalMargin } })
      .eq("id", quotationId);
  }

  // 6. Backend is the SOLE authority for persisted commercial totals + pricing_trace.
  // If it fails, we DO NOT persist frontend-calculated totals — we null the official totals
  // (so the quotation is not silently marked commercially valid) and surface the error to the caller.
  const { error: computeError } = await supabase.rpc("compute_quotation_totals", {
    _quotation_id: quotationId,
  } as any);
  if (computeError) {
    await supabase
      .from("quotations")
      .update({ subtotal: null, delivery_total: null, total: null })
      .eq("id", quotationId);
    console.error("[saveQuotation] compute_quotation_totals failed:", computeError);
    throw new Error(
      `Quotation saved as draft, but backend pricing engine failed: ${computeError.message}. Official totals were cleared. Please fix the issue and retry.`,
    );
  }

  return { quotationId };
}

// Save/update quotation and items — thin wrapper around `saveQuotation` for React.
export function useSaveQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveQuotation,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["opportunity-quotation", variables.opportunityId],
      });
      queryClient.invalidateQueries({
        queryKey: ["opportunity", variables.opportunityId],
      });
    },
  });
}

// Helper to get supplier_account_id from supplier_material_id
async function getSupplierAccountId(supplierMaterialId: string): Promise<string | null> {
  const { data } = await supabase
    .from("supplier_materials")
    .select("supplier_account_id")
    .eq("id", supplierMaterialId)
    .single();

  return data?.supplier_account_id || null;
}
