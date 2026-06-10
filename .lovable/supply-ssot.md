Treat this message as the **SSOT (Single Source of Truth)** for the Supply system upgrade.

You have no reliable prior context. Do not rely on earlier assumptions unless they match this document exactly.

## Working mode

* This SSOT defines the target architecture for the Supply upgrade.
* Do **not** redesign the system from scratch.
* Do **not** remove existing tables.
* Prefer minimal, compatible changes to the current schema and current UI.
* Preserve compatibility with existing Sales behavior, especially anything that depends on `supplier_materials.status='approved'` and `is_current=true`.
* Do **not** execute or auto-apply DB migrations without explicit review/approval.
* For DB work, always return migrations **one by one** for approval before implementation.
* Frontend-only fixes can be proposed and implemented separately after review.

---

# 1. Current architectural direction to preserve

We are upgrading the existing Supply backbone, not replacing it.

Existing core backbone to preserve:

* `supplier_quotes`
* `supplier_materials`
* `supplier_quote_delivery_lines`
* `delivery_rates`
* `target_prices`
* `subcategory_areas`
* `unlock_cycles`
* `unlock_cycle_materials`
* existing supplier/account/contact/location/zones structure
* existing Sales compatibility with approved/current supplier materials

Existing page backbone to preserve and extend:

* `/supply/unlock`
* `/supplier-materials`
* `/suppliers/:id`

---

# 2. Product model — authoritative rules

## A. Geography model

There are two distinct layers:

### Planning layer

* planning target price is at:

  * **material variation × area**
* `target_prices` remains the benchmark structure
* `subcategory_areas` remains the planning geography structure

### Operational layer

* real operational supply decisioning is at:

  * **material variation × zone**
* zones are the operational truth for:

  * coverage
  * landed cost
  * supplier assignment
  * selected/backup ranking

This distinction is intentional and must be preserved.

---

## B. Quote and approval model

* a quote is a **container/package**
* review and approval are **item-level**
* a supplier may send:

  * a full new quote
  * or only partial changes
* the system must be **diff-aware**
* unchanged items should preserve prior decision where appropriate
* changed items should require fresh review
* the same logic must apply to:

  * material items
  * delivery terms
  * zone coverage changes

---

## C. Delivery and landed price

Supplier quotations contain:

* material items
* delivery lines

Target price is the **all-inclusive final benchmark**.

That means evaluation must use **landed price**, not raw material price alone.

Important:

* delivery does **not** always follow area
* delivery can vary by zone, even inside the same area
* one delivery line can cover multiple materials
* a quote can contain multiple delivery lines
* MOQ must be considered in evaluation

Therefore the system must explicitly model allocation between:

* quote items
* delivery lines
* covered zones

Default v1 logic:

* explicit apportionment structure exists in the DB
* default allocation method can be `equal`
* future methods can include `by_moq`, `by_value`, `manual`

---

## D. Supplier selection model

After approval, the system must support supplier assignment at the **supply unit** level.

Operational supply unit:

* **material variation × zone**

Each supply unit can have:

* zero or more selected suppliers
* zero or more backup suppliers

Both selected and backup suppliers must be ranked inside each supply unit.

Ranking is mainly by:

* landed price
* with supplier rating as an additional factor

Management can later:

* change ranking
* move selected to backup
* move backup to selected
* freeze
* remove from specific supply units
* blacklist

---

## E. Renegotiation

Renegotiation is a separate entry path into the same commercial engine.

Initial triggers:

* package validity expiry / reconfirmation
* target price reduction
* manual trigger

Rules:

* approved items should not disappear immediately
* while renegotiation is in progress, prior approved items may remain selectable with warning
* if supplier sends changed commercial terms, a new quotation / updated quotation is required
* the system should only force re-review for changed parts where possible

---

## F. Price confirmation and validity

Validity is tracked at the **approved quotation package** level.

Source of truth:

* `supplier_quotes.valid_until`

Important compatibility rule:

* existing `supplier_materials.price_valid_until` is **legacy / ignored**
* keep it in schema
* do not use it for system decisions
* all new validity logic uses `supplier_quotes.valid_until`

Rules:

* outreach happens before expiry
* even “no change” still requires management/admin approval
* while waiting for approval, price can remain selectable with warning
* if supplier says price changed or delivery changed, require new quotation
* if supplier does not respond:

  * expiring soon
  * then expired
* partial response should still result in the required updated quotation/details

Automation for validity is **first-class**, not optional-later.
Initial deployment may use test/shared numbers if needed.

---

## G. Supplier relationship management

Supply Officer can:

* raise issues
* flag risks
* log incidents

Management can:

* send warnings
* freeze from new approvals
* move selected supplier to backup
* remove supplier from specific supply units
* blacklist
* take other management-controlled actions if consistent with this model

Warnings and action items must be visible in the UX.
Only management applies the stronger actions.

---

## H. Agreement handling

Do not build a heavy uploaded-contract workflow in this phase.

For first pass:

* agreement handling is lightweight and app-native
* the approved quote/package is the main commercial basis
* agreement/terms can be generated/stored inside the app later
* agreement is **not** phase-1 critical
* do not let agreement handling delay the core commercial engine

---

# 3. Authoritative target data model

## 3.1 Existing tables to preserve structurally

Keep and extend compatibility with:

* `supplier_quotes`
* `supplier_materials`
* `supplier_quote_delivery_lines`
* `delivery_rates`
* `target_prices`
* `subcategory_areas`
* `unlock_cycles`
* `unlock_cycle_materials`
* `suppliers`
* `materials`
* shared account/contact/location/zone tables

Do not remove these.

---

## 3.2 Required minimal schema changes

### Change 1: `supplier_quotes.valid_until`

Add:

* `valid_until date`

Purpose:

* package-level validity source of truth

---

### Change 2: `supplier_materials.status`

Extend existing allowed statuses to include:

* `shortlisted`

Authoritative item flow:

* `quoted`
* `under_review`
* `shortlisted`
* `negotiating`
* `approved`
* `rejected`
* `passed`

Important:

* keep compatibility with Sales:

  * `approved` + `is_current=true` remains the selection contract for Sales
* `shortlisted` must **not** affect Sales compatibility

---

### Change 3: `suppliers.is_blacklisted`

Add:

* `is_blacklisted boolean not null default false`

Purpose:

* fast supplier-level management state

---

### Change 4: `supply_units` (new table)

This is a **first-class entity**.

Purpose:

* real operational unit
* material variation × zone
* cycle-scoped
* supports progress, cycle KPIs, activation timing, and supplier assignment

Required shape:

* `id`
* `cycle_id` → required FK to `unlock_cycles`
* `material_id`
* `zone_code`
* `area_id` nullable
* `status` with at least:

  * `planned`
  * `sourcing`
  * `active`
  * `frozen`
  * `inactive`
* `target_price` snapshot/denormalized field if useful
* `activated_at`
* notes/audit timestamps

Authoritative uniqueness:

* **UNIQUE (cycle_id, material_id, zone_code)**

Do **not** model supply units as globally unique across all cycles.

Reason:

* cycle KPIs/history must stay clean
* the same material×zone may appear in multiple cycles over time

If something is approved outside an explicit cycle, propose a safe fallback, but do not weaken the cycle model.

---

### Change 5: `supplier_quote_delivery_allocations` (new table)

This is mandatory.

Purpose:

* explicit linkage of:

  * quote item
  * delivery line
  * zone
* stores apportioned delivery share
* makes landed price trustworthy
* powers diff-aware delivery review
* powers trustworthy sync into `delivery_rates`

Required shape:

* `id`
* `supplier_quote_id`
* `supplier_material_id`
* `delivery_line_id`
* `zone_code`
* `unit_price` snapshot
* `moq` snapshot
* `raw_delivery_price_per_moq`
* `allocation_method`
* `allocation_share_pct`
* `allocated_delivery_per_moq`
* `landed_price_per_unit`
* `is_changed`
* `prior_allocation_id`
* `created_at`

Required rules:

* `allocation_method` supports at least:

  * `equal`
  * `by_moq`
  * `by_value`
  * `manual`
* `landed_price_per_unit` must be based on the **allocated** share, not the raw line price
* allocation shares for each `(delivery_line_id, zone_code)` group should total 100
* when implementing, propose safe enforcement via RPC or trigger-backed validation, not UI-only trust

Default v1:

* use `equal`

Diff logic:

* compare against prior allocation for same supplier/material/zone
* unchanged allocation should be identifiable

---

### Change 6: `supply_unit_suppliers` (new table)

Purpose:

* selected/backup/candidate supplier ranking per supply unit

Required shape:

* `id`
* `supply_unit_id`
* `supplier_account_id`
* `supplier_material_id`
* `delivery_allocation_id`
* `role`
* `rank`
* `landed_price`
* freeze fields
* notes/audit timestamps

Recommended roles:

* `candidate`
* `selected`
* `backup`

Important:

* ranking lives here
* this is assignment/ranking only
* `supply_units` remains the real operational parent entity

---

### Change 7: `renegotiation_cases` (new table)

Mandatory.

Purpose:

* track renegotiation as a real case object
* trigger provenance
* workflow state
* visibility
* history/audit

Required shape:

* `id`
* `supplier_account_id`
* `original_quote_id`
* `replacement_quote_id` nullable
* `trigger_type`:

  * `validity_expiry`
  * `target_price_reduction`
  * `manual`
* `trigger_ref_id` nullable
* `status`:

  * `open`
  * `outreach_sent`
  * `quote_received`
  * `under_review`
  * `resolved`
  * `cancelled`
* assignment / resolution / notes / audit fields

---

### Change 8: `supplier_quote_validity` (new table)

Purpose:

* package-level validity lifecycle
* outreach
* supplier response
* management approval
* link to renegotiation when needed

Recommended statuses:

* `active`
* `expiring_soon`
* `outreach_sent`
* `supplier_confirmed`
* `supplier_changed`
* `management_approved`
* `expired`

Should link to:

* `supplier_quotes`
* optional `renegotiation_case_id`

---

### Change 9: `supplier_issues` (new table)

Purpose:

* issue / risk tracking

Should support at least:

* delay
* quality
* pricing
* communication
* other/manual

Needs:

* severity
* status
* supplier linkage
* optional material linkage
* resolution fields
* audit fields

---

### Change 10: `supplier_actions` (new table)

Purpose:

* management action history

Should support actions like:

* warning
* freeze
* unfreeze
* demote_to_backup
* remove_from_unit
* blacklist
* unblacklist

Can optionally link to:

* supplier issue
* affected supply unit

---

### Explicitly deferred from phase 1

* `supplier_agreements`

Do not prioritize this in phase 1 unless there is a strong implementation reason.

---

# 4. Parent/child relationship model — authoritative

## Planning and operational chain

* `unlock_cycles`

  * parent planning container

* `unlock_cycle_materials`

  * defines which materials are targeted in the cycle

* `supply_units`

  * real operational units inside the cycle
  * one per `(cycle_id, material_id, zone_code)`

* `supply_unit_suppliers`

  * suppliers ranked/assigned to the supply unit

## Commercial chain

* `supplier_quotes`

  * package container

* `supplier_materials`

  * item rows under the quote

* `supplier_quote_delivery_lines`

  * delivery rows under the quote

* `supplier_quote_delivery_allocations`

  * joins quote items + delivery lines + zone-level effect
  * trusted landed-price evidence

## Case and monitoring chain

* `renegotiation_cases`

  * tied to quote/package context

* `supplier_quote_validity`

  * package validity lifecycle
  * can trigger / link to renegotiation case

## SRM chain

* `supplier_issues`
* `supplier_actions`

---

# 5. Critical compatibility rules

## Sales compatibility

Do not break current Sales assumptions.
`useSupplierPrices` and any Sales readers that depend on:

* `supplier_materials.status='approved'`
* `supplier_materials.is_current=true`

must continue to work.

## Delivery sync correction

Current system has a known bug where quote approval writes raw material IDs into `delivery_rates.supplier_material_ids`.
That must be fixed using `supplier_quote_delivery_allocations` and actual approved `supplier_materials.id`, not the current incorrect mapping.

## Bulk-pass correction

Current bulk pass is too broad and must be scoped.

## Area-save safety

Current area save is non-atomic and should be moved into a safe transactional path.

---

# 6. Authoritative workflow direction

## A. Unlock workflow

1. cycle planning
2. areas and target prices
3. supply units generated / managed
4. quotes collected
5. items evaluated
6. items shortlisted
7. items negotiated / approved
8. approved items populate ranked suppliers per supply unit

## B. Renegotiation workflow

1. create renegotiation case from trigger
2. outreach / quote update
3. diff changed vs unchanged
4. changed parts re-enter review
5. prior approved items remain selectable with warning while case is open where appropriate
6. new approved outcome updates supply-unit rankings

## C. Validity workflow

1. monitor `supplier_quotes.valid_until`
2. pre-expiry outreach
3. supplier response intake
4. management approval even for “no change”
5. changed response requires new quotation
6. expired / changed can trigger renegotiation case

## D. SRM workflow

1. officer raises issues
2. management reviews warnings/actions
3. management can freeze/demote/remove/blacklist
4. supplier state affects supply-unit assignment and warnings in UI

---

# 7. KPI direction — must remain supported

The architecture must support KPI derivation for at least:

* planned supply units
* activated supply units
* activation/compliance by cycle
* average unit unlock duration
* new selected suppliers
* renegotiation-related supplier/unit outcomes
* supplier issue metrics
* validity-at-risk metrics
* landed price vs target metrics

This is one reason supply units must be cycle-scoped.

---

# 8. Implementation order — authoritative

Do not implement everything at once.

## Phase 0 — frontend-only fixes

1. fix delivery sync bug
2. fix bulk pass scope

## Phase 1A — core schema

1. add `supplier_quotes.valid_until`
2. add `shortlisted` to `supplier_materials.status`
3. add `suppliers.is_blacklisted`
4. create `supply_units`
5. create `supplier_quote_delivery_allocations`
6. create `supply_unit_suppliers`

## Phase 1B — case/tracking schema

7. create `renegotiation_cases`
8. create `supplier_quote_validity`
9. create `supplier_issues`
10. create `supplier_actions`

## Phase 2 — query/hook layer

* update existing quote/material hooks
* add new hooks for supply units, allocations, renegotiation, validity, SRM

## Phase 3 — quote flow enhancement

* create allocations on quote submit
* landed-price logic
* diff-aware update handling
* corrected `delivery_rates` sync
* shortlist support

## Phase 4 — supply unit management

* supply unit views
* assignment/ranking UI
* unlock page integration

## Phase 5 — validity + renegotiation

* monitoring
* outreach
* approval queue
* renegotiation case UI

## Phase 6 — SRM

* issues page
* management action layer
* supplier-level and supply-unit-level warnings/effects

---

# 9. What I want from you now

Using this SSOT:

## Step 1

Return a **review-first implementation package**, not code execution.

It must include:

### A. Current-system alignment

Briefly confirm how this SSOT maps onto the current codebase and current DB.

### B. Migration manifest for approval

Return the 10 migrations above, each as:

* title
* exact purpose
* dependencies
* compatibility impact
* rollback idea
* affected hooks/pages/components
* any backfill or trigger/RLS/index notes

Do **not** execute them yet.

### C. Phase 0 fixes

Return the exact files/components that must change for:

* delivery sync bug
* bulk pass scoping

### D. Implementation notes

Call out any places where current code or schema conflicts with this SSOT.

## Step 2

After we review and approve each migration, then implementation can begin incrementally.

Again:

* do not auto-run migrations
* do not jump into implementation before returning the review package
* this message is the authoritative SSOT for the Supply upgrade
