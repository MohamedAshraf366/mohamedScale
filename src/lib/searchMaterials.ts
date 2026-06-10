/**
 * Phase 2.1 — shared deterministic material search.
 *
 * Consumed by:
 *   • In-cell autocomplete in the new QuoteLineGrid
 *   • MaterialStepPicker (later)
 *   • quote-extract edge function (Phase 2.5 — mirrored server-side)
 *
 * Algorithm:
 *   1. Tokenize query (EN + Arabic-normalized, digits folded).
 *   2. Fetch candidate rows from material_search_index whose bag matches
 *      ANY token (ilike OR), capped at 300 rows.
 *   3. Score = matched_tokens / total_tokens, with bonuses for:
 *        • exact code match            (+0.5)
 *        • contiguous query substring  (+0.2)
 *        • alias / display match       (+0.05 each)
 *   4. Drop scores below threshold, sort desc by score then by code.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as defaultSupabase } from "@/integrations/supabase/client";

export interface SearchMaterialOptions {
  limit?: number;
  threshold?: number;
  subcategoryId?: string;
  categoryId?: string;
  client?: SupabaseClient<any>;
}

export interface SearchMaterialHit {
  material_id: string;
  subcategory_id: string | null;
  category_id: string | null;
  code: string | null;
  display_en: string | null;
  display_ar: string | null;
  score: number;
  matched_tokens: string[];
  snippet: string;
}

const ARABIC_INDIC_DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

const ARABIC_DIACRITICS = /[\u064B-\u0652\u0670]/g;

/** Normalize a string for tokenizing/matching: lowercase, fold Arabic digits/diacritics. */
export function normalizeForSearch(input: string): string {
  if (!input) return "";
  let out = input.toLowerCase();
  out = out.replace(/[٠-٩۰-۹]/g, (d) => ARABIC_INDIC_DIGITS[d] ?? d);
  out = out.replace(ARABIC_DIACRITICS, "");
  out = out.replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
  return out;
}

/** Split a normalized query into search tokens (≥2 chars, dedup). */
export function tokenize(query: string): string[] {
  const norm = normalizeForSearch(query);
  const raw = norm.split(/[\s,.\-_/\\()[\]{}]+/).filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of raw) {
    const tok = t.length === 1 && /\d/.test(t) ? t : t.length >= 2 ? t : "";
    if (!tok || seen.has(tok)) continue;
    seen.add(tok);
    out.push(tok);
  }
  return out;
}

function scoreCandidate(
  tokens: string[],
  normQuery: string,
  bag: string,
  code: string | null,
): { score: number; matched: string[] } {
  if (tokens.length === 0) return { score: 0, matched: [] };
  const normBag = normalizeForSearch(bag);
  const normCode = normalizeForSearch(code ?? "");

  const matched: string[] = [];
  for (const t of tokens) {
    if (normBag.includes(t) || normCode.includes(t)) matched.push(t);
  }
  if (matched.length === 0) return { score: 0, matched };

  let score = matched.length / tokens.length;
  if (normCode && normCode === normQuery) score += 0.5;
  if (normQuery.length >= 4 && normBag.includes(normQuery)) score += 0.2;
  return { score: Math.min(score, 1.5), matched };
}

function buildSnippet(bag: string, matched: string[], max = 120): string {
  if (!bag) return "";
  const normBag = normalizeForSearch(bag);
  let pos = -1;
  for (const t of matched) {
    const i = normBag.indexOf(t);
    if (i >= 0 && (pos === -1 || i < pos)) pos = i;
  }
  if (pos < 0) return bag.slice(0, max);
  const start = Math.max(0, pos - 20);
  const end = Math.min(bag.length, start + max);
  return (start > 0 ? "…" : "") + bag.slice(start, end) + (end < bag.length ? "…" : "");
}

/**
 * Search the material_search_index for matches.
 * Returns hits scored ≥ threshold, sorted desc.
 */
export async function searchMaterials(
  query: string,
  options: SearchMaterialOptions = {},
): Promise<SearchMaterialHit[]> {
  const { limit = 20, threshold = 0.4, subcategoryId, categoryId } = options;
  const client = options.client ?? defaultSupabase;

  const normQuery = normalizeForSearch(query);
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  // Fetch candidates: bag ILIKE ANY token. Limit 300 to keep client work bounded.
  // We use the `or` builder for ilike across tokens.
  const orClause = tokens.map((t) => `bag.ilike.%${t}%`).join(",");

  let q = client
    .from("material_search_index")
    .select("material_id,subcategory_id,category_id,code,display_en,display_ar,bag")
    .or(orClause)
    .limit(300);

  if (subcategoryId) q = q.eq("subcategory_id", subcategoryId);
  if (categoryId) q = q.eq("category_id", categoryId);

  const { data, error } = await q;
  if (error) {
    console.warn("[searchMaterials] index query failed", error);
    return [];
  }

  const rows = data ?? [];
  const scored: SearchMaterialHit[] = [];
  for (const r of rows) {
    const { score, matched } = scoreCandidate(tokens, normQuery, r.bag ?? "", r.code);
    if (score < threshold) continue;
    scored.push({
      material_id: r.material_id,
      subcategory_id: r.subcategory_id,
      category_id: r.category_id,
      code: r.code,
      display_en: r.display_en,
      display_ar: r.display_ar,
      score,
      matched_tokens: matched,
      snippet: buildSnippet(r.bag ?? r.display_en ?? "", matched),
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.code ?? "").localeCompare(b.code ?? "");
  });
  return scored.slice(0, limit);
}

// ─── Status enrichment ──────────────────────────────────────────────────────
// Used by quotation builder's inline material cell to show, per hit:
//   • hasSupplier        — any approved supplier_material exists
//   • hasDeliveryInZone  — supplier_material covered by a delivery_rate in zone
//   • hasTargetPrice     — supply-side target price defined
// Single batched query per material set, suitable for short dropdowns.

export interface MaterialStatus {
  hasSupplier: boolean;
  hasDeliveryInZone: boolean;
  hasTargetPrice: boolean;
}

export async function fetchMaterialStatuses(
  materialIds: string[],
  zoneCode: string | null | undefined,
  client: SupabaseClient<any> = defaultSupabase,
): Promise<Record<string, MaterialStatus>> {
  const out: Record<string, MaterialStatus> = {};
  if (!materialIds.length) return out;
  for (const id of materialIds) {
    out[id] = { hasSupplier: false, hasDeliveryInZone: false, hasTargetPrice: false };
  }

  const { data: sms } = await client
    .from("supplier_materials")
    .select("id, material_id, supplier_account_id")
    .in("material_id", materialIds)
    .eq("is_current", true);

  const smRows = sms ?? [];
  const smIdSet = new Set<string>();
  const supplierIds = new Set<string>();
  for (const sm of smRows as any[]) {
    out[sm.material_id].hasSupplier = true;
    smIdSet.add(sm.id);
    supplierIds.add(sm.supplier_account_id);
  }

  if (zoneCode && smRows.length > 0) {
    const { data: rates } = await client
      .from("delivery_rates")
      .select("supplier_account_id, zone_codes, supplier_material_ids, is_default")
      .in("supplier_account_id", Array.from(supplierIds));
    const matRatesBySupplier = new Map<string, Array<any>>();
    for (const r of (rates ?? []) as any[]) {
      const arr = matRatesBySupplier.get(r.supplier_account_id) ?? [];
      arr.push(r);
      matRatesBySupplier.set(r.supplier_account_id, arr);
    }
    for (const sm of smRows as any[]) {
      const rs = matRatesBySupplier.get(sm.supplier_account_id) ?? [];
      const covered = rs.some((r) => {
        const zoneOk = !r.zone_codes?.length || r.zone_codes.includes(zoneCode);
        const matOk = r.is_default || !r.supplier_material_ids?.length || r.supplier_material_ids.includes(sm.id);
        return zoneOk && matOk;
      });
      if (covered) out[sm.material_id].hasDeliveryInZone = true;
    }
  }

  // Target prices (best-effort; table may not exist in older deployments)
  try {
    const { data: tps } = await client
      .from("target_prices" as any)
      .select("material_id")
      .in("material_id", materialIds);
    for (const tp of (tps ?? []) as any[]) {
      if (out[tp.material_id]) out[tp.material_id].hasTargetPrice = true;
    }
  } catch {
    /* ignore — table optional */
  }

  return out;
}
