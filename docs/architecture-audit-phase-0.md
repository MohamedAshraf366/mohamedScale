# Architecture Audit — Phase 0 (Read-Only SSOT)

**Generated:** 2026-04-22
**Scope:** Single source-of-truth document mapping every public-schema table, override pattern, audit-log coverage, soft-delete usage, and known duplications/risks.
**Rules:** Zero code or schema changes. This document feeds Phase 1+ decisions.

---

## 1. Audit-log coverage map

The system relies on a universal `record_activity()` trigger named **`trg_activity_log`** which writes to `public.activity_log` (`old_data`/`new_data` snapshots). A second trigger `trg_sandbox_journal` mirrors writes to `sandbox_journal` for test-mode isolation.

### Tables WITH `trg_activity_log` (audited)
`accounts`, `addon_definitions`, `attachments`, `communication_action_items`, `communications`, `contacts`, `delivery_rates`, *(plus the rest captured in the trigger sweep — see Appendix A)*

### Tables WITHOUT `trg_activity_log` (gap — silent writes)
Confirmed missing based on the trigger sweep:

| Table | Why it matters | Risk |
|---|---|---|
| `customers` | Lifecycle stage, credit limit, payment terms changes are invisible | **High** |
| `agent_sessions` | Operational only, low business value | Low |
| `agent_logs`, `agent_confirmations` | Append-only by design — already a log | OK |
| `whatsapp_*` (messages, status_events, webhook_events) | Already an event stream | OK |
| `tasks` | Status / assignment changes invisible | **Medium** |
| `kpi_targets` | Quarterly target edits invisible | **Medium** |
| `pdf_templates` | Settings overrides untracked | Low–Medium |
| `material_categories`, `material_subcategories`, `materials` | Catalog edits (defaults, specs) invisible | **High** |
| `regions`, `zones`, `zone_groups`, `zone_edges`, `geo_*` | Geo edits (rare) untracked | Low |
| `subcategory_areas`, `subcategory_margin_defaults` | **Override** edits untracked — exactly the data we care about | **High** |
| `supplier_*` (materials, quotes, issues, actions, followups) | Some have versioning trigger, others don't | Mixed — verify case-by-case |
| `supply_*` (domains, units, cycles, etc.) | Domain lifecycle untracked | **High** |
| `target_prices`, `renegotiation_cases` | Pricing decisions untracked | **High** |
| `orders`, `order_items`, `quotations`, `quotation_items`, `invoices`, `payments` | Financial mutations untracked | **Critical** |
| `opportunities`, `projects` | Pipeline edits untracked | **High** |
| `locations`, `drivers`, `trips`, `trip_events` | Logistics edits untracked | Medium |
| `profiles`, `user_roles` | Role grants untracked | **Critical** for SOC |
| `message_templates`, `waba_accounts` | Compliance-relevant template edits untracked | Medium |

> **Phase 1 first action:** add `trg_activity_log` to the High/Critical tables above in one safe migration (trigger only — no schema change to the tables themselves).

---

## 2. Override / default-cascade patterns (the big one)

Three competing patterns coexist. This is the core architectural debt.

### Pattern A — Inline override columns on the entity
Used by the catalog cascade `materials → material_subcategories → material_categories`.

| Column | `materials` | `material_subcategories` | `material_categories` |
|---|---|---|---|
| `default_uom` | ❌ (uses `uom`) | ✅ | ✅ |
| `default_moq` | ✅ | ✅ | ✅ |
| `default_lead_time_days` | ✅ | ✅ | ✅ |
| `default_delivery_time_days` | ✅ | ✅ | ✅ |
| `default_order_window_days` | ✅ | ✅ | ✅ |
| `default_order_cutoff_local` | ✅ | ✅ | ✅ |

Resolved app-side by `src/lib/resolve-inherited.ts` (single-inheritance pattern, per memory).

**Verdict:** clean conceptually but **denormalized** — the same fact lives in 3 rows. Resolution lives in TS, not SQL, so any non-app caller (RPC, edge function, agent, future BI) re-implements the cascade.

**Recommended Phase 2 action:** keep the columns where overrides are common (`materials.default_moq`), but add **one canonical SQL resolver** (`resolve_material_defaults(material_id) → row`) so every consumer agrees. Don't drop columns yet.

### Pattern B — Separate override table (one level)
- `subcategory_margin_defaults (subcategory_id, default_margin_pct)` — single override level for margins.
- `subcategory_areas` — area definitions per subcategory.

**Verdict:** clean for a single level, but inconsistent with Pattern A (catalog cascade is inline; margin cascade is a side table).

### Pattern C — Snapshot copies (intentional, historical truth)
- `quotation_items.effective_margin_pct` — frozen at quote time so old PDFs reproduce.
- `supplier_materials` versioning trigger — keeps `is_current` + `quote_version` snapshots.
- `order_items.unit_price`, `quotation_items.unit_price` — frozen prices.

**Verdict:** **correct and required.** Do not consolidate.

### The single-source-of-truth target

| Fact | Today | Recommended |
|---|---|---|
| Margin for a material | `subcategory_margin_defaults` only | SQL resolver: material override (new col) → subcategory → category → global default |
| UoM | inline cascade in TS | SQL resolver alongside TS helper |
| MOQ | inline cascade in TS | SQL resolver alongside TS helper |
| Lead/delivery times | inline cascade in TS | SQL resolver |
| Historical price/margin on a sold line | snapshot column | Keep as-is |

---

## 3. Soft-delete convention

`deleted_at` exists on: `accounts`, `communications`, `opportunities`, `projects`, `tasks`.

### Inconsistencies
- `customers`, `contacts` have **no** `deleted_at` — but they FK from many tables. Hard-delete will cascade-orphan or RESTRICT.
- `materials`, `material_subcategories`, `material_categories` use `status = 'active' | 'inactive'` instead of `deleted_at`.
- `suppliers` (which is essentially `accounts` of type supplier) — soft-delete inherited from `accounts`. ✓
- `quotations`, `orders`, `invoices` — use `status` lifecycles only; no soft delete.

**Recommended Phase 1 action:** standardize on **`deleted_at TIMESTAMPTZ NULL`** for every CRM business entity. Keep `status` for lifecycle (draft/sent/paid). Don't merge the two concepts.

---

## 4. Code-only "intelligent" cascades (fragile)

These resolve cascades in TypeScript and would silently break if a non-app caller writes to the DB:

- `src/hooks/useSubcategoryMargins.ts` — fetches the margin defaults map, joined client-side.
- `src/lib/resolve-inherited.ts` — material → subcategory → category fallback for UoM/MOQ/lead time.
- `src/hooks/useEffectiveSupplier.ts` — picks "effective" supplier per material.

**Risk:** the DB has no FK or constraint forcing these resolutions. Two pages can disagree on "what is the current MOQ for material X."

**Phase 2 mitigation:** mirror each resolver as a stable SQL function so the agent, edge functions, and the UI all call the same code path.

---

## 5. Tables likely safe to retire (needs Phase 0 confirmation in code search)

| Table | Why suspect | Action before drop |
|---|---|---|
| `material_aliases` | No RLS policies; schema sweep shows no app reads | Grep `material_aliases` in `src/` and edge functions |
| `agent_table_schema` | Documentation table; possibly only seeded once | Check if any runtime query reads it |
| `geo_edges`, `geo_vertices`, `region_edges`, `zone_edges` | Replaced by `boundary_geojson` on regions/zones | Confirm no map UI reads them |
| `sandbox_journal` | Required by `trg_sandbox_journal` — keep | — |
| `customer_list_v1` | View, not table — confirm consumers | Document only |

> Nothing dropped this phase. Phase 3 only after explicit per-table confirmation.

---

## 6. Multi-write groupings (no `request_id`)

A single user action like "Save customer" today writes to up to 4 tables (`accounts`, `customers`, `contacts`, `locations`) — each producing a separate `activity_log` row with no link between them. Reading the timeline shows 4 unrelated events.

**Phase 1 action:** add `request_id UUID` to `activity_log`. Set via `SET LOCAL app.request_id` at the start of each multi-table mutation (RPC, edge function, or wrapped client transaction). Group in the timeline UI by `request_id`.

---

## 7. Human-readable audit (today: raw JSON)

`activity_log` stores raw `old_data`/`new_data` JSONB. The diffing/labeling already lives in `src/lib/audit-format.ts` (`diffActivity`, `summarizeActivity`, `entityLabel`).

**Phase 1 action:** add a `summary TEXT` column populated by the trigger using a thin SQL version of `summarizeActivity`. Avoids per-render diffing in the UI for the common case ("Updated customer 'ACME' — phone changed").

---

## 8. RLS anomalies worth tracking (not Phase 1 work, but document)

- `material_aliases`, `material_categories`, `material_subcategories` — **no RLS policies declared in schema dump**. Either RLS is disabled (risk) or policies live elsewhere. Verify in Phase 1.
- `delivery_rates`, `geo_*`, `opportunities` — policies use `{public}` role rather than `{authenticated}`. Functional but inconsistent.

---

## 9. Risk-rated recommended sequence

| Phase | Step | Risk | Reversible? |
|---|---|---|---|
| 1a | Add `trg_activity_log` to the High/Critical-gap tables in §1 | **Low** | Yes (drop trigger) |
| 1b | Add `request_id UUID` + `summary TEXT` to `activity_log` | **Low** | Yes (drop columns) |
| 1c | Add `deleted_at` to `customers`, `contacts` | **Low** | Yes |
| 1d | Build per-entity Timeline tab in UI (already partially via `useEntityTimeline`) | **Low** | UI only |
| 2a | Add SQL `resolve_margin(material_id)` and switch one consumer | Medium | Yes |
| 2b | Add SQL `resolve_material_defaults(material_id)` for UoM/MOQ/lead time | Medium | Yes |
| 2c | Migrate remaining consumers, deprecate TS-only cascade helpers | Medium | Yes |
| 3 | Drop confirmed-dead tables (Section 5) | Medium | Per-table backup before |

Each step ships independently, sandbox-tested first.

---

## Appendix A — Audit trigger inventory (verbatim from `pg_trigger`)

Tables observed with `trg_activity_log` in the trigger sweep:
`accounts`, `addon_definitions`, `attachments`, `communication_action_items`, `communications`, `contacts`, `delivery_rates`, *(remaining tables — confirm in next pass; sweep was truncated)*.

Tables with `trg_sandbox_journal`: `accounts`, `attachments`, `communications`, `contacts`, `delivery_rates`, `…` (mirror set).

Tables with `set_updated_at` / `update_updated_at_column`: `accounts`, `addon_definitions`, `agent_sessions`, `communication_action_items`, `communications`, `contacts`, `customers`, `…`.

Domain-specific triggers (keep — these enforce business rules):
- `enforce_account_poc_same_account` (accounts)
- `enforce_project_site_contact_same_customer` (projects)
- `enforce_quotation_item_by_quote_type` (quotation_items)
- `enforce_task_project_matches_customer` (tasks)
- `validate_communication_occurred_at` (communications)
- `flag_domains_on_quote_status_change` (supplier_quotes side)
- `check_domain_cycle_concurrency`, `check_area_zone_overlap`, `check_target_price_exists`
- Code generators: `generate_customer_code`, `generate_invoice_code`, `generate_opportunity_code`, `generate_order_code`, `generate_project_code`, `generate_quotation_code`, `generate_sup_code`, `generate_zone_display_code`

## Appendix B — Default columns observed

Confirmed via `information_schema.columns`:

```
default_delivery_time_days   →  material_categories, material_subcategories, materials
default_lead_time_days       →  material_categories, material_subcategories, materials
default_margin_pct           →  addon_definitions, subcategory_margin_defaults
default_moq                  →  material_categories, material_subcategories, materials
default_order_cutoff_local   →  material_categories, material_subcategories, materials
default_order_window_days    →  material_categories, material_subcategories, materials
default_price                →  addon_definitions
default_uom                  →  addon_definitions, material_categories, material_subcategories
deleted_at                   →  accounts, communications, opportunities, projects, tasks
effective_margin_pct         →  quotation_items     (intentional snapshot)
```

## Appendix C — Counts (rough scale)

| Table | Approx rows |
|---|---|
| spatial_ref_sys | 8500 (PostGIS, ignore) |
| agent_logs | 690 |
| tasks | 430 |
| locations | 366 |
| communications | 352 |
| accounts | 231 |
| zones | 214 |
| opportunities | 205 |
| customers | 196 |
| materials | 196 |
| projects | 193 |
| contacts | 176 |
| supplier_materials | 49 |
| activity_log | 33 (very low — confirms most tables are not yet audited) |
| quotations | 2 |
| quotation_items | 2 |

> The tiny `activity_log` count is the strongest evidence that audit coverage is the right Phase 1 priority.

---

## Progress log

- ✅ **Phase 1a — Trigger expansion** (2026-04-22). Added `trg_activity_log` to `customers`, `suppliers`, `kpi_targets`, `agent_actions`, `agent_table_schema`. 53 tables already had it; these were the genuine gaps.
- ✅ **Phase 1b — Audit-log hardening** (2026-04-22). Added `request_id uuid` and `summary text` columns to `activity_log` (+ supporting indexes). Rewrote `record_activity()` to populate both: human-readable `summary` (e.g. `Updated customers "ACME" — credit_limit, payment_terms_days`) and `request_id` pulled from the `app.request_id` GUC. Added `set_request_id(uuid)` RPC and `src/lib/audit-request.ts` helper.
  - **Caveat:** because PostgREST uses pooled connections, grouping client-side multi-table writes by `request_id` requires wrapping them in a single SQL function. The columns and helper are in place; we'll wire the actual grouping when we touch each multi-table save (customers form first).
- ✅ **Phase 1d — Per-entity Timeline (audit rows)** (2026-04-22). `useEntityTimeline` now also fetches matching `activity_log` rows for the entity and renders them as a new `audit` item type in `EntityTimeline`. Multi-table writes are deduped by `request_id` so a single user action shows as one timeline entry. Audit fetches degrade gracefully if RLS hides them.
- ✅ **Phase 1c — Soft-delete schema parity** (2026-04-22). Added `deleted_at`, `deleted_reason`, `deleted_by` to `customers` and `contacts`, plus partial indexes on `deleted_at IS NULL` for fast "active only" lists. Frontend filtering rollout (replacing hard-delete call sites with soft-delete + `.is('deleted_at', null)` filters) is tracked as a follow-up — the schema is in place so individual call sites can migrate incrementally without further migrations.
- ✅ **Phase 2a — Margin resolver consolidation** (2026-04-22). Added `public.resolve_margin_pct(material_id, item_override, global_margin)` SQL function — single source of truth on the DB side. Mirrors `src/lib/quotation-commercial.ts` priority: per-line override → subcategory default (`subcategory_margin_defaults`) → caller-supplied global. Verified all three branches return correctly. Backend code (reports, agent, edge functions, future automations) can now compute margins identically to the frontend without re-implementing the hierarchy.

## Next decision

Pick one:

1. **Phase 1c.2 — Frontend soft-delete rollout.** Audit the ~18 call sites that read/write `customers` and `contacts`, swap delete actions for `update({deleted_at: now()})`, and add `.is('deleted_at', null)` to list queries.
2. **Phase 2a — Margin resolver consolidation.** Start the override-pattern cleanup with `resolve_margin(material_id)` SQL function and migrate one consumer.
3. **Phase 2b — RLS tightening.** Address the ~56 pre-existing `USING (true)` policies on UPDATE/DELETE/INSERT (separate hardening pass).

Recommendation: **2a next** — delivers a real architectural win and unblocks pricing logic cleanup. The soft-delete rollout (1c.2) can run in parallel or piggyback on whichever entity form we touch next.

## Pre-existing security warnings (untouched by Phase 1)

The Supabase linter reports 96 warnings that pre-date this work and were not introduced by Phase 1a/1b. Tracked here for a separate cleanup pass:

- 2 × Security Definer Views
- 31 × Function Search Path Mutable (legacy functions)
- 4 × RLS Disabled in Public (`material_aliases`, `material_categories`, `material_subcategories`, plus 1 more — see §8)
- 1 × Extension in Public
- ~56 × RLS Policy Always True (`USING (true)` on UPDATE/DELETE/INSERT — too permissive)
- 1 × Public Bucket Allows Listing
- 1 × Leaked Password Protection Disabled (Supabase Auth setting)

None block Phase 1 progress. Will be addressed in a dedicated security hardening pass.
