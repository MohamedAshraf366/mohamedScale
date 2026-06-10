/**
 * Quotation Commercial Formula Gates
 * 
 * Single source of truth for delivery mode–aware pricing.
 * Every consumer (builder, PDF, order conversion) MUST use these functions.
 * 
 * Delivery enters the commercial total EXACTLY ONCE:
 *   - embedded: through per-item delivery_price baked into selling price
 *   - separate: through deliveryTotal added to the grand total
 * 
 * Margin resolution:
 *   - Saved items: effective_margin_pct (frozen at save time) → global fallback for legacy NULL
 *   - Builder (new items): hierarchy resolver → item override → subcategory default → global
 */

export type DeliveryMode = "embedded" | "separate";

/**
 * Default delivery mode for new quotations.
 * Single source of truth — do not hardcode "embedded"/"separate" defaults elsewhere.
 */
export const DEFAULT_DELIVERY_MODE: DeliveryMode = "embedded";

/**
 * VAT rate applied at render time only. Never stored on quotations/orders.
 * Single source of truth — do not hardcode 0.15 elsewhere.
 */
export const VAT_RATE = 0.15;

export interface CommercialItem {
  quantity?: number;
  unit_price?: number;
  delivery_price?: number;
  margin_pct?: number;
  /** Persisted snapshot of resolved margin — frozen at save time */
  effective_margin_pct?: number | null;
  /** Material ID — needed for hierarchy resolution in builder */
  material_id?: string;
}

/**
 * Get the effective margin for a saved item.
 * 
 * Priority:
 * 1. effective_margin_pct (persisted snapshot from save) if not null
 * 2. margin_pct (legacy per-item override)
 * 3. globalMargin fallback
 */
export function getEffectiveMargin(item: CommercialItem, globalMargin: number): number {
  if (item.effective_margin_pct != null) return item.effective_margin_pct;
  if (item.margin_pct != null && item.margin_pct > 0) return item.margin_pct;
  return globalMargin;
}

/**
 * Resolve margin using the full hierarchy — ONLY for builder use on new/editing items.
 * 
 * Priority:
 * 1. Per-item override (margin_pct or effective_margin_pct)
 * 2. Subcategory default
 * 3. Global default
 * 
 * This is NOT used by PDF rendering or order conversion — they use getEffectiveMargin.
 */
export function resolveMarginHierarchy(
  item: CommercialItem,
  subcategoryMargins: Map<string, number>,
  materialSubcategoryMap: Map<string, string>,
  globalMargin: number
): number {
  // 1. Per-item override
  if (item.effective_margin_pct != null && item.effective_margin_pct > 0) return item.effective_margin_pct;
  if (item.margin_pct != null && item.margin_pct > 0) return item.margin_pct;

  // 2. Subcategory default
  if (item.material_id) {
    const subId = materialSubcategoryMap.get(item.material_id);
    if (subId) {
      const subMargin = subcategoryMargins.get(subId);
      if (subMargin != null && subMargin > 0) return subMargin;
    }
  }

  // 3. Global default
  return globalMargin;
}

/**
 * Compute the commercial selling price per unit.
 * 
 * In embedded mode: delivery_price is included in the landed cost.
 * In separate mode: delivery_price is excluded — delivery enters via deliveryTotal.
 */
export function getSellingPrice(
  item: CommercialItem,
  globalMargin: number,
  deliveryMode: DeliveryMode
): number {
  const base = item.unit_price || 0;
  const delivery = deliveryMode === "embedded" ? (item.delivery_price || 0) : 0;
  const landed = base + delivery;
  const margin = getEffectiveMargin(item, globalMargin);
  return landed * (1 + margin / 100);
}

/**
 * Compute all commercial totals for a quotation.
 * This is the SINGLE GATE — no other code should compute totals independently.
 */
export function computeCommercialTotals(
  items: CommercialItem[],
  deliveryTotal: number,
  globalMargin: number,
  deliveryMode: DeliveryMode
) {
  let rawSubtotal = 0;
  let sellingTotal = 0;

  for (const item of items) {
    const qty = item.quantity || 0;
    rawSubtotal += qty * (item.unit_price || 0);
    sellingTotal += qty * getSellingPrice(item, globalMargin, deliveryMode);
  }

  // Delivery enters exactly once through the appropriate path
  const deliveryAddition = deliveryMode === "separate" ? deliveryTotal : 0;
  const preTax = sellingTotal + deliveryAddition;
  const vat = preTax * VAT_RATE;
  const grandTotal = preTax + vat;

  return {
    rawSubtotal,
    sellingTotal,
    deliveryAddition,
    marginTotal: sellingTotal - rawSubtotal,
    preTax,
    vat,
    grandTotal,
  };
}
