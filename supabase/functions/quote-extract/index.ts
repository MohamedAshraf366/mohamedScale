// Edge function: quote-extract
// Replaces the n8n `bulk_supplier_materials.v1` worker.
// Pipeline: vision extract → load indexes → LLM material match → deterministic
// post-processing (Arabic digits, VAT math, supplier scoring) →
// build confirm_preview + commit_payload → insert into agent_confirmations.
//
// Output contract is intentionally identical to the existing worker so the
// frontend can switch transparently.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ────────────────────────────────────────────────────────────────────────────
// Pure helpers (exported for unit tests)
// ────────────────────────────────────────────────────────────────────────────

const ARABIC_DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

export function toAsciiDigits(s: unknown): string {
  return String(s ?? '').replace(/[٠-٩]/g, (d) => ARABIC_DIGITS[d] ?? d);
}

/** Normalize a possibly-Arabic, possibly-formatted number string. */
export function parseLooseNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = toAsciiDigits(v).trim();
  s = s.replace(/[^0-9.,-]/g, '');
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    // whichever appears LAST is the decimal separator
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.'); // EU style 1.234,56
    } else {
      s = s.replace(/,/g, ''); // US style 1,234.56
    }
  } else if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.');
  }
  const parts = s.split('.');
  if (parts.length > 2) s = parts.slice(0, -1).join('') + '.' + parts.at(-1);
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function normalizeArabicLatin(s: unknown): string {
  return toAsciiDigits(s)
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();
}

/**
 * Compute (excl, incl) prices given the LLM extraction signals.
 * Returns the prices plus a `flags` array describing assumptions made.
 */
export function reconcileVat(opts: {
  unit_price_text?: string | null;
  unit_price_found?: number | null;
  vat_included?: boolean | null;
  vat_excluded?: boolean | null;
  vat_rate_found?: number | null;
  total_price?: number | null;
  quantity?: number | null;
  currency?: string | null;
}): {
  unit_price_excluding_vat: number;
  unit_price_including_vat: number;
  vat_rate: number;
  flags: string[];
} {
  const flags: string[] = [];
  const price =
    parseLooseNumber(opts.unit_price_found) ??
    parseLooseNumber(opts.unit_price_text) ??
    0;

  // SAR documents: lock VAT to 15% unless the document says otherwise
  const currency = (opts.currency ?? 'SAR').toUpperCase();
  let rate = parseLooseNumber(opts.vat_rate_found);
  if (rate === null || rate === 0) {
    rate = currency === 'SAR' ? 0.15 : 0;
  }
  // tolerate "15" instead of "0.15"
  if (rate > 1) rate = rate / 100;

  let included = opts.vat_included === true;
  const excluded = opts.vat_excluded === true;
  if (!included && !excluded) {
    flags.push('vat_status_assumed_excluded');
  }
  if (included && excluded) {
    flags.push('vat_status_conflicting');
    included = true; // arbitrary tie-break, will be visible to user
  }

  let excl: number;
  let incl: number;
  if (included) {
    incl = price;
    excl = rate > 0 ? price / (1 + rate) : price;
  } else {
    excl = price;
    incl = rate > 0 ? price * (1 + rate) : price;
  }

  // Cross-check total
  const total = parseLooseNumber(opts.total_price);
  const qty = parseLooseNumber(opts.quantity);
  if (total !== null && qty !== null && qty > 0 && price > 0) {
    const expected = qty * price;
    if (Math.abs(expected - total) / Math.max(total, expected) > 0.01) {
      flags.push('total_price_mismatch');
    }
  }

  return {
    unit_price_excluding_vat: round4(excl),
    unit_price_including_vat: round4(incl),
    vat_rate: rate,
    flags,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Score a single supplier candidate against extracted supplier block. */
export function scoreSupplier(
  extracted: {
    name_ar?: string | null;
    name_en?: string | null;
    supplier_code?: string | null;
    tax_number?: string | null;
  },
  candidate: {
    supplier_code?: string;
    tax_number?: string;
    display_name?: string;
    legal_name?: string;
    normalized_names?: string[];
    search_text?: string;
  },
): number {
  let score = 0;
  if (extracted.supplier_code && candidate.supplier_code &&
      extracted.supplier_code === candidate.supplier_code) {
    score = Math.max(score, 1);
  }
  if (extracted.tax_number && candidate.tax_number &&
      String(candidate.tax_number) === String(extracted.tax_number)) {
    score = Math.max(score, 0.98);
  }
  const nAr = normalizeArabicLatin(extracted.name_ar);
  const nEn = normalizeArabicLatin(extracted.name_en);
  const cands = candidate.normalized_names ?? [];
  if (nAr && cands.includes(nAr)) score = Math.max(score, 0.95);
  if (nEn && cands.includes(nEn)) score = Math.max(score, 0.95);
  const search = (candidate.search_text ?? '').toLowerCase();
  if (extracted.name_ar && search.includes(String(extracted.name_ar).toLowerCase())) {
    score = Math.max(score, 0.85);
  }
  if (extracted.name_en && search.includes(String(extracted.name_en).toLowerCase())) {
    score = Math.max(score, 0.82);
  }
  // partial fuzzy: longest substring overlap on normalized names
  if (score < 0.7 && (nAr || nEn)) {
    for (const cn of cands) {
      const overlap = longestCommonSubstring(nAr || nEn, cn);
      if (overlap >= 4) {
        score = Math.max(score, Math.min(0.7, 0.4 + overlap * 0.05));
      }
    }
  }
  return Number(score.toFixed(2));
}

function longestCommonSubstring(a: string, b: string): number {
  if (!a || !b) return 0;
  let best = 0;
  const dp = Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const cur = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : 0;
      if (dp[j] > best) best = dp[j];
      prev = cur;
    }
  }
  return best;
}

// ────────────────────────────────────────────────────────────────────────────
// Prompts
// ────────────────────────────────────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are an AI quote reader for Saudi supplier quotations and price lists.

You will receive ALL document pages together in one request. Read the full document across all images before answering.

Return ONE valid JSON object only. No markdown. No commentary. No code fences.

Top-level shape:
{
  "document": { "date": "YYYY-MM-DD-or-null", "document_type": "quotation|price_list|invoice|unknown", "reference_number": "string-or-null" },
  "supplier": {
    "name_ar": "string-or-null", "name_en": "string-or-null", "supplier_code": "string-or-null",
    "cr_no": "string-or-null", "tax_number": "string-or-null", "phone": "string-or-null",
    "email": "string-or-null", "website": "string-or-null",
    "city": "string-or-null", "supplier_type": "manufacturer|store|distributor|null"
  },
  "rows": [{
    "index": 0, "description": "EXACT description text from document",
    "uom_text": "string-or-null",
    "unit_price_text": "exact raw price text or null",
    "unit_price_found": null, "total_price": null,
    "vat_included": null, "vat_excluded": null, "vat_rate_found": null,
    "currency": "SAR|AED|USD|or-null", "notes": "string-or-null"
  }],
  "delivery_rates": [{
    "index": 0, "description": "exact delivery text",
    "price_per_trip": null, "price_per_moq": null, "moq_for_delivery": null,
    "zone_hint": "string-or-null", "applies_to": "all", "notes": "string-or-null",
    "metadata": { "raw_text": "exact text", "is_per_unit": false, "free_delivery_threshold": null, "distance_km": null }
  }],
  "validity": { "valid_until": "YYYY-MM-DD-or-null", "payment_terms": "string-or-null", "notes": "string-or-null" },
  "warnings": [], "errors": []
}

Rules:
- Use EXACT line descriptions from the document. Do not rewrite them. Arabic stays Arabic.
- DO NOT extract quantity or MOQ from line items. We only care about the unit price catalog. Skip those columns entirely.
- PRICES: always capture the EXCLUDING-VAT (before tax) price when both are shown side by side. If only one price is shown, capture it as-is and set vat_included / vat_excluded based on what the document actually states (look for "شامل ضريبة", "شامل الضريبة", "VAT inclusive", "incl. VAT" → vat_included=true; "غير شامل الضريبة", "قبل الضريبة", "VAT exclusive", "excl. VAT", "before tax" → vat_excluded=true). If the document is silent, leave both null — downstream code will assume excluded + 15% for SAR.
- VALIDITY / EXPIRY: look for "صالح حتى", "ساري حتى", "تاريخ الانتهاء", "valid until", "valid till", "expiry", "expires on", "validity", quotation expiry dates anywhere on the document (header, footer, terms). Put the resolved date in validity.valid_until as YYYY-MM-DD. If only a duration is given (e.g. "valid for 30 days"), compute it from the document date.
- ARABIC MATERIAL TERMS — translate these consistently when reading descriptions, but keep the original Arabic in the description field:
  • "متعدد الفتحات" / "متعددة الفتحات" / "مفرغ" / "مفرغة" → multi-hole / hollow blocks
  • "مصمت" / "مصمتة" / "صلب" → solid (no holes)
  • "معزول" / "معزولة" → insulated (sandwich panel)
  • "غير معزول" → uninsulated
  • "بخاري" / "مبخر" → steamed
  • "بركاني" → volcanic
  • Numbers like "8 فتحات" or "12 فتحه" → that many holes; "بدون فتحات" → solid.
  These cues directly drive material matching downstream — capture them faithfully in the description and notes.
- Saudi documents often use SAR / ريال / ر.س. Parse Arabic numerals correctly.
- Extract supplier email, website, phone, CR, Tax number if anywhere on the page (header/footer/stamp).
- Extract delivery terms if ANY delivery info appears.
- If a section is unreadable, return partial data and add a warning.
- Return null for unknown scalars and [] for unknown arrays.`;

const MATCHER_SYSTEM_PROMPT = `You are a material matcher for Saudi supplier quotations.

You receive (1) authoritative material catalog rows and (2) extracted document rows.

Return valid JSON only with this exact shape:
{ "matches": [{
  "item_index": 0, "material_id": "uuid-or-null",
  "material_code": "string-or-empty", "material_name": "string-or-empty",
  "uom": "string-or-empty", "moq": null, "confidence": 0,
  "metadata": {
    "match": {
      "method": "specs_and_name|code|family_only|no_match",
      "matched_fields": [], "unmatched_fields": [],
      "candidate_alternatives": [], "missing_or_ambiguous_fields": []
    }
  }
}] }

Rules:
- Material catalog is authoritative. Match by code first if present in description, else by family + specs + size.
- Arabic stays Arabic. Do not invent material IDs. Use the material UOM when matched.
- candidate_alternatives: include up to 3 plausible runners-up with material_id, material_code, material_name, reason. Always include at least the runners-up when confidence < 0.85.
- DO NOT compute prices — pricing is handled deterministically downstream.
- confidence: 0..1 reflecting how certain you are of the match.`;

// ────────────────────────────────────────────────────────────────────────────
// Pipeline
// ────────────────────────────────────────────────────────────────────────────

interface ImageInput { name: string; type: string; content: string }

async function callOpenAI(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<any> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${txt.slice(0, 500)}`);
  }
  return await res.json();
}

async function extractFromImages(
  apiKey: string,
  images: ImageInput[],
): Promise<any> {
  const userContent: any[] = [{
    type: 'text',
    text: `Read all ${images.length} page image(s) together as one supplier document and return one JSON object only.`,
  }];
  for (const img of images) {
    const b64 = String(img.content || '').trim();
    if (!b64) continue;
    const mime = (img.type || 'image/jpeg').trim() || 'image/jpeg';
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:${mime};base64,${b64}`, detail: 'high' },
    });
  }
  const json = await callOpenAI(apiKey, {
    model: 'gpt-4o',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  });
  const raw = json.choices?.[0]?.message?.content ?? '{}';
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { rows: [], delivery_rates: [], warnings: [], errors: [{ type: 'invalid_json', description: 'Model did not return JSON.' }] };
  }
  return { extraction: parsed, usage: json.usage };
}

/**
 * Phase 2.5 — deterministic material matcher.
 * Replaces the prior LLM-based matcher. Uses the `material_search_index`
 * built by Phase 0 (subcat + spec labels + aliases + display name + code).
 *
 * For each extracted row:
 *   1. Tokenize the description (EN + Arabic-normalized digits/diacritics).
 *   2. ILIKE-OR fetch candidate rows from material_search_index (cap 200).
 *   3. Score: matched_tokens / total + code-exact (+0.5) + contiguous (+0.2).
 *   4. Top-1 with score ≥ MATCH_THRESHOLD wins, else leave unmatched with
 *      up to 3 alternatives (top runners-up).
 *
 * Mirrors `src/lib/searchMaterials.ts` so client + server behave identically.
 */
const MATCH_THRESHOLD = 0.7;
const MATCH_LEAD_MARGIN = 0.15;

const ARABIC_INDIC: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};
export function normSearch(input: string): string {
  if (!input) return '';
  let out = input.toLowerCase();
  out = out.replace(/[٠-٩]/g, (d) => ARABIC_INDIC[d] ?? d);
  out = out.replace(/[\u064B-\u0652\u0670]/g, '');
  out = out.replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
  return out;
}
export function tokenizeQ(q: string): string[] {
  const n = normSearch(q);
  const raw = n.split(/[\s,.\-_/\\()[\]{}]+/).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    const tok = t.length === 1 && /\d/.test(t) ? t : t.length >= 2 ? t : '';
    if (!tok || seen.has(tok)) continue;
    seen.add(tok);
    out.push(tok);
  }
  return out;
}

export async function matchMaterialsDeterministic(
  supa: any,
  rows: any[],
): Promise<any> {
  if (rows.length === 0) return { matches: [], usage: null };
  const matches: any[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const queryText = [row.description, row.notes].filter(Boolean).join(' ');
    const tokens = tokenizeQ(queryText);
    if (tokens.length === 0) {
      matches.push({ item_index: i, material_id: null, material_code: '', material_name: '', confidence: 0,
        metadata: { match: { method: 'no_match', candidate_alternatives: [] } } });
      continue;
    }
    const normQuery = normSearch(queryText);
    const orClause = tokens.map((t) => `bag.ilike.%${t}%`).join(',');
    const { data, error } = await supa
      .from('material_search_index')
      .select('material_id,code,display_en,display_ar,bag')
      .or(orClause)
      .limit(200);
    if (error || !data) {
      matches.push({ item_index: i, material_id: null, material_code: '', material_name: '', confidence: 0,
        metadata: { match: { method: 'no_match', candidate_alternatives: [] } } });
      continue;
    }
    const scored: any[] = [];
    for (const r of data) {
      const normBag = normSearch(r.bag ?? '');
      const normCode = normSearch(r.code ?? '');
      let matched = 0;
      for (const t of tokens) if (normBag.includes(t) || normCode.includes(t)) matched++;
      if (matched === 0) continue;
      let s = matched / tokens.length;
      if (normCode && normCode === normQuery) s += 0.5;
      if (normQuery.length >= 4 && normBag.includes(normQuery)) s += 0.2;
      scored.push({ ...r, score: Math.min(s, 1.5) });
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored[0];
    const second = scored[1];
    const passes = top && top.score >= MATCH_THRESHOLD && (!second || top.score - second.score >= MATCH_LEAD_MARGIN);
    const alternatives = scored.slice(passes ? 1 : 0, passes ? 4 : 3).map((c) => ({
      material_id: c.material_id,
      material_code: c.code ?? '',
      material_name: c.display_en ?? '',
      reason: `score ${c.score.toFixed(2)}`,
    }));
    if (passes) {
      matches.push({
        item_index: i,
        material_id: top.material_id,
        material_code: top.code ?? '',
        material_name: top.display_en ?? '',
        confidence: Math.min(top.score, 1),
        metadata: {
          match: {
            method: 'specs_and_name',
            matched_fields: tokens,
            candidate_alternatives: alternatives,
          },
        },
      });
    } else {
      matches.push({
        item_index: i,
        material_id: null,
        material_code: '',
        material_name: '',
        confidence: top ? Math.min(top.score, 1) : 0,
        metadata: {
          match: {
            method: 'no_match',
            matched_fields: tokens,
            candidate_alternatives: alternatives,
          },
        },
      });
    }
  }
  return { matches, usage: null };
}

function buildMaterialsIndex(rows: any[]): any[] {
  const clean = (v: unknown) => v === null || v === undefined ? '' : String(v).trim();
  return rows.map((m) => {
    const specs = (m.specs && typeof m.specs === 'object') ? m.specs : {};
    const searchable = [
      m.code, m.name, m.name_en, m.name_ar, m.uom,
      specs.product_family, specs.block_type, specs.holes_spec,
      specs.insulation_spec, specs.size_cm, specs.grade,
      specs.sand_type, specs.cement_type,
    ].flat().map(clean).filter(Boolean).join(' | ');
    return {
      id: clean(m.id),
      code: clean(m.code),
      name: clean(m.name),
      name_en: clean(m.name_en),
      name_ar: clean(m.name_ar),
      uom: clean(m.uom),
      is_core: !!m.is_core,
      subcategory_id: clean(m.subcategory_id),
      specs,
      searchable,
    };
  });
}

function buildSuppliersIndex(suppliers: any[], accounts: any[]): any[] {
  const accountById = Object.fromEntries(accounts.map((a) => [a.id, a]));
  return suppliers.map((s) => {
    const a = accountById[s.account_id] || {};
    const display_name = a.display_name || a.legal_name || '';
    const legal_name = a.legal_name || '';
    const tax_number = a.tax_number || '';
    const names = [display_name, legal_name].filter(Boolean);
    const normalized_names = [...new Set(names.map(normalizeArabicLatin).filter(Boolean))];
    return {
      account_id: s.account_id || a.id || '',
      supplier_code: s.supplier_code || '',
      supplier_type: s.supplier_type || '',
      display_name,
      legal_name,
      tax_number,
      normalized_names,
      search_text: [s.supplier_code, display_name, legal_name, tax_number]
        .filter(Boolean).join(' | '),
    };
  });
}

function ref(path: string) { return { ref: path }; }

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Main handler
// ────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();
  let actorUserId: string | null = null;

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supa = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    actorUserId = body?.actor_user_id ?? body?.input?.actor_user_id ?? null;
    const images: ImageInput[] = body?.input?.images ?? body?.images ?? [];
    /** Supplier the user opened the AddQuoteSheet from — used to detect mismatches. */
    const expectedSupplierId: string | null =
      body?.expected_supplier_account_id ?? body?.input?.expected_supplier_account_id ?? null;
    if (!Array.isArray(images) || images.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, message: 'No images supplied' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 1) Extract from images
    const { extraction, usage: extractUsage } = await extractFromImages(apiKey, images);

    // 2) Load supplier index (materials are matched server-side against the
    //    pre-built material_search_index — no full materials table fetch.)
    const [supsRes, accsRes] = await Promise.all([
      supa.from('suppliers').select('account_id,supplier_code,supplier_type').limit(2000),
      supa.from('accounts').select('id,display_name,legal_name,tax_number').is('deleted_at', null).limit(2000),
    ]);
    if (supsRes.error) throw supsRes.error;
    if (accsRes.error) throw accsRes.error;
    const suppliersIndex = buildSuppliersIndex(supsRes.data ?? [], accsRes.data ?? []);

    // 3) Match materials — deterministic, alias-aware, no LLM round-trip
    const extractedRows = Array.isArray(extraction.rows) ? extraction.rows : [];
    const { matches, usage: matchUsage } = await matchMaterialsDeterministic(supa, extractedRows);
    const matchByIndex: Record<number, any> = {};
    for (const m of matches) matchByIndex[Number(m.item_index)] = m;

    // 4) Score supplier candidates (top 3)
    const supplier = extraction.supplier ?? {};
    const scored = suppliersIndex
      .map((c) => ({
        account_id: c.account_id,
        display_name: c.display_name,
        supplier_code: c.supplier_code,
        confidence: scoreSupplier(supplier, c),
      }))
      .filter((s) => s.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence);
    const supplier_candidates = scored.slice(0, 3);
    let matched_supplier =
      supplier_candidates[0] && supplier_candidates[0].confidence >= 0.9
        ? supplier_candidates[0]
        : null;

    // ── Supplier mismatch guard ──
    // If the caller told us which supplier they expect (because they opened
    // AddQuoteSheet from a specific supplier), check that the extracted
    // supplier matches. If not, suppress auto-selection and emit a warning.
    let supplier_mismatch_warning: any = null;
    if (expectedSupplierId) {
      const expectedHit = supplier_candidates.find((c) => c.account_id === expectedSupplierId);
      if (expectedHit && expectedHit.confidence >= 0.7) {
        // Strong-enough match for the expected supplier → lock it in.
        matched_supplier = expectedHit;
      } else {
        // Either no match or matched a different supplier — never auto-select.
        const otherMatch = matched_supplier;
        matched_supplier = null;
        supplier_mismatch_warning = {
          type: 'supplier_mismatch',
          expected_account_id: expectedSupplierId,
          extracted_account_id: otherMatch?.account_id ?? null,
          extracted_name: otherMatch?.display_name ?? supplier.name_en ?? supplier.name_ar ?? null,
          description:
            'The extracted supplier does not strongly match the supplier you opened this quote from.',
        };
      }
    }

    // 5) Reconcile rows with deterministic VAT math
    const rows = extractedRows.map((row: any, idx: number) => {
      const m = matchByIndex[idx] ?? {};
      const matchMeta = m?.metadata?.match ?? {};
      const reconciled = reconcileVat({
        unit_price_text: row.unit_price_text,
        unit_price_found: row.unit_price_found,
        vat_included: row.vat_included,
        vat_excluded: row.vat_excluded,
        vat_rate_found: row.vat_rate_found,
        total_price: row.total_price,
        quantity: row.quantity,
        currency: row.currency,
      });
      return {
        index: idx,
        description: row.description ?? null,
        material_id: m.material_id ?? null,
        material_code: m.material_code ?? '',
        material_name: m.material_name ?? '',
        unit_price_excluding_vat: reconciled.unit_price_excluding_vat,
        unit_price_including_vat: reconciled.unit_price_including_vat,
        vat_rate: reconciled.vat_rate,
        moq: parseLooseNumber(m.moq),
        uom: m.uom ?? '',
        confidence: typeof m.confidence === 'number' ? m.confidence : 0,
        notes: row.notes ?? null,
        metadata: {
          match: {
            method: matchMeta.method ?? 'no_match',
            matched_fields: matchMeta.matched_fields ?? [],
            unmatched_fields: matchMeta.unmatched_fields ?? [],
            candidate_alternatives: matchMeta.candidate_alternatives ?? [],
            missing_or_ambiguous_fields: matchMeta.missing_or_ambiguous_fields ?? [],
          },
          price: {
            raw_price_text: row.unit_price_text ?? '',
            unit_price_found: parseLooseNumber(row.unit_price_found),
            vat_rate_found: parseLooseNumber(row.vat_rate_found),
            currency: row.currency ?? 'SAR',
            flags: reconciled.flags,
          },
          source_item: {
            description: row.description ?? null,
            quantity: parseLooseNumber(row.quantity),
            unit_price: parseLooseNumber(row.unit_price_found),
            total_price: parseLooseNumber(row.total_price),
          },
        },
      };
    });

    const delivery_rates = (extraction.delivery_rates ?? []).map((d: any, idx: number) => ({
      index: Number.isFinite(Number(d.index)) ? Number(d.index) : idx,
      description: d.description ?? null,
      price_per_trip: parseLooseNumber(d.price_per_trip),
      price_per_moq: parseLooseNumber(d.price_per_moq),
      moq_for_delivery: parseLooseNumber(d.moq_for_delivery),
      zone_hint: d.zone_hint ?? null,
      applies_to: d.applies_to ?? 'all',
      notes: d.notes ?? null,
      metadata: d.metadata ?? {},
    }));

    const validity = extraction.validity ?? { valid_until: null, payment_terms: null, notes: null };
    const document = extraction.document ?? { date: null, document_type: 'unknown', reference_number: null };
    const supplierPreview = matched_supplier ? null : {
      name_ar: supplier.name_ar ?? null,
      name_en: supplier.name_en ?? null,
      cr_no: supplier.cr_no ?? null,
      tax_number: supplier.tax_number ?? null,
      phone: supplier.phone ?? null,
      email: supplier.email ?? null,
      website: supplier.website ?? null,
      city: supplier.city ?? null,
      supplier_type: supplier.supplier_type ?? null,
    };

    const displayName = matched_supplier?.display_name
      || supplier.name_ar || supplier.name_en || 'Supplier';
    const dateFragment = document.date ? ` ${String(document.date).slice(0, 7)}` : '';
    const firstMaterialName = rows.find((r: any) => r.material_name)?.material_name || 'Quote';
    const title = `${displayName} — ${firstMaterialName}${dateFragment}`;

    const warnings: any[] = [
      ...(Array.isArray(extraction.warnings) ? extraction.warnings : []),
      ...(supplier_mismatch_warning ? [supplier_mismatch_warning] : []),
      ...rows.filter((r: any) => !r.material_id).map((r: any) => ({
        type: 'unmatched_material', row_index: r.index,
        description: `No confident material match for row ${r.index}.`,
      })),
      ...rows.filter((r: any) => r.confidence > 0 && r.confidence < 0.75).map((r: any) => ({
        type: 'ambiguous_match', row_index: r.index,
        description: `Low confidence material match for row ${r.index}.`,
      })),
      ...rows.filter((r: any) => r.metadata.price.flags?.includes('total_price_mismatch')).map((r: any) => ({
        type: 'total_price_mismatch', row_index: r.index,
        description: `Total price does not match quantity × unit price for row ${r.index}.`,
      })),
    ];
    const errors = Array.isArray(extraction.errors) ? extraction.errors : [];

    const confirm_preview: any = {
      document,
      supplier: supplierPreview ?? supplier,   // always include extracted supplier block
      supplier_candidates,                      // top 3 scored
      ...(matched_supplier ? { matched_supplier } : {}),
      title,
      rows,
      delivery_rates,
      validity,
      warnings,
      errors,
    };

    // 6) Build commit_payload (ops mirror n8n worker)
    const ops: any[] = [];
    let supplierAccountId = matched_supplier?.account_id ?? null;
    let createdSupplierPreview: any = null;

    if (!supplierAccountId) {
      const displayNameToCreate = supplierPreview?.name_ar || supplierPreview?.name_en;
      if (displayNameToCreate) {
        const newAccountId = uuidv4();
        supplierAccountId = newAccountId;
        const supplierType = supplierPreview?.supplier_type || 'store';
        ops.push({
          op_id: 'acc_insert', type: 'insert', table: 'accounts',
          values: {
            id: newAccountId,
            account_kind: 'company', status: 'active',
            display_name: displayNameToCreate,
            legal_name: supplierPreview?.name_en || supplierPreview?.name_ar || null,
            tax_number: supplierPreview?.tax_number ?? null,
            website: supplierPreview?.website ?? null,
            created_by: ref('actor.user_id'), updated_by: ref('actor.user_id'),
          },
          returning: ['id'], assign: {},
        });
        if (supplierPreview?.phone) {
          ops.push({
            op_id: 'contact_primary_insert', type: 'insert', table: 'contacts',
            values: {
              account_id: newAccountId, full_name: displayNameToCreate,
              phone: supplierPreview.phone, email: supplierPreview.email ?? null,
              is_primary: true, prefers_whatsapp: true,
              created_by: ref('actor.user_id'), updated_by: ref('actor.user_id'),
            },
            returning: ['id'], assign: { poc_contact_id: 'id' },
          });
        }
        ops.push({
          op_id: 'supplier_insert', type: 'insert', table: 'suppliers',
          values: {
            account_id: newAccountId, supplier_type: supplierType,
            supplier_code: supplier.supplier_code ?? null,
            notes: JSON.stringify({ extracted_supplier: supplierPreview, document, validity }),
            created_by: ref('actor.user_id'), updated_by: ref('actor.user_id'),
          },
          returning: [], assign: {},
        });
        createdSupplierPreview = {
          account_id: newAccountId, display_name: displayNameToCreate, supplier_type: supplierType,
        };
      }
    }

    rows.forEach((row: any, idx: number) => {
      if (!supplierAccountId || !row.material_id || !row.unit_price_excluding_vat || row.unit_price_excluding_vat <= 0) return;
      const opNum = String(idx + 1).padStart(3, '0');
      ops.push({
        op_id: `sm_${opNum}_insert`, type: 'insert', table: 'supplier_materials',
        values: {
          supplier_account_id: supplierAccountId,
          material_id: row.material_id,
          // Persist the BEFORE-TAX price. Including-VAT is kept in metadata for reference.
          unit_price: row.unit_price_excluding_vat,
          moq: row.moq, status: 'quoted',
          metadata: { row, document, validity, delivery_rates },
          created_by: ref('actor.user_id'), updated_by: ref('actor.user_id'),
        },
        returning: ['id'], assign: {},
      });
    });

    const commit_payload = {
      commit_v: 1, tool: 'bulk_supplier_materials.v1',
      vars: {}, ops, preview: confirm_preview,
      meta: { actor_user_id: actorUserId, created_supplier: createdSupplierPreview },
    };

    // 7) Insert agent_confirmations row
    const { data: conf, error: confErr } = await supa
      .from('agent_confirmations')
      .insert({
        actor_user_id: actorUserId,
        tool: 'bulk_supplier_materials.v1',
        payload: commit_payload as any,
      })
      .select('token')
      .single();
    if (confErr) throw confErr;

    const elapsed = Date.now() - startedAt;
    // Best-effort log
    try {
      await supa.from('agent_logs').insert({
        actor_phone: '',
        actor_user_id: actorUserId,
        channel: 'lovable',
        event_type: 'action',
        payload: {
          tool: 'quote-extract',
          image_count: images.length,
          row_count: rows.length,
          matched_supplier: matched_supplier?.account_id ?? null,
          supplier_candidate_count: supplier_candidates.length,
          elapsed_ms: elapsed,
          extract_tokens: extractUsage,
          match_tokens: matchUsage,
        },
      });
    } catch (_) { /* ignore logging errors */ }

    return new Response(
      JSON.stringify({
        status: 'needs_confirmation',
        confirm_token: conf.token,
        confirm_preview,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const elapsed = Date.now() - startedAt;
    const message = e instanceof Error ? e.message : String(e);
    console.error('quote-extract error', message);
    return new Response(
      JSON.stringify({ ok: false, message, elapsed_ms: elapsed }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
