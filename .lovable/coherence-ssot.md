
# Scale Platform — Supply & Sales Coherence Spec

**Status:** authoritative working spec for cleanup and rebuild direction
**Purpose:** replace fragmented assumptions with one coherent operating model
**Important:** do **not** implement from old assumptions if they conflict with this document

The current platform already has a broad supply and sales implementation, including supply domains, cycles, quotations, target prices, and test-mode scoping, but the verification audit found that the platform is **not structurally solid yet** because key invariants are enforced only in app code, test isolation is partial, renegotiation is a dead-end, domain promotion is lossy, and target prices currently have dual unsynced truths. This spec is intended to correct that direction, not merely patch the existing flows.  

## 1. Core definitions

### Geography

* **Zone**: the smallest geographic unit
* **Area**: a named group of zones

### Material dimension

* **Group**: the top grouping value used by the domain grouping axis
* **Material variation**: the actual material row used in quoting, pricing, and ordering

### Business intersections

* **Domain** = **Area × Group**
* **Unit** = **Zone × Group**
* **Atom** = **Zone × Material variation**

### Pricing intersections

* **Default target price** = **Area × Material variation**
* **Override target price** = **Zone × Material variation**

### Terminology rule

The frontend must reflect this terminology clearly and consistently.
Users should be able to understand the system visually through these exact definitions.

## 2. Core architectural rules

### 2.1 Supply cycle

A supply cycle is a **decision workspace** across multiple domains.

The user usually works in the cycle, but the committed defaults are saved at the **domain** level.

### 2.2 Supplier defaults and overrides

Supplier selection follows a **default + override** model:

* decisions are made in the cycle
* defaults are saved on the **domain**
* domain defaults apply to child units and atoms by resolution logic
* the system must **not** create rows on every unit or atom just because a default exists
* only explicit exceptions create unit or atom overrides

### 2.3 Effective supplier resolution

For any unit or atom, the effective supplier should resolve in this order:

1. atom override
2. else unit override
3. else domain default

This must be implemented systematically and not left as ambiguous UI behavior.

### 2.4 Never auto-assign missing coverage

The system must never auto-fill uncovered parts with fallback suppliers.

If a default supplier covers only part of the domain:

* the uncovered part stays flagged
* the admin manually chooses overrides at unit or atom level

## 3. Supplier roles

Each domain may have multiple meaningful supplier roles, not just one winner:

* **selected supplier**: commercial / best-price default
* **quality supplier**: quality-first option, may be more expensive
* **fallback suppliers**: backup suppliers

This means the system must stop treating supplier truth as a single simplistic promoted record. The current audited promotion model compresses unit decisions into domain truth, overwrites previous values, and loses nuance. That behavior should be replaced. 

## 4. Supplier selection UX

The main operational selection surface should be a **matrix**.

### Matrix structure

* **Rows**: material variations
* **Columns**: suppliers
* **Fixed benchmark columns**: target price, best price, average price, coverage, selected supplier, quality supplier, flags

### Matrix behavior

The user should be able to:

* compare suppliers across many materials quickly
* sort by coverage
* sort by best price
* see quality vs selected clearly
* detect missing coverage immediately
* select defaults at cycle/domain level
* identify where manual overrides are required

### Coverage behavior

Coverage should be a first-class concept:

* show percentage of atoms or units covered by a supplier for the selected domain or cycle
* if a supplier covers most but not all, the uncovered portions must be surfaced and flagged for manual override

## 5. Core materials behavior

Every material subcategory already distinguishes **core materials** from others. This must be respected consistently in the workflow.

### Core materials

* expanded by default
* benchmarked first
* target-priced first
* prioritized in comparison and selection
* later used for order analytics and attention

### Non-core materials

* collapsed by default
* still visible and selectable
* target prices may be set manually if needed
* not the primary focus of the workflow

## 6. Target price model

### 6.1 One target-price truth only

There must be only **one authoritative target-price system**.

The current platform has both:

* `target_prices` keyed by `(material_id, area_id)`
* `supply_domain_targets` keyed by `(domain_id, material_id)`

These are currently unsynchronized and must not remain as parallel truths. 

### 6.2 Correct target-price ownership

Target prices belong to **geography + material**, not to domain rows.

Store target prices like this:

* default target: **Area × Material variation**
* override target: **Zone × Material variation**

Do **not** make domain the storage owner of target prices.

### 6.3 Suggested unified target price table

Use one target-price table conceptually shaped like:

* `material_id`
* `scope_type` = `area` or `zone`
* `scope_id`
* `best_price`
* `average_price`
* `target_price`
* `source_mode` = `best` | `average` | `manual`
* `is_locked`
* note / audit fields

### 6.4 Target price screen behavior

The target-price UI should be a matrix.

* rows: material variations
* columns: areas by default
* optional drill-down or filtered view for zones

Each cell should show:

* best price
* average price
* current target price
* lock state

### 6.5 Recalculate behavior

When recalculating:

* use supplier quotations and quotation items
* by default include only **active, non-expired** quotations
* allow admin to optionally include expired quotations via explicit checkbox
* never overwrite locked cells

### 6.6 Editing behavior

Admin can:

* fill all unlocked cells from best price
* fill all unlocked cells from average price
* choose best or average per cell
* set manual target price
* lock cells so recalculation and bulk fill do not change them

## 7. Renegotiation model

### 7.1 Current state problem

Today renegotiation is effectively a passive case record. The current implementation stores `replacement_quote_id` but does not update target prices, supplier defaults, assignments, or sales awareness. That behavior must not be treated as complete. 

### 7.2 Correct behavior

Completed cycles are historical and must stay untouched.

If something changes after completion, such as:

* quote expiry
* new supplier quote
* supplier price change
* quality issue
* coverage issue
* benchmark change

the system should:

1. flag the affected domain for **review**
2. surface that mainly in the **coverage view**
3. allow the admin to create a **new cycle** if needed
4. never auto-open a new cycle
5. never rewrite the completed cycle automatically

### 7.3 Renegotiation meaning

Renegotiation is a **review trigger**, not a patch workflow on old truth.

## 8. Coverage view

### 8.1 Purpose

Coverage view is the main operational review view for:

* supplier defaults
* overrides
* uncovered units/atoms
* review flags
* supplier footprint
* optional customer/project/opportunity overlays

### 8.2 Base map behavior

Use the existing zone/region map foundation already in the system.
Do not build a separate map stack.

Default visual:

* zone and area geometry
* no noisy basemap by default
* optional basemap toggle
* clean polygon-first presentation

### 8.3 Coverage statuses

The view must clearly distinguish:

* covered by domain default
* overridden at unit
* overridden at atom
* uncovered
* review needed

### 8.4 Filters and layers

Support filters for:

* region
* area
* subcategory
* group/domain
* material variation
* supplier
* coverage/review status

Support optional layers for:

* areas
* zones
* supplier plants
* customers
* projects
* opportunities
* review flags

### 8.5 Click behavior

Clicking a zone/area/domain should open a structured side panel showing:

* effective supplier
* whether result comes from default or override
* coverage state
* target price
* best and average price
* review flags
* relevant actions

## 9. Sales integration

The sales module is largely in good shape and should **not** be redesigned.
It needs coherence fixes with the new supply model.

The original audit already shows sales has a mature route/component footprint, while the main instability sits in the supply truth and the weak bridge into quotation/order provenance. 

### 9.1 Opportunity / quotation role

The opportunity remains the quotation workspace from lead to win/loss.

### 9.2 Best vs quality switch

Inside the opportunity, the salesperson must be able to switch simply between:

* **best price**
* **quality**

Resolution should follow the same supply truth:

1. overrides first
2. then defaults

If certain items do not have a quality option while others do, the system should:

* keep the UX simple
* flag this clearly
* explain that some lines stayed on default/best because no quality path exists

### 9.3 Delivery handling

Default behavior:

* quotations should usually show **clean all-in unit prices**
* delivery should be embedded inside the item price by default

This means the practical default is:

* landed cost already includes delivery allocation
* margin is added on landed cost
* quote shows one final item price

If the client wants delivery separated:

* salesperson can switch to separate-delivery presentation
* this is a supported mode, but not the default

### 9.4 Margin hierarchy

Margin overrides must support this hierarchy:

1. global margin
2. subcategory margin override
3. material margin override

Margin is applied on **full landed cost including delivery**.

VAT is then applied afterward.

### 9.5 Unsupplied material interest

Sales must be able to express demand even when supply is missing.

The opportunity must support:

* selecting an item from the material registry even if it has no current supply
* or entering a temporary free-text material request if it does not exist in the registry

This demand should be recorded as interest and should not be blocked by supply constraints.

### 9.6 Quote staleness / review

If an opportunity or quotation is still open and the underlying supply truth changes, such as:

* supplier price change
* quote expiry
* selected/default supplier change

then the opportunity / quotation should be flagged systematically for the salesperson.
Later this should connect into notifications and tasks.

## 10. Schema direction

### 10.1 Keep

Keep these core concepts:

* regions
* zones
* areas
* materials
* supply domains
* supply cycles
* supplier quotes
* supplier materials
* delivery allocation logic
* opportunities
* quotations
* orders

### 10.2 Redesign

Redesign these behaviors:

* domain supplier persistence
* target prices
* renegotiation
* sales-to-supply provenance
* supply default/override resolution

### 10.3 Strong candidates to remove or collapse

#### `supply_domain_targets`

This should not remain as a separate source of truth.
Target prices must live in the unified geography+material target table.

#### `unlock_cycle_materials`

This must justify its existence.
If the cycle already derives materials from selected domains and area zone codes, and then produces units, this table may be redundant or merely a snapshot/helper artifact. The current audited flow explicitly creates `unlock_cycles + supply_cycle_domains + unlock_cycle_materials + supply_units`; this must be simplified if the table is not truly needed. 

#### current `supply_domain_suppliers` behavior

The concept may survive, but not as a lossy overwrite-only promoted summary.
It should become an explicit **domain directive/default** layer with proper meaning, not a compressed artifact of cycle completion.

## 11. Provenance and historical truth

### 11.1 Orders

Orders should preserve enough provenance to explain why a supplier/material price was chosen.

The audit found current order items carry snapshot price and supplier account but do not trace back to supply decision context strongly enough. That gap must be closed. 

### 11.2 Historical cycles

Completed cycles remain historical snapshots.
No silent mutation.

### 11.3 Historical quotations

Sales quotations may remain as sent snapshots, but if underlying supply truth changes while the quotation is still open, the system must flag it for review.

## 12. Test / sandbox isolation

The current scoped `is_example` model is partial and inconsistent across supply-adjacent tables, including renegotiation and sales/order tables. Some critical flows also bypass the scoped client. This spec does **not** approve the current isolation model as final architecture.  

Implementation planning must choose one coherent approach:

* proper environment/workspace scoping in one database
* or physically separate sandbox/live environments

Do not continue expanding the current half-scoped model blindly.

## 13. Critical implementation rules

### Must be enforced at DB/backend level, not only UI

* approved quote invariants
* effective supplier invariants
* environment isolation logic
* integrity of default vs override resolution

The verification audit explicitly found critical invariants are currently app-only. That must change. 

## 14. Build phases

### Phase 1: model lock

* align terminology in UI and code
* adopt this operating model as SSOT
* stop building against conflicting assumptions

### Phase 2: schema cleanup

* unify target-price truth
* redesign domain default layer
* decide fate of `unlock_cycle_materials`
* add clean override structures
* add provenance fields for quotations/orders where needed

### Phase 3: enforcement

* move critical invariants to DB/backend
* fix approved quote logic
* fix supplier selection integrity
* choose and implement coherent test isolation

### Phase 4: UX rebuild where required

* supplier selection matrix
* target price matrix
* coverage view
* small sales coherence edits

## 15. Non-goals for this phase

Do not redesign the entire sales module.
Do not build an advanced notification system first.
Do not overbuild the map before source-of-truth cleanup is done.
Do not keep parallel pricing truths.

## 16. Final directive to Lovable

Do not treat the current implementation as the desired truth just because screens already exist.

Use the audits only as evidence of:

* what currently exists
* what is structurally broken
* what must be preserved
* and what must be replaced

This document is the new operating model to build toward.

