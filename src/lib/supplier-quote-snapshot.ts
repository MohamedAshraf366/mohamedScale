import { supabase } from '@/integrations/supabase/client';

/**
 * Snapshot of a supplier's most recent quote — used to pre-populate the
 * AddQuoteSheet so the user only has to update prices on existing rows.
 */
export interface SupplierQuoteSnapshot {
  quoteId: string;
  /** Date the previous quote was submitted (ISO). */
  submittedAt: string | null;
  rows: Array<{
    material_id: string;
    material_name: string | null;
    material_name_ar: string | null;
    material_code: string | null;
    uom: string | null;
    moq: number | null;
    lead_time_days: number | null;
    notes: string | null;
    /** Previous price (informational, never auto-applied). */
    previous_price: number | null;
  }>;
  deliveryLines: Array<{
    zone_codes: string[];
    material_ids: string[];
    price_per_moq: number | null;
    notes: string | null;
  }>;
}

/**
 * Loads the supplier's most recent supplier_quote (any status) plus all of its
 * items and delivery lines. Returns null if the supplier has never been quoted.
 */
export async function loadLatestSupplierQuoteSnapshot(
  supplierAccountId: string,
): Promise<SupplierQuoteSnapshot | null> {
  if (!supplierAccountId) return null;

  // 1. Most recent quote
  const { data: quotes } = await supabase
    .from('supplier_quotes' as any)
    .select('id, submitted_at')
    .eq('supplier_account_id', supplierAccountId)
    .order('submitted_at', { ascending: false })
    .limit(1);

  const quote = (quotes ?? [])[0] as any;
  if (!quote) return null;

  // 2. All items on that quote (via supplier_materials.supplier_quote_id)
  const { data: items } = await supabase
    .from('supplier_materials' as any)
    .select(`
      material_id,
      unit_price,
      moq,
      lead_time_days,
      notes,
      materials:material_id (
        id,
        name,
        name_ar,
        code,
        uom
      )
    `)
    .eq('supplier_quote_id', quote.id);

  const rows = (items ?? []).map((it: any) => ({
    material_id: it.material_id,
    material_name: it.materials?.name ?? null,
    material_name_ar: it.materials?.name_ar ?? null,
    material_code: it.materials?.code ?? null,
    uom: it.materials?.uom ?? null,
    moq: it.moq,
    lead_time_days: it.lead_time_days,
    notes: it.notes,
    previous_price: it.unit_price,
  }));

  // 3. Delivery lines for that quote
  const { data: deliveryLinesData } = await supabase
    .from('supplier_quote_delivery_lines' as any)
    .select('zone_codes, material_ids, price_per_moq, notes')
    .eq('supplier_quote_id', quote.id);

  const deliveryLines = (deliveryLinesData ?? []).map((d: any) => ({
    zone_codes: d.zone_codes ?? [],
    material_ids: d.material_ids ?? [],
    price_per_moq: d.price_per_moq,
    notes: d.notes,
  }));

  return {
    quoteId: quote.id,
    submittedAt: quote.submitted_at,
    rows,
    deliveryLines,
  };
}

/**
 * Generic AI row shape used by the merge helper — kept loose to avoid
 * coupling with the AiUploadStep types.
 */
export interface AiRowLike {
  material_id?: string | null;
  unit_price?: number | null;
  moq?: number | null;
  notes?: string | null;
  [k: string]: any;
}

export interface MergedRow {
  material_id: string;
  material_name: string | null;
  material_name_ar: string | null;
  material_code: string | null;
  uom: string | null;
  moq: number | null;
  notes: string | null;
  unit_price: number | null;
  /**
   * Origin of this row:
   * - 'updated': existed before AND on the new quote (price refreshed)
   * - 'carried': existed before but NOT on the new quote (kept for review)
   * - 'new': only on the new quote (new material for this supplier)
   * - 'snapshot': came from the snapshot only (manual flow without AI)
   */
  origin: 'updated' | 'carried' | 'new' | 'snapshot';
  aiSource?: AiRowLike;
}

/**
 * Merges the supplier's previous-quote snapshot with the AI-extracted rows.
 * - matched rows → 'updated' (AI price wins, snapshot uom/moq fills gaps)
 * - snapshot-only rows → 'carried' (price cleared, user can keep or remove)
 * - AI-only rows → 'new'
 *
 * If no AI rows are provided, returns the snapshot rows tagged as 'snapshot'.
 */
export function mergeAiWithSnapshot(
  snapshot: SupplierQuoteSnapshot | null,
  aiRows: AiRowLike[] | null,
): MergedRow[] {
  const snapshotRows = snapshot?.rows ?? [];
  const ai = aiRows ?? [];

  // Pure snapshot mode (no AI run)
  if (ai.length === 0) {
    return snapshotRows.map((r) => ({
      material_id: r.material_id,
      material_name: r.material_name,
      material_name_ar: r.material_name_ar,
      material_code: r.material_code,
      uom: r.uom,
      moq: r.moq,
      notes: r.notes,
      unit_price: null, // never carry old price forward
      origin: 'snapshot' as const,
    }));
  }

  const snapshotByMaterial = new Map(snapshotRows.map((r) => [r.material_id, r]));
  const aiMatched = new Set<string>();
  const merged: MergedRow[] = [];

  // 1. Snapshot rows first (preserves their order)
  for (const s of snapshotRows) {
    const aiHit = ai.find((a) => a.material_id && a.material_id === s.material_id);
    if (aiHit) {
      aiMatched.add(s.material_id);
      merged.push({
        material_id: s.material_id,
        material_name: s.material_name,
        material_name_ar: s.material_name_ar,
        material_code: s.material_code,
        uom: s.uom,
        moq: aiHit.moq ?? s.moq,
        notes: aiHit.notes ?? s.notes,
        unit_price: aiHit.unit_price ?? null,
        origin: 'updated',
        aiSource: aiHit,
      });
    } else {
      merged.push({
        material_id: s.material_id,
        material_name: s.material_name,
        material_name_ar: s.material_name_ar,
        material_code: s.material_code,
        uom: s.uom,
        moq: s.moq,
        notes: s.notes,
        unit_price: null,
        origin: 'carried',
      });
    }
  }

  // 2. AI rows that didn't match anything from the snapshot
  for (const a of ai) {
    if (!a.material_id) continue;
    if (aiMatched.has(a.material_id)) continue;
    if (snapshotByMaterial.has(a.material_id)) continue;
    merged.push({
      material_id: a.material_id,
      material_name: null,
      material_name_ar: null,
      material_code: null,
      uom: null,
      moq: a.moq ?? null,
      notes: a.notes ?? null,
      unit_price: a.unit_price ?? null,
      origin: 'new',
      aiSource: a,
    });
  }

  return merged;
}
