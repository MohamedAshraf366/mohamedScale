# Test/Sandbox Isolation — Architecture Memo

**SSOT §3.6 deliverable**

## Current State

The app uses a partial `is_example` boolean column on ~12 tables to separate test and live data within a single database. A `ScopedClient` proxy auto-injects this filter.

### Known weaknesses
- Not all tables are scoped (materials, subcategories, categories, regions, zones are shared)
- Some hooks still bypass the scoped client (now fixed in Phase 3)
- No DB-level enforcement — scoping is purely client-side
- Cross-mode data corruption is possible if scoped client is bypassed

## Option A: Workspace scoping in one database

Evolve `is_example` into a proper `workspace_id` column (or keep boolean).

**Pros:**
- No infrastructure change
- Single database backup/restore
- Shared reference data (materials, zones) is natural
- Already partially implemented

**Cons:**
- Every query must remember to scope (error-prone without DB-level enforcement)
- RLS policies would need per-workspace rules
- Performance: indexes must include workspace column
- Testing migrations affects production schema

**Implementation path:**
1. Add RLS policies that enforce `is_example` matching per-user session variable
2. Set session variable on login based on user's active workspace
3. Remove client-side scoping proxy (RLS handles it)

## Option B: Separate environments (databases or schemas)

Use separate Supabase projects or PostgreSQL schemas for test vs. live.

**Pros:**
- Complete isolation — impossible to corrupt across environments
- No per-query scoping needed
- Independent migrations and rollbacks
- Clean security boundary

**Cons:**
- Infrastructure cost (2× Supabase projects)
- Reference data must be synced or duplicated
- App must manage connection switching
- More complex deployment pipeline

**Implementation path:**
1. Create a second Supabase project for sandbox
2. Add environment switcher that changes the Supabase client config
3. Sync reference data (materials, zones) via a periodic job or shared read-only schema

## Recommendation

**Option A (workspace scoping)** is the pragmatic choice for now:
- The existing `is_example` pattern works and is mostly complete
- Adding RLS enforcement would make it robust
- Avoids the operational overhead of managing two projects
- Can evolve to Option B later if the business requires true environment separation

### Next steps (not in this phase)
1. Add a `set_config('app.is_example', ...)` call on session init
2. Create RLS policies using `current_setting('app.is_example')::boolean`
3. Remove the client-side `ScopedClient` proxy once RLS handles it
4. Audit all unscoped tables and decide which need scoping
