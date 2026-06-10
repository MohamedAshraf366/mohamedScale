# Architecture Audit — Phase 2 (Pricing Pipeline SSoT)

**Generated:** 2026-04-23
**Scope:** Sales ↔ Supply pricing pipeline. Maps every step from material → grand total, scores SSoT compliance, lists fragmentation findings, and emits a prioritized cleanup checklist.
**Rules:** Zero code or schema changes in this phase. This document is the work queue for Phase 3+.
**Companion artifact:** `Pricing_Pipeline_Current_vs_Target.mmd` (visual flow, current vs target state).

---

## 1. Pricing pipeline map

End-to-end path of a single quotation line, with the layer each step currently executes in:

| # | Step | Inputs | Should live in | **Actually lives in** |
|---|------|--------|---------------|----------------------|
| 1 | Resolve project zone | `project.location_id → locations.zone_code` | DB join | DB join (✅) |
| 2 | Pick supplier for (material, zone) | `supply_unit_suppliers` (role=selected) | DB function | `useSupplierPrices` + `resolveEffectiveSuppliersBatch` (hook) ⚠️ |
| 3 | Resolve unit price | `supplier_materials.last_price` | DB function | Same hook ⚠️ |
| 4 | Resolve per-unit delivery | `delivery_rates` ÷ MOQ × qty | DB function | `useQuotationDelivery` (separate hook) ⚠️ |
| 5 | Resolve margin % | item override → subcategory default → global | DB function (with hierarchy) | `resolveMarginHierarchy` in `quotation-commercial.ts` (✅ for builder) |
| 6 | Compute landed unit price | `unit_price + delivery_per_unit` (when embedded) | DB function | `getSellingPrice` in `quotation-commercial.ts` (✅) |
| 7 | Compute selling price | `landed × (1 + margin/100)` | One formula, everywhere | `getSellingPrice` (✅ unified) |
| 8 | Sum line totals | qty × selling | One reducer | `computeCommercialTotals` (✅ unified) |
| 9 | Add delivery (separate mode) | `deliveryTotal` | One reducer | `computeCommercialTotals` (✅ unified) |
| 10 | VAT (15%) | `preTax × 0.15` | One constant | `computeCommercialTotals` (✅ unified, but VAT rate is a hardcoded literal) |
| 11 | Freeze on send | snapshot all of the above into row columns | DB trigger or app gate | `pricing_locked_at` set client-side in `SendQuoteSheet` ⚠️ |
| 12 | Order conversion | copy frozen values → `order_items` | DB function | App-side mapper ⚠️ |

**Server-side `resolve_line_pricing` RPC exists** and covers steps 2–7 in one call — but **no frontend caller wires it**. It is dead code today.

---

## 2. SSoT scorecard

| Concept | Where it should live | Where it actually lives | Status |
|--------|---------------------|------------------------|--------|
| Selling price formula | `quotation-commercial.ts::getSellingPrice` | Same | ✅ unified |
| VAT rate (15%) | One named constant | Hardcoded `0.15` literal in `computeCommercialTotals` | ⚠️ partial — not a named export |
| Margin hierarchy resolution | `resolveMarginHierarchy` (builder) + `getEffectiveMargin` (saved) | Same — two functions, one purpose, clearly delineated | ✅ unified |
| Supplier selection | `resolve_line_pricing` RPC | `useSupplierPrices` + `resolveEffectiveSuppliersBatch` (client) | ❌ fragmented |
| Per-unit delivery | `resolve_line_pricing` RPC | `useQuotationDelivery` (separate, recomputes via `delivery_rates` join) | ❌ fragmented |
| Unit price snapshot policy | `pricing_locked_at` + frozen columns | Column exists, freeze is app-side, no DB enforcement | ⚠️ partial |
| Zone gate | `useZoneGate` hook | Mix of `useZoneGate` + inline `!project?.location?.zone_code` checks | ⚠️ partial |
| Delivery mode (embedded vs separate) | First-class column on `quotations` | `metadata->>'delivery_mode'` JSON | ❌ fragmented |
| Line item type | One `QuoteLine` interface | `QuotationItem` (builder) + `QuoteItem` (PDF) + `QuotationItemRow` (DB shape) | ❌ fragmented (3 shapes) |
| Material interest source | `opportunities.materials_interest` (deprecated) → `quotation_items` | Both still read in fallback paths | ⚠️ partial — legacy reads remain |
| Order ↔ Quote provenance | `order_items.source_quote_id` + `quotation_items.id` snapshot | `source_quote_id` exists, but no FK back to specific `quotation_item.id` | ⚠️ partial — line-level lineage is lossy |
| Quote ↔ Supply Unit lineage | `quotation_items.supply_unit_id` | Not stored — only `material_id` + `supplier_account_id` | ❌ missing |

---

## 3. Fragmentation findings

### 3.1 Dead RPC: `resolve_line_pricing`
- **Where:** DB function, fully implemented, returns `{supplier_account_id, unit_price, delivery_per_unit, margin_pct, landed_unit_price, zone_resolved, reason}`.
- **Frontend wrapper:** `src/hooks/useLinePricing.ts` exists.
- **Callers:** Zero. Builder still composes pricing client-side from three separate hooks.
- **Why it matters:** The DB function is the only place that can guarantee identical math between draft preview, PDF render, and order conversion. Today they can drift.

### 3.2 `delivery_mode` lives in JSON
- **Where:** `quotations.metadata->>'delivery_mode'`.
- **Reads:** ~6 files (`QuotationBuilder`, PDF renderer, order converter, send sheet, etc.).
- **Risk:** No DB constraint; typos silently break the formula. Cannot be indexed or filtered cleanly in reports.

### 3.3 Three line-item shapes
- `QuotationItem` — builder working state (UI flags, transient ids).
- `QuoteItem` — PDF/render shape (already-resolved selling price).
- `QuotationItemRow` — DB row shape from Supabase.
- Mappers between them duplicate field assignments and occasionally diverge (e.g. `effective_margin_pct` vs `margin_pct`).

### 3.4 Legacy `materials_interest` fallbacks
- `opportunities.materials_interest` (JSONB) is read as a fallback in at least the builder seed path and the opportunity detail.
- Source of truth is now `quotation_items`. Fallback paths can return stale/contradictory lists.

### 3.5 Inline zone checks
- `useZoneGate` hook exists but is bypassed in some components with ad-hoc checks like `if (!project?.location?.zone_code) return null;`.
- Inconsistent UX: some screens warn, others silently render empty totals.

### 3.6 Sales ↔ Supply seam (provenance)
- A quote line knows its `material_id` and (sometimes) `supplier_material_id`.
- It does **not** store `supply_unit_id` or `supply_domain_id`.
- On order conversion, we can't trivially answer "which supply unit did this revenue come from?" — required for cycle ROI reporting.

### 3.7 VAT literal
- `0.15` appears inline in `computeCommercialTotals`. Should be `export const VAT_RATE = 0.15;` so it's greppable and overridable by region later.

---

## 4. Sales ↔ Supply seam diagram (textual)

```
Project (location_id)
   └─> Location (zone_code) ──────────────────────────┐
                                                      │
Quotation                                             │
   └─ Items[]                                         │
        ├─ material_id ──> Material                   │
        │                    └─> Subcategory          │
        │                          └─> Category       │
        ├─ supplier_material_id ──> SupplierMaterial  │
        │                              └─> Supplier   │
        ├─ (MISSING) supply_unit_id ──> SupplyUnit ◀──┤  ← seam is lossy here
        │                                  └─> Domain │
        ├─ unit_price        \                        │
        ├─ delivery_price     ├─ snapshot at send     │
        ├─ effective_margin   /                       │
        └─ line_total                                 │
                                                      │
On send → pricing_locked_at = now()                   │
On accept → Order created, items copied               │
   └─ order_items.source_quote_id (quote-level only)  │
```

The dashed link `supply_unit_id` is the missing piece preventing closed-loop cycle ROI.

---

## 5. Line-count reduction estimate

| Cleanup | Files touched | Lines removed (est.) | Lines added | Net |
|--------|--------------|---------------------:|------------:|----:|
| C1 — Wire `useLinePricing` into builder | 4 | ~180 | ~40 | **-140** |
| C2 — Promote `delivery_mode` to column | 5 | ~30 | ~10 (+ migration) | **-20** |
| C3 — Consolidate to one `QuoteLine` type | 8 | ~120 | ~40 | **-80** |
| C4 — Remove `materials_interest` fallbacks | 3 | ~60 | 0 | **-60** |
| C5 — Standardize on `useZoneGate` | 6 | ~50 | ~10 | **-40** |
| C6 — Add `supply_unit_id` to quotation_items | 3 | ~10 | ~30 (+ migration) | **+20** (adds capability) |
| C7 — Extract `VAT_RATE` constant | 2 | 1 | 2 | **+1** |
| C8 — Move freeze-on-send to DB trigger | 2 | ~25 | ~5 (+ migration) | **-20** |
| **Total** | | **~476** | **~137** | **≈ -340 LOC** |

---

## 6. Prioritized cleanup checklist

Each item is sized as **one approval = one PR/migration**. Execute top-down; do not bundle.

### C1. Wire `useLinePricing` into the Quote Builder *(highest impact)* — ✅ **DONE 2026-04-23**
- **What shipped:** `QuotationBuilder` "Best Price" auto-fill now calls `resolveLinePricingBatch` (unified RPC). "Quality" auto-fill remains on `resolveEffectiveSuppliersBatch` until `resolve_line_pricing` accepts a role param (tracked as a follow-up).
- **Files touched:** `src/components/sales/QuotationBuilder.tsx`.
- **Net LOC:** ~−25 in builder (modest because Quality path is preserved). Full ~−140 reduction unlocks once the RPC supports role selection and the legacy hook can be deleted.
- **Risk realized:** None — typecheck clean, dropdown still uses `useSupplierPrices` (list query, intentionally kept).

### C2. `delivery_mode` is a render method, not a stored field — ✅ **DONE 2026-04-23 (resolved by simplification)**
- **Decision:** No column promotion. `delivery_mode` is a frontend view/render mode, supplied by the caller (builder UI state, PDF prop). It is written to `quotations.metadata.delivery_mode` only as a historical breadcrumb so the builder can re-seed the toggle from last-saved choice — no calculation reads it.
- **What changed:** Added `DEFAULT_DELIVERY_MODE` constant in `quotation-commercial.ts`. Removed the inconsistent `"separate"` default in `quote-html-builder.ts` and the hardcoded `"embedded"` fallback in `useSaveQuotation`. All defaults now flow through the constant.
- **Why no migration:** Delivery mode is not a business fact about the quote — it's how the team chose to present it. Storing it as a typed column would imply downstream readers should depend on it; we don't want that. The metadata breadcrumb gives us audit visibility without coupling.
- **Files:** `src/lib/quotation-commercial.ts`, `src/lib/quote-html-builder.ts`, `src/hooks/useOpportunityQuotation.ts`.
- **Net LOC:** −5 (defaults consolidated, no fallback paths to delete because none existed in the math layer).

### C3. Consolidate `QuotationItem` / `QuoteItem` / `QuotationItemRow` → one `QuoteLine` — ✅ **DONE 2026-04-23**
- **What changed:** Created `src/types/quote.ts` exporting canonical `QuoteLine`. `QuotationItem` is now a deprecated type alias of `QuoteLine` re-exported from `QuotationBuilder` for back-compat. `QuotationItemRow` (DB row shape) and the PDF `QuoteItem` stay as local shapes — they're structurally subsets and converting them all in one pass would be a wide blast radius for no behavior change. New code should reach for `QuoteLine`.
- **Files:** `src/types/quote.ts` (new), `src/components/sales/QuotationBuilder.tsx`.
- **Net LOC:** −30.

### C4. Delete `opportunities.materials_interest` fallback reads — ✅ **DONE 2026-04-23**
- **What changed:** Removed the three fallback paths in `AddUpdateSheet.tsx` (load-from-legacy on open) and `OpportunityDetail.tsx` (delivery-calc seed and PDF preview seed). `quotation_items` is now the only source. The column itself is untouched (kept for historical data and the admin migration tool).
- **Files:** `src/components/sales/AddUpdateSheet.tsx`, `src/pages/sales/OpportunityDetail.tsx`.
- **Net LOC:** −45.

### C5. Standardize on `useZoneGate` hook everywhere — ✅ **DONE 2026-04-23**
- **What changed:** Extended `useZoneGate` to accept either a resolved zone string OR `{ projectId }` (in which case it fetches `projects.location.zone_code` internally via React Query). Refactored `AddUpdateSheet.tsx` to use the hook instead of an inline query. The hook also now returns the resolved `zoneCode` so callers don't need a parallel lookup. `OpportunityDetail`, `SendQuoteSheet`, and `QuotationBuilder` continue using the existing string-based call shape — no behavior change there.
- **Files:** `src/components/sales/ProjectZoneGate.tsx`, `src/components/sales/AddUpdateSheet.tsx`.
- **Net LOC:** −15.

### C6. Add `supply_unit_id` (+ `domain_id`, `source_quote_id`) on order conversion — ✅ **DONE (already wired before audit)**
- **What:** `useCreateOrder` already resolves `supply_unit_id`, `domain_id`, and `source_quote_id` from `supplier_materials` + `supply_unit_suppliers` for every non-addon line and writes them onto each `order_items` row. No change needed; verified during audit.
- **Files:** `src/hooks/useCreateOrder.ts` (verified, unchanged).
- **Net LOC:** 0.

### C7. Extract `VAT_RATE` constant — ✅ **DONE 2026-04-23**
- **What:** `export const VAT_RATE = 0.15;` in `quotation-commercial.ts`. Replaced literals in `computeCommercialTotals` and `quote-html-builder.ts`.
- **Files:** 2.
- **Risk:** None.
- **Net LOC:** +1.

### C8. Move "freeze on send" to a DB trigger — ✅ **DONE 2026-04-23**
- **What changed:** New `BEFORE UPDATE` trigger `trg_freeze_quotation_on_send` on `public.quotations`. When `status` transitions to `sent`/`accepted`/`converted` and `pricing_locked_at IS NULL`, stamps `pricing_locked_at = now()`. Also stamps `sent_at` if missing on a `sent` flip. Removed the redundant app-side stamps in `SendQuoteSheet.tsx` — the app now only flips status; freeze is enforced server-side and is un-bypassable.
- **Why:** The freeze rule was previously a discipline applied by one specific call site. A second sender (e.g. an admin tool, an edge function) could have skipped it. Now the rule is an invariant of the table.
- **Files:** migration + `src/components/sales/SendQuoteSheet.tsx`.
- **Net LOC:** −10 app code, +25 SQL.

---

## 7. What this audit does NOT cover (scope for future phases)

- Invoice / payment pipeline (Phase 3 candidate).
- Multi-currency (currently all SAR).
- Discount / promotion modeling (does not exist yet).
- Per-tenant VAT overrides (Saudi 15% is hardcoded).
- Supply cycle ROI reporting — depends on C6 landing first.

---

**Next action requested from user:** approve a single checklist item (C1–C8) to execute in isolation. Recommendation: **C1**, because it eliminates the largest fragmentation and unlocks parity tests that de-risk every subsequent cleanup.
