/**
 * Canonical quote-line shape.
 *
 * Three historical types existed:
 *   - `QuotationItem` (builder UI shape)        → re-exported as alias below
 *   - `QuoteItem` (PDF render shape)            → structurally a subset of QuoteLine
 *   - `QuotationItemRow` (DB row shape)         → kept locally in useOpportunityQuotation,
 *                                                  mapped into QuoteLine via the existing converter
 *
 * Going forward, prefer `QuoteLine` for any new code. The legacy aliases stay
 * for back-compat — they are now type aliases, not separate definitions.
 */
export interface QuoteLine {
  /** Stable line identity — DB id for saved rows, crypto.randomUUID() for new rows */
  line_id: string;
  /** Registry material ID — undefined/absent for custom items */
  material_id?: string;
  name: string;
  name_ar?: string;
  quantity?: number;
  uom?: string;
  uom_ar?: string;
  supplier_material_id?: string;
  unit_price?: number;
  delivery_price?: number;
  supplier_name?: string;
  supplier_name_ar?: string;
  margin_pct?: number;
  /** Persisted snapshot of resolved margin — frozen at save time */
  effective_margin_pct?: number | null;
  /** Set when quality was requested but no quality supplier was available */
  quality_fallback?: boolean;
  /** The role that was actually resolved */
  resolved_role?: string;
  /** Custom item fields */
  is_custom_item?: boolean;
  custom_name?: string;
  custom_description?: string;
  /** 'material' (default) or 'addon'. Add-ons are commercial-only and skip supply logic. */
  item_kind?: "material" | "addon";
  /** When set, this row is an item-level add-on attached to the parent line (matched by line_id). */
  parent_line_id?: string | null;
  /** Optional link to a registry add-on definition; null/undefined for one-time custom add-ons. */
  addon_definition_id?: string | null;
  /** Transient UI flag: line is currently being priced via resolve_line_pricing. Not persisted. */
  resolving?: boolean;
}

/** @deprecated Use `QuoteLine` directly. Kept as an alias for back-compat. */
export type QuotationItem = QuoteLine;
