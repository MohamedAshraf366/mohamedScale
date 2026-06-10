// Deno tests for the deterministic helpers in quote-extract/index.ts.
// Run with the Lovable test_edge_functions tool.

import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  parseLooseNumber,
  toAsciiDigits,
  normalizeArabicLatin,
  reconcileVat,
  scoreSupplier,
} from './index.ts';

Deno.test('toAsciiDigits converts Arabic-Indic digits', () => {
  assertEquals(toAsciiDigits('٢.٧٣٧'), '2.737');
  assertEquals(toAsciiDigits('١٢٣٤٥'), '12345');
});

Deno.test('parseLooseNumber handles Arabic + thousand separators', () => {
  assertEquals(parseLooseNumber('٢.٧٣٧'), 2.737);
  assertEquals(parseLooseNumber('1,234.56'), 1234.56);
  assertEquals(parseLooseNumber('1.234,56'), 1234.56); // EU style
  assertEquals(parseLooseNumber('SAR 250.00'), 250);
  assertEquals(parseLooseNumber(null), null);
  assertEquals(parseLooseNumber(''), null);
});

Deno.test('normalizeArabicLatin folds variants', () => {
  assertEquals(normalizeArabicLatin('شَركة الدمداد'), normalizeArabicLatin('شركة الدمداد'));
  assert(normalizeArabicLatin('Acme Co.').length > 0);
});

Deno.test('reconcileVat: VAT included keeps incl, derives excl', () => {
  const r = reconcileVat({
    unit_price_found: 2.7370,
    vat_included: true,
    vat_rate_found: 0.15,
    currency: 'SAR',
  });
  assertEquals(r.unit_price_including_vat, 2.737);
  // 2.737 / 1.15 = 2.3800
  assertEquals(r.unit_price_excluding_vat, 2.38);
  assertEquals(r.vat_rate, 0.15);
});

Deno.test('reconcileVat: VAT excluded computes incl correctly', () => {
  const r = reconcileVat({
    unit_price_found: 2.38,
    vat_excluded: true,
    vat_rate_found: 0.15,
    currency: 'SAR',
  });
  assertEquals(r.unit_price_excluding_vat, 2.38);
  assertEquals(r.unit_price_including_vat, 2.737);
});

Deno.test('reconcileVat: ambiguous SAR defaults to excl + 15%', () => {
  const r = reconcileVat({
    unit_price_found: 100,
    currency: 'SAR',
  });
  assertEquals(r.unit_price_excluding_vat, 100);
  assertEquals(r.unit_price_including_vat, 115);
  assert(r.flags.includes('vat_status_assumed_excluded'));
});

Deno.test('reconcileVat: rate given as 15 (percent) is normalized', () => {
  const r = reconcileVat({
    unit_price_found: 100,
    vat_excluded: true,
    vat_rate_found: 15,
    currency: 'SAR',
  });
  assertEquals(r.vat_rate, 0.15);
  assertEquals(r.unit_price_including_vat, 115);
});

Deno.test('reconcileVat: total mismatch flagged', () => {
  const r = reconcileVat({
    unit_price_found: 10,
    quantity: 5,
    total_price: 80, // expected 50
    currency: 'SAR',
  });
  assert(r.flags.includes('total_price_mismatch'));
});

Deno.test('scoreSupplier: tax number match → 0.98', () => {
  const score = scoreSupplier(
    { tax_number: '300123456700003' },
    { tax_number: '300123456700003', display_name: 'Acme', normalized_names: ['acme'] },
  );
  assertEquals(score, 0.98);
});

Deno.test('scoreSupplier: exact normalized name match → 0.95', () => {
  const score = scoreSupplier(
    { name_ar: 'شركة الدمداد' },
    {
      display_name: 'شركة الدمداد',
      normalized_names: [normalizeArabicLatin('شركة الدمداد')],
    },
  );
  assertEquals(score, 0.95);
});

Deno.test('scoreSupplier: unrelated suppliers score 0', () => {
  const score = scoreSupplier(
    { name_ar: 'شركة الدمداد' },
    { display_name: 'Saudi Block Co', normalized_names: ['saudiblockco'] },
  );
  assertEquals(score, 0);
});

// ─── Phase 2.5 — deterministic material matcher ──────────────────────

import { tokenizeQ, normSearch, matchMaterialsDeterministic } from './index.ts';

Deno.test('tokenizeQ: drops short tokens, normalizes Arabic digits', () => {
  const toks = tokenizeQ('isolated 20cm ٤-hole');
  assert(toks.includes('isolated'));
  assert(toks.includes('20cm'));
  assert(toks.includes('4-hole') || toks.includes('hole'));
});

Deno.test('normSearch: folds alif + ta-marbuta', () => {
  assertEquals(normSearch('إسمنت'), normSearch('اسمنت'));
  assertEquals(normSearch('شركه'), normSearch('شركة'));
});

// Build a mock supabase client that returns a fixed candidate set
// from material_search_index for any .or() query.
function mockSupa(rows: any[]) {
  return {
    from(_t: string) {
      return {
        select(_s: string) {
          return {
            or(_clause: string) {
              return {
                limit(_n: number) {
                  return Promise.resolve({ data: rows, error: null });
                },
              };
            },
          };
        },
      };
    },
  };
}

const INDEX_ROWS = [
  { material_id: 'm-iso-20-4', code: 'MAT.BB.01.231.20', display_en: 'Isolated block 20cm 4-hole', display_ar: 'بلوك معزول 20 سم 4 ثقوب', bag: 'isolated block 20cm 4-hole بلوك معزول' },
  { material_id: 'm-iso-20-3', code: 'MAT.BB.01.221.20', display_en: 'Isolated block 20cm 3-hole', display_ar: '', bag: 'isolated block 20cm 3-hole' },
  { material_id: 'm-solid-15', code: 'MAT.BB.01.111.15', display_en: 'Solid block 15cm', display_ar: '', bag: 'solid block 15cm' },
];

Deno.test('matcher: spec-combo wins top-1 with confidence ≥ threshold', async () => {
  const supa = mockSupa(INDEX_ROWS);
  const { matches } = await matchMaterialsDeterministic(supa, [
    { description: 'isolated 20cm 4-hole', notes: '' },
  ]);
  assertEquals(matches.length, 1);
  assertEquals(matches[0].material_id, 'm-iso-20-4');
  assert(matches[0].confidence >= 0.7);
});

Deno.test('matcher: exact code match boosts score', async () => {
  const supa = mockSupa(INDEX_ROWS);
  const { matches } = await matchMaterialsDeterministic(supa, [
    { description: 'MAT.BB.01.111.15', notes: '' },
  ]);
  assertEquals(matches[0].material_id, 'm-solid-15');
  assert(matches[0].confidence >= 0.95);
});

Deno.test('matcher: ambiguous → no_match with alternatives', async () => {
  const supa = mockSupa(INDEX_ROWS);
  const { matches } = await matchMaterialsDeterministic(supa, [
    { description: 'block', notes: '' },
  ]);
  // single common token across multiple rows; no clear winner
  assertEquals(matches[0].material_id, null);
  assertEquals(matches[0].metadata.match.method, 'no_match');
  assert(matches[0].metadata.match.candidate_alternatives.length >= 2);
});

Deno.test('matcher: Arabic query matches Arabic bag', async () => {
  const supa = mockSupa(INDEX_ROWS);
  const { matches } = await matchMaterialsDeterministic(supa, [
    { description: 'بلوك معزول 20 سم', notes: '' },
  ]);
  assertEquals(matches[0].material_id, 'm-iso-20-4');
});

Deno.test('matcher: empty/whitespace query → no_match, no DB call needed', async () => {
  const supa = mockSupa(INDEX_ROWS);
  const { matches } = await matchMaterialsDeterministic(supa, [
    { description: '   ', notes: '' },
  ]);
  assertEquals(matches[0].material_id, null);
  assertEquals(matches[0].metadata.match.method, 'no_match');
});
