// ============================================================
// Coding System — shared parsing, decoding, and lookup tables
// ============================================================

// ── Lookup Tables ────────────────────────────────────────────

export const BLOCK_TYPE_MAP: Record<string, string> = {
  '1': 'Regular',
  '2': 'Steamed',
  '3': 'Volcanic',
};

export const INSULATION_MAP: Record<string, string> = {
  '1': 'Uninsulated',
  '2': 'Sandwich Blue',
  '3': 'Sandwich White',
  '4': 'Inserted Blue',
  '5': 'Inserted White',
};

export const HOLES_MAP: Record<string, string> = {
  '0': 'Solid (0)',
  '1': '2 Holes',
  '2': '3 Holes',
  '3': '4 Holes',
  '4': '6 Holes',
  '5': '8 Holes',
  '6': '10 Holes',
  '7': '12 Holes',
};

export const CATEGORY_MAP: Record<string, string> = {
  'BB': 'Blocks & Bricks',
};

// ── Segment Colors ───────────────────────────────────────────

export const SEGMENT_COLORS = {
  domain: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  category: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  subcategory: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  spec: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  size: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  customer: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  project: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  entity: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  docType: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  docSeq: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  region: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  sequence: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
};

// ── Types ────────────────────────────────────────────────────

export type CodeDomain = 'MAT' | 'SAL' | 'SUP' | 'unknown';

export interface CodeSegment {
  label: string;
  value: string;
  meaning: string;
  color: string;
}

export interface ParsedMaterialCode {
  category: string;
  subcategory: string;
  specs: { type: string; insulation: string; holes: string };
  size: string;
}

export interface ParsedSalesCode {
  customer: string;
  project?: string;
  entity?: string;
  docType?: string;
  docSeq?: string;
}

export interface ParsedSupplierCode {
  region: string;
  sequence: string;
}

// ── Domain Detection ─────────────────────────────────────────

export function detectDomain(code: string): CodeDomain {
  if (code.startsWith('MAT.')) return 'MAT';
  if (code.startsWith('SAL.')) return 'SAL';
  if (code.startsWith('SUP.')) return 'SUP';
  return 'unknown';
}

// ── Material Parsing ─────────────────────────────────────────

export function parseMaterialCode(code: string): ParsedMaterialCode | null {
  const match = code.match(/^MAT\.([A-Z]{2})\.(\d{2})\.(\d)(\d)(\d)\.(\d{2})$/);
  if (!match) return null;
  return {
    category: match[1],
    subcategory: match[2],
    specs: {
      type: match[3],
      insulation: match[4],
      holes: match[5],
    },
    size: match[6],
  };
}

export function getMaterialBaseCode(code: string): string {
  // Strip the last .NN (size variant) to get base identity
  const lastDot = code.lastIndexOf('.');
  return lastDot > 0 ? code.substring(0, lastDot) : code;
}

/**
 * Extract the trailing size segment of a material code.
 * Returns null when the code is spec-level (no size segment) or malformed.
 *   "MAT.BB.01.132.15" -> "15"
 *   "MAT.BB.01.132"    -> null
 */
export function parseSizeFromCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const m = code.match(/^MAT\.[A-Z]{2}\.\d{2}\.\d+\.(\d+)$/);
  return m ? String(parseInt(m[1], 10)) : null;
}

/** True when the code carries a size segment (i.e. is a variant, not a spec group). */
export function isVariantLevelCode(code: string | null | undefined): boolean {
  return parseSizeFromCode(code) !== null;
}

/**
 * Generic spec extractor — derives `{ [specKey]: value }` directly from the
 * material code, using the subcategory's `spec_definitions` (matching by
 * `code_digit`). Also fills the variant axis key with the trailing size
 * segment when present. The code is the single source of truth.
 *
 * Returns `{}` when the code or subcategory is missing/unparsable.
 */
export interface SpecDefinitionForParse {
  key: string;
  default_code_digit?: string | null;
  options: { value: string; code_digit?: string; status?: 'active' | 'archived' }[];
}
export interface SubcategoryForParse {
  spec_definitions?: SpecDefinitionForParse[] | null;
  variant_definitions?: { key?: string } | null;
}
export function parseSpecsFromCode(
  code: string | null | undefined,
  subcategory: SubcategoryForParse | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!code || !subcategory) return out;
  const variantMatch = code.match(/^MAT\.[A-Z]{2}\.\d{2}\.(\d+)\.(\d+)$/);
  const specMatch = variantMatch ? null : code.match(/^MAT\.[A-Z]{2}\.\d{2}\.(\d+)$/);
  if (!variantMatch && !specMatch) return out;
  const digitsStr = (variantMatch ?? specMatch)![1];
  const sizeRaw = variantMatch ? variantMatch[2] : '';

  const variantKey = subcategory.variant_definitions?.key ?? null;
  const specDefs = (subcategory.spec_definitions ?? []).filter(d => d.key !== variantKey);

  const digits = digitsStr.split('');
  for (let i = 0; i < specDefs.length; i++) {
    const def = specDefs[i];
    // Smart decoder: when the code is shorter than current definitions
    // (e.g. an axis was appended after the code was minted), fall back to
    // the axis's `default_code_digit`. All options — active or archived —
    // are searched so historical codes keep resolving.
    const digit = digits[i] ?? (def.default_code_digit ?? null);
    if (digit == null) break;
    const opt = def.options?.find(o => String(o.code_digit ?? '') === digit);
    if (opt) out[def.key] = opt.value;
    else if (digit) out[def.key] = digit;
  }
  if (sizeRaw && variantKey) {
    out[variantKey] = String(parseInt(sizeRaw, 10));
  }
  return out;
}

/**
 * True when any spec value parsed from the code maps to an archived option.
 * Used by the UI to surface a "uses archived spec" badge.
 */
export function codeUsesArchivedSpec(
  code: string | null | undefined,
  subcategory: SubcategoryForParse | null | undefined,
): boolean {
  if (!code || !subcategory) return false;
  const variantMatch = code.match(/^MAT\.[A-Z]{2}\.\d{2}\.(\d+)\.\d+$/);
  const specMatch = variantMatch ? null : code.match(/^MAT\.[A-Z]{2}\.\d{2}\.(\d+)$/);
  if (!variantMatch && !specMatch) return false;
  const digitsStr = (variantMatch ?? specMatch)![1];
  const variantKey = subcategory.variant_definitions?.key ?? null;
  const specDefs = (subcategory.spec_definitions ?? []).filter(d => d.key !== variantKey);
  const digits = digitsStr.split('');
  for (let i = 0; i < specDefs.length; i++) {
    const digit = digits[i];
    if (digit == null) continue;
    const opt = specDefs[i].options?.find(o => String(o.code_digit ?? '') === digit);
    if (opt?.status === 'archived') return true;
  }
  return false;
}

// ── Sales Parsing ────────────────────────────────────────────

export function parseSalesCode(code: string): ParsedSalesCode | null {
  if (!code.startsWith('SAL.')) return null;
  const rest = code.substring(4); // Remove "SAL."
  
  // Check for document type (QOT/PL/INV)
  const docMatch = rest.match(/^(.+)_(QOT|PL|INV)\.(\d{3})$/);
  if (docMatch) {
    const parentParts = docMatch[1].split('_');
    return {
      customer: parentParts[0],
      project: parentParts[1],
      entity: parentParts[2],
      docType: docMatch[2],
      docSeq: docMatch[3],
    };
  }

  const parts = rest.split('_');
  return {
    customer: parts[0],
    project: parts[1],
    entity: parts[2],
  };
}

// ── Supplier Parsing ─────────────────────────────────────────

export function parseSupplierCode(code: string): ParsedSupplierCode | null {
  const match = code.match(/^SUP\.([A-Z]{3})\.(\d{3})$/);
  if (!match) return null;
  return { region: match[1], sequence: match[2] };
}

// ── Decode to Segments ───────────────────────────────────────

export function decodeToSegments(code: string): CodeSegment[] {
  const domain = detectDomain(code);

  if (domain === 'MAT') {
    const parsed = parseMaterialCode(code);
    if (!parsed) return [{ label: 'Code', value: code, meaning: 'Invalid format', color: SEGMENT_COLORS.domain }];
    return [
      { label: 'Domain', value: 'MAT', meaning: 'Materials', color: SEGMENT_COLORS.domain },
      { label: 'Category', value: parsed.category, meaning: CATEGORY_MAP[parsed.category] || parsed.category, color: SEGMENT_COLORS.category },
      { label: 'Subcategory', value: parsed.subcategory, meaning: `Subcategory ${parsed.subcategory}`, color: SEGMENT_COLORS.subcategory },
      { label: 'Type', value: parsed.specs.type, meaning: BLOCK_TYPE_MAP[parsed.specs.type] || 'Unknown', color: SEGMENT_COLORS.spec },
      { label: 'Insulation', value: parsed.specs.insulation, meaning: INSULATION_MAP[parsed.specs.insulation] || 'Unknown', color: SEGMENT_COLORS.spec },
      { label: 'Holes', value: parsed.specs.holes, meaning: HOLES_MAP[parsed.specs.holes] || 'Unknown', color: SEGMENT_COLORS.spec },
      { label: 'Size', value: parsed.size, meaning: `${parseInt(parsed.size)} cm`, color: SEGMENT_COLORS.size },
    ];
  }

  if (domain === 'SAL') {
    const parsed = parseSalesCode(code);
    if (!parsed) return [{ label: 'Code', value: code, meaning: 'Invalid format', color: SEGMENT_COLORS.domain }];
    const segments: CodeSegment[] = [
      { label: 'Domain', value: 'SAL', meaning: 'Sales', color: SEGMENT_COLORS.domain },
      { label: 'Customer', value: parsed.customer, meaning: `Customer #${parseInt(parsed.customer)}`, color: SEGMENT_COLORS.customer },
    ];
    if (parsed.project) {
      segments.push({ label: 'Project', value: parsed.project, meaning: `Project #${parseInt(parsed.project)}`, color: SEGMENT_COLORS.project });
    }
    if (parsed.entity) {
      segments.push({ label: 'Opportunity/Order', value: parsed.entity, meaning: `Entity #${parseInt(parsed.entity)}`, color: SEGMENT_COLORS.entity });
    }
    if (parsed.docType) {
      const docLabel = parsed.docType === 'QOT' ? 'Quotation' : parsed.docType === 'PL' ? 'Price List' : 'Invoice';
      segments.push({ label: 'Doc Type', value: parsed.docType, meaning: docLabel, color: SEGMENT_COLORS.docType });
      segments.push({ label: 'Doc #', value: parsed.docSeq!, meaning: `${docLabel} #${parseInt(parsed.docSeq!)}`, color: SEGMENT_COLORS.docSeq });
    }
    return segments;
  }

  if (domain === 'SUP') {
    const parsed = parseSupplierCode(code);
    if (!parsed) return [{ label: 'Code', value: code, meaning: 'Invalid format', color: SEGMENT_COLORS.domain }];
    return [
      { label: 'Domain', value: 'SUP', meaning: 'Supplier', color: SEGMENT_COLORS.domain },
      { label: 'Region', value: parsed.region, meaning: `Region: ${parsed.region}`, color: SEGMENT_COLORS.region },
      { label: 'Sequence', value: parsed.sequence, meaning: `Supplier #${parseInt(parsed.sequence)}`, color: SEGMENT_COLORS.sequence },
    ];
  }

  return [{ label: 'Code', value: code, meaning: 'Unknown format', color: SEGMENT_COLORS.domain }];
}
