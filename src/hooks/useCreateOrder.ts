import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { computeCommercialTotals, type DeliveryMode } from "@/lib/quotation-commercial";

interface CreateOrderParams {
  quotationId: string;
  customerAccountId: string;
  projectId: string;
}

/**
 * Creates an order from an accepted quotation, populating provenance
 * fields (supply_unit_id, domain_id, source_quote_id) on each order_item.
 * Uses delivery-mode-aware commercial totals.
 * SSOT §11.1
 */
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ quotationId, customerAccountId, projectId }: CreateOrderParams) => {
      const { data: quotation, error: qErr } = await supabase
        .from("quotations")
        .select("id, subtotal, delivery_total, total, metadata")
        .eq("id", quotationId)
        .single();
      if (qErr) throw qErr;

      // Read delivery mode from quotation metadata
      const metadata = (quotation as any).metadata || {};
      const deliveryMode: DeliveryMode = metadata.delivery_mode === "separate" ? "separate" : "embedded";

      const { data: qItems, error: qiErr } = await supabase
        .from("quotation_items")
        .select("id, material_id, quantity, uom, unit_price, delivery_price, line_total, supplier_account_id, supplier_material_id, effective_margin_pct, is_custom_item, custom_name, custom_description, item_kind, parent_line_id, addon_definition_id")
        .eq("quotation_id", quotationId)
        .eq("status", "active")
        .is("removed_at", null)
        .order("position");
      if (qiErr) throw qiErr;

      // Compute commercial totals using the same formula gate
      // effective_margin_pct from saved items is used directly (frozen at save time)
      // globalMargin=0 only applies to legacy items with NULL effective_margin_pct
      const commercialTotals = computeCommercialTotals(
        (qItems || []).map(qi => ({
          quantity: qi.quantity ?? undefined,
          unit_price: qi.unit_price ?? undefined,
          delivery_price: qi.delivery_price ?? undefined,
          effective_margin_pct: qi.effective_margin_pct ?? undefined,
        })),
        quotation.delivery_total || 0,
        0, // global fallback for legacy items with NULL effective_margin_pct
        deliveryMode
      );

      const { data: order, error: oErr } = await supabase
        .from("orders")
        .insert({
          customer_account_id: customerAccountId,
          project_id: projectId,
          quotation_id: quotationId,
          subtotal: commercialTotals.sellingTotal,
          delivery_total: commercialTotals.deliveryAddition,
          total: commercialTotals.preTax,
          status: "created",
        })
        .select("id")
        .single();
      if (oErr) throw oErr;

      // Pre-mint order_item ids so parent_line_id can be remapped from quotation_item.id → order_item.id
      const qiToOiId = new Map<string, string>();
      for (const qi of qItems || []) {
        if ((qi as any).id) qiToOiId.set((qi as any).id, crypto.randomUUID());
      }

      const orderItems = await Promise.all(
        (qItems || []).map(async (qi) => {
          const isAddon = (qi as any).item_kind === "addon";
          let supplyUnitId: string | null = null;
          let domainId: string | null = null;
          let sourceQuoteId: string | null = null;

          // Add-ons skip supply resolution entirely (commercial-only lines)
          if (!isAddon && qi.supplier_material_id) {
            const { data: smData } = await supabase
              .from("supplier_materials")
              .select("id, supplier_account_id, supplier_quote_id")
              .eq("id", qi.supplier_material_id)
              .single();

            if (smData?.supplier_quote_id) {
              sourceQuoteId = smData.supplier_quote_id;
            }

            // NOTE: supply_unit_suppliers is deprecated. supply_unit_id and
            // domain_id on order_items are now best-effort and left NULL here;
            // a follow-up will derive domain_id via find_domain_for_material_zone
            // once a zone is attached to the order line.
            supplyUnitId = null;
            domainId = null;
          }

          const remappedParent = (qi as any).parent_line_id
            ? qiToOiId.get((qi as any).parent_line_id) ?? null
            : null;

          return {
            id: qiToOiId.get((qi as any).id),
            order_id: order.id,
            material_id: qi.material_id || null,
            quantity: qi.quantity || 0,
            uom: qi.uom,
            unit_price: qi.unit_price,
            delivery_price: qi.delivery_price,
            line_total: qi.line_total,
            supplier_account_id: qi.supplier_account_id,
            supply_unit_id: supplyUnitId,
            domain_id: domainId,
            source_quote_id: sourceQuoteId,
            is_custom_item: qi.is_custom_item || false,
            custom_name: qi.custom_name || null,
            custom_description: qi.custom_description || null,
            item_kind: isAddon ? "addon" : "material",
            parent_line_id: remappedParent,
            addon_definition_id: (qi as any).addon_definition_id ?? null,
          };
        })
      );

      if (orderItems.length > 0) {
        const { error: oiErr } = await supabase.from("order_items").insert(orderItems);
        if (oiErr) throw oiErr;
      }

      const { error: statusErr } = await supabase
        .from("quotations")
        .update({ order_id: order.id, status: "converted" })
        .eq("id", quotationId);
      if (statusErr) throw statusErr;

      return { orderId: order.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-quotation"] });
    },
  });
}
