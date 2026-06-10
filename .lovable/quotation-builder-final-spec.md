# Sales Quotation Builder — Final Implementation Spec

**Status:** Implementation-ready spec  
**Scope:** Sales quotation + price list builder, pricing calculation, supplier selection integration, lifecycle, templates, export/send flow  
**Primary principle:** One builder, one supplier resolver, one backend commercial calculation engine, one official document creator.

---

## 1. Purpose

The Sales Quotation Builder must generate accurate, auditable, customer-facing quotations and price lists based on the new supplier selection system.

The system must prevent duplicate commercial logic, prevent sales users from seeing internal cost/margin data, and ensure sent quotations/price lists are frozen and traceable.

---

## 2. Locked architecture principles

### 2.1 Single source of truth rules

The final system must have:

1. **One live builder surface**
   - Global Activity / OpportunitySection is the only active quotation entry surface.
   - Legacy AddUpdateSheet quotation flow must be removed from live usage.

2. **One supplier resolver**
   - Both selected and quality modes must use `resolve_supplier(material_code, zone_code, requested_role)`.
   - No live quotation path may use `resolve_effective_supplier`.

3. **One backend commercial calculation engine**
   - Backend calculates and freezes official pricing.
   - Sales frontend displays only customer-facing results.
   - Sales frontend must not calculate or expose raw commercial internals.

4. **One official document creator**
   - One official template/document generation path only.
   - Legacy PDF edge function must not be used in live quotation or price list flow.

---

## 3. Quotation and price list types

The system supports two commercial document types:

| Type | Meaning | Quantity behavior | Lifecycle |
|---|---|---|---|
| Quotation | Firm order quotation | Has quantities | Full lifecycle |
| Price list | Price list / soft quote | No required quantities | Same lifecycle as quotation |

Price list is not casually replaceable. Once sent, it is frozen and should be treated as an official commercial document.

---

## 4. Coding system

### 4.1 Current code structure

The existing code system must be preserved. Do not replace it with simplified codes like `QOT-001`.

Current structure:

```text
accounts.code        = SAL.NNNN
projects.code        = <account.code>_NNN
opportunities.code   = <project.code>_NNN
quotations.code      = <opportunity.code OR order.code> + suffix + NNN
```

Examples:

```text
SAL.0001_001_001_QOT.001
SAL.0001_001_001_QOT.002
SAL.0001_001_001_PL.001
```

### 4.2 QOT and PL counters

Quotation and price list counters are independent:

```text
_QOT.001, _QOT.002, ...
_PL.001, _PL.002, ...
```

### 4.3 Code creation

- Code is created on insert.
- Draft quotations and draft price lists receive official codes immediately.
- Code does not change when status changes.
- No customer-facing `V1`, `V2`, or `Version 2` wording should appear.

### 4.4 Version column

The existing `quotations.version` column may remain internally if needed, but it must not drive customer-facing identity.

Customer-facing identity is the official full code only.

Remove or override template/footer text that displays `Version {{version}}` to the customer.

---

## 5. Lifecycle

### 5.1 Statuses

Use only the practical lifecycle:

```text
draft → sent
sent → accepted, when opportunity becomes won
sent → rejected, only if opportunity is lost after the quotation was sent
```

`converted` is not needed in this phase.

### 5.2 Draft behavior

- Draft can be saved flexibly.
- Draft has an official code immediately.
- Only one active draft per opportunity per document type should exist.
- If an existing draft exists, continue editing it.
- Draft saving may allow incomplete data, but clear warnings/blockers should be shown.

### 5.3 Sending behavior

Sending is the official transition from draft to commercial document.

When user sends:

1. Validate quotation/price list.
2. Recalculate through backend engine.
3. Freeze commercial data.
4. Save pricing trace.
5. Set status to `sent`.
6. Stamp `sent_at` and `pricing_locked_at`.
7. Lock sent quote/list from editing.
8. Log send action / communication action.
9. Allow manual download/print/export.

### 5.4 Sent document immutability

Sent quotation or price list must be immutable.

After `pricing_locked_at` is set:

- Do not allow edits to sent quotation header commercial fields.
- Do not allow insert/update/delete on sent quotation items.
- Allow only safe lifecycle/admin fields where needed, such as accepted status, accepted_at, notes if explicitly safe.

### 5.5 Edit after send / revise behavior

If a sent quotation or price list needs changes:

1. User clicks a clear **Revise** action.
2. System creates a new draft.
3. New draft receives a new official full code.
4. New draft clones previous sent items as a starting point.
5. User can edit/remove/reorder items in the new draft.
6. Old sent document remains frozen in history.

No revert/restore/compare system is needed in this phase.

---

## 6. Supplier selection integration

### 6.1 Supplier mode

Quotation has one supplier mode:

```text
selected | quality
```

Default is:

```text
selected
```

Persist this on the quotation header, e.g.:

```text
quotations.supplier_role
```

### 6.2 Resolver rule

All material lines must resolve suppliers through:

```text
resolve_supplier(material_code, zone_code, requested_role)
```

This applies to both selected and quality mode.

### 6.3 Fallback behavior

If requested mode is `selected`:

```text
selected → quality → cheapest active backup
```

If requested mode is `quality`:

```text
quality → selected → cheapest active backup
```

Cheapest backup means cheapest landed price for the requested zone.

If no usable supplier exists:

```text
No supplier found for this item/zone. Contact supply team.
```

### 6.4 Usability checks

A supplier candidate is usable only if it has:

- valid/current supplier quote,
- not expired,
- not rejected if quote rejection exists,
- delivery coverage for the zone,
- calculable landed price.

---

## 7. Line types

The builder supports only three line types:

| Line type | Pricing | Supplier resolver | Delivery grouping | Editable by sales |
|---|---|---|---|---|
| Material line | System-priced | Yes | Yes | Qty only / allowed non-price fields |
| Custom line | Manual | No | No | Yes |
| Add-on line | Manual | No | No | Yes |

### 7.1 Material lines

Material lines are system-priced only.

Sales must not edit:

- supplier raw price,
- delivery price,
- margin,
- calculated customer unit price.

### 7.2 Custom lines

Custom lines are fully manual additions.

They do not affect:

- supplier selection,
- delivery grouping,
- delivery cost,
- margin rules,
- material pricing.

Sales can edit:

- name,
- description,
- quantity,
- unit,
- unit price,
- optional supplier/reference text.

### 7.3 Add-on lines

Add-ons behave like custom manual additions.

They do not affect supplier, delivery, or margin logic.

---

## 8. Delivery calculation

### 8.1 Delivery mode

For this phase:

```text
embedded delivery only
```

Hide/disable separate delivery mode in sales UI.

`delivery_mode` may remain in DB with default `embedded`, but it must not create alternate commercial logic in this phase.

### 8.2 Delivery source

For now, one supplier equals one delivery source.

No yard/branch logic.

If a supplier later has multiple branches, treat them as separate suppliers.

### 8.3 Grouping rule

Delivery is calculated by group, not line-by-line.

Group material lines by:

```text
supplier + zone + delivery rate
```

Only material lines enter delivery grouping.

### 8.4 Trip calculation

For now, use existing `moq` as delivery trip capacity.

Do not add a new `trip_capacity` field in this phase.

Calculation:

```text
total_group_quantity = sum(quantity for grouped material lines)
trips = ceil(total_group_quantity / moq)
total_delivery_cost = trips × delivery_rate.price_per_moq
delivery_per_unit = total_delivery_cost / total_group_quantity
```

Then each line gets:

```text
landed_unit_cost = supplier_unit_price + delivery_per_unit
```

### 8.5 Delivery warnings

Warnings should be shown to sales when relevant, but not inside the customer document.

Example warning:

```text
Delivery requires 2 trips. The last trip is not fully utilized, so delivery cost per unit increased.
```

This is a warning, not a blocker.

### 8.6 Price list delivery

Price list has no quantities.

For price lists, estimate delivery using full trip capacity:

```text
delivery_per_unit = delivery_trip_price / full delivery trip capacity
```

Do not call it MOQ in customer-facing text.

Use customer-facing wording like:

```text
Prices are estimated based on full delivery trip capacity. Final prices may vary depending on confirmed order quantity and delivery trip utilization.
```

---

## 9. Margin model

### 9.1 Margin hierarchy

Margin hierarchy is:

```text
1. Material override
2. Subcategory override
3. System default
```

No quotation type margin.

No salesperson margin edit.

Admin-only margin management remains outside this phase unless needed to ensure default exists.

### 9.2 Default margin

A system default margin must always exist.

Do not silently fall back to `0%`.

If no margin rule resolves, the backend should treat this as a configuration problem.

### 9.3 Margin application

Margin applies on landed unit cost:

```text
landed_unit_cost = supplier_unit_price + allocated_delivery_per_unit
selling_unit_price = landed_unit_cost × (1 + margin_pct / 100)
```

---

## 10. Backend commercial calculation engine

### 10.1 Authority

Backend is the pricing authority.

Sales frontend is not allowed to calculate or expose internal pricing details.

Frontend may display final customer-facing results returned from backend.

### 10.2 Required backend calculation

Backend must calculate:

- supplier per material line,
- delivery grouping,
- trip count,
- delivery per unit,
- landed unit cost,
- margin source and margin pct,
- selling unit price,
- line total,
- subtotal,
- VAT if still applicable,
- grand total,
- blockers and warnings,
- pricing trace.

### 10.3 Suggested RPCs/functions

Implementation can decide exact names, but recommended:

```text
compute_quotation_totals(quotation_id)
validate_quotation(quotation_id)
revise_quotation(quotation_id)
```

`compute_quotation_totals` should be the official backend calculator.

---

## 11. Pricing trace

### 11.1 Purpose

Every material line should have hidden pricing trace for audit/debug.

Sales should not see this.

Admin/debug view can expose it later, preferably for sent quotations.

### 11.2 Storage

Use either:

```text
quotation_items.pricing_trace jsonb
```

or a dedicated trace table if the codebase strongly prefers it.

### 11.3 Trace contents

Trace should include at minimum:

```text
supplier_id
supplier_role_requested
supplier_role_used
supplier_scope_used
was_fallback
supplier_quote_id / supplier_material_id
supplier_unit_price
zone_code
delivery_rate_id
delivery_moq_used_as_trip_capacity
group_quantity
trip_count
total_delivery_cost_for_group
delivery_per_unit
landed_unit_cost
margin_source
margin_rule_id
margin_pct
selling_unit_price
line_total
warnings
resolver_version / calculation_version
calculated_at
```

---

## 12. Sales UI behavior

### 12.1 Sales should see

Sales can see:

- item description,
- quantity,
- UoM,
- customer unit price or customer line total,
- final totals,
- status chips,
- blockers,
- warnings,
- selected vs quality quotation mode.

### 12.2 Sales should not see

Sales should not see:

- raw supplier price,
- raw delivery cost,
- margin percentage,
- landed cost,
- pricing trace,
- supplier cost calculation.

### 12.3 Material line editing

For material lines, sales should not manually override system-generated prices.

Admin-only override can be added later, but not in this phase.

---

## 13. Send blockers and warnings

### 13.1 Draft save

Draft can be saved even if incomplete.

### 13.2 Send blockers

Sending must be blocked if any of the following exists:

- no project/opportunity zone,
- unresolved material supplier,
- no valid supplier quote,
- missing delivery rate,
- calculation failed,
- invalid quantity for quotation,
- missing required customer/project information.

Missing margin should not normally happen because system default margin must exist.

If it does happen, it is a configuration blocker.

### 13.3 Warning examples

Warnings do not block sending.

Examples:

- quality mode fell back to selected,
- selected mode fell back to quality or backup,
- delivery requires extra trip because quantity exceeded one trip capacity,
- price list price is estimated based on full trip capacity,
- price or delivery changed since draft was first calculated, if staleness tracking exists.

### 13.4 Error message style

Messages must be clear and actionable.

Bad:

```text
Cannot send quotation.
```

Good:

```text
Cannot send: delivery rate is missing for Supplier A in Zone 05.
```

Good:

```text
Cannot send: no selected or quality supplier found for Cement Block 20cm in this zone.
```

---

## 14. Validity, payment terms, VAT, discount

### 14.1 Validity

Every quotation and price list must show:

```text
Valid until: [date]
```

Default:

```text
7 days from issue/send date
```

If drafts need preview validity, use created date + 7 days. On send, stamp/finalize validity as send date + 7 days unless already intentionally set.

### 14.2 Payment terms

Payment terms can remain fixed template text for now.

No editable payment terms model is required in this phase.

### 14.3 VAT

VAT remains as currently designed unless implementation finds a blocking issue.

If VAT is computed only at render time today, document this clearly. Do not introduce a separate tax model unless needed.

### 14.4 Discount

No discount in this phase.

Do not add header discount or line discount.

---

## 15. Templates and document generation

### 15.1 Official document creator

Use one official creator:

```text
buildQuoteHtml or its improved replacement
```

All previews and exports must use the same official document creator.

### 15.2 Export method

For this phase, manual export is acceptable:

- preview,
- browser print/download PDF,
- manual WhatsApp/email sending by user.

No real WhatsApp/email automation in this phase.

### 15.3 Legacy PDF edge function

The legacy `generate-quotation-pdf` edge function must not be used in live quotation/price list flow.

If safe, remove or disable its UI callers and config exposure.

### 15.4 Template content

Template should include:

- company info,
- customer info,
- project/location,
- official code,
- issue date,
- valid until,
- line items,
- totals,
- fixed payment/terms text,
- notes if applicable.

No document snapshot is needed.

Freeze the commercial data, not the visual design.

Old sent documents can render with updated design later, as long as their frozen data remains unchanged.

---

## 16. Legacy cleanup

### 16.1 Remove legacy builder surface

Remove quotation use from:

```text
AddUpdateSheet
```

If AddUpdateSheet is completely dead, it can be removed or unexported.

At minimum:

- remove from `components/sales/index.ts` exports,
- remove quotation builder mounting,
- remove legacy PDF buttons,
- ensure no live route can use it for quotations.

### 16.2 Remove/deprecate legacy supplier hooks

Remove live usage of:

```text
resolve_effective_supplier
useEffectiveSupplier
SupplierPriceSelector
```

No live quotation path should depend on them.

### 16.3 Disable legacy PDF edge function usage

Ensure no live UI calls:

```text
generate-quotation-pdf
```

If left deployed, mark as deprecated and not reachable from UI.

---

## 17. Database changes expected

Exact implementation may vary, but likely changes include:

### 17.1 Quotations

Add or confirm:

```text
supplier_role text default 'selected'
```

Keep:

```text
code
is_soft
quote_type
status
sent_at
accepted_at
pricing_locked_at
valid_until
delivery_mode default 'embedded'
metadata
```

Add DB constraint/index:

```text
one active draft per opportunity per document type
```

Recommended uniqueness scope should consider:

```text
opportunity_id / order_id
is_soft
status = 'draft'
```

### 17.2 Quotation items

Add:

```text
pricing_trace jsonb
```

Confirm material/custom/add-on typing is clean:

```text
item_kind
is_custom_item
parent_line_id
addon_definition_id
```

### 17.3 Immutability triggers

Add trigger(s) to block unsafe edits after sent/pricing lock.

Block edits to:

- sent quotation commercial fields,
- sent quotation items.

Allow only safe lifecycle updates.

---

## 18. Implementation phases

### Phase 1: DB foundations

- Add draft uniqueness protection.
- Add sent quotation immutability trigger(s).
- Add `quotations.supplier_role`.
- Add `quotation_items.pricing_trace`.
- Ensure `valid_until` default/send behavior.
- Ensure `delivery_mode` default is embedded.
- Remove customer-facing version footer default.

### Phase 2: Resolver unification

- Rewrite `resolve_line_pricing` or replace with new backend pricing function that calls `resolve_supplier` for both selected and quality.
- Remove live usage of `resolve_effective_supplier`.
- Remove live usage of `useEffectiveSupplier`.

### Phase 3: Backend commercial engine

- Build official backend calculation function.
- Calculate grouped delivery by supplier + zone + delivery rate.
- Use MOQ as trip capacity for now.
- Apply margin on landed cost.
- Persist final line/customer totals.
- Persist pricing trace.
- Return blockers and warnings.

### Phase 4: Builder UI cleanup

- Use only Global Activity / OpportunitySection as live builder surface.
- Hide separate delivery toggle.
- Hide raw price, delivery, supplier cost, margin.
- Keep material lines system-priced.
- Keep custom/add-on lines manual.
- Show blockers/warnings clearly.

### Phase 5: Lifecycle UI

- Add Revise action for sent quotations/price lists.
- Revise creates new draft with new official code.
- Clone previous sent items into new draft.
- Old sent documents remain read-only history.

### Phase 6: Send/export validation

- Send calls backend validation.
- Block send on blockers.
- Freeze commercial data on send.
- Log send action.
- Use one official document creator.
- Keep manual PDF/download/share flow.

---

## 19. Acceptance checklist

The implementation is accepted only when all are true:

- Only Global Activity / OpportunitySection is the live quotation builder surface.
- AddUpdateSheet cannot create/edit/export/send quotations.
- No live quotation path calls legacy PDF edge function.
- No live quotation path uses `resolve_effective_supplier`.
- Selected and quality both use `resolve_supplier`.
- `supplier_role` is persisted on quotation.
- Backend is the official commercial calculator.
- Sales UI does not show raw supplier price, delivery cost, margin, or trace.
- Material lines are system-priced only.
- Custom/add-on lines are manual and excluded from supplier/delivery logic.
- Delivery is grouped by supplier + zone + delivery rate.
- Delivery uses `ceil(total_group_quantity / moq)`.
- Margin applies on landed cost.
- Separate delivery mode is hidden/disabled.
- Pricing trace is stored for material lines.
- Valid until is set and rendered.
- No customer-facing Version/V1/V2 text appears.
- Draft has official code immediately.
- Sent documents are immutable.
- Revising after send creates new draft, new official code, cloned items.
- Price list follows same lifecycle as quotation.
- Send blockers and warnings are separated.
- Manual export/send flow works.

---

## 20. Out of scope for this phase

- Real WhatsApp/email automation.
- Customer approval/signature flow.
- Discounts.
- Admin manual price override.
- Line-level supplier override.
- Separate delivery display mode.
- Yard/branch delivery logic.
- New trip_capacity field.
- Payment terms editor.
- Full role-based permission redesign.
- Admin pricing trace UI, except optionally minimal debug/admin readout if already easy.

