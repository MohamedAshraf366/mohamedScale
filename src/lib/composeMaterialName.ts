/**
 * Phase 1 — Computed Material Display Name
 *
 * Pure helper that builds a material's display name from authoritative
 * sources (subcategory + spec_definitions + variant_definitions), instead
 * of relying on the persisted `materials.name` / `name_en` / `name_ar`
 * columns which drift when labels are renamed.
 *
 * Mirrors the SQL function `material_display_name(material_id, locale)`
 * shipped in Phase 0.
 */

export type Locale = 'en' | 'ar';

export interface SpecOption {
  value: string;
  code_digit?: string;
  label_en: string;
  label_ar?: string | null;
  status?: 'active' | 'archived';
}

export interface SpecDefinitionLite {
  key: string;
  label_en: string;
  label_ar?: string | null;
  default_code_digit?: string | null;
  status?: 'active' | 'archived';
  options: SpecOption[];
}

export interface VariantDefinitionLite {
  key: string;
  label_en?: string;
  label_ar?: string | null;
  options?: string[];
}

export interface SubcategoryLite {
  name_en: string;
  name_ar?: string | null;
  spec_definitions?: SpecDefinitionLite[] | null;
  variant_definitions?: VariantDefinitionLite | null;
}

export interface MaterialLite {
  specs?: Record<string, unknown> | null;
  /**
   * The variant value. We accept either:
   *  - the raw `specs[variant_definitions.key]` value, or
   *  - a `size_cm` / variant column on the material row.
   * Callers should pass whichever they have; we fall back to specs[key].
   */
  variant_value?: string | number | null;
  size_cm?: string | number | null;
}

function pickLocaleText(
  en: string | null | undefined,
  ar: string | null | undefined,
  locale: Locale,
): string {
  if (locale === 'ar') return (ar && ar.trim()) || en || '';
  return en || (ar ?? '') || '';
}

/**
 * Resolve a single spec value into its label for the given locale.
 * Falls back to the raw value when the option isn't found.
 */
function specValueToLabel(
  def: SpecDefinitionLite,
  rawValue: unknown,
  locale: Locale,
): string {
  const str = rawValue == null ? '' : String(rawValue);
  const opt = def.options?.find((o) => o.value === str);
  if (!opt) return str;
  return pickLocaleText(opt.label_en, opt.label_ar, locale);
}

/**
 * Build the display name for a material.
 *
 * Format: "<Subcategory>: <spec label 1>, <spec label 2>, ... — <variant>"
 * Example: "Block: Insulated, 4 Holes — 20 cm"
 *
 * - Skips spec keys not present in `material.specs`.
 * - Skips the variant axis spec key (rendered separately).
 * - If no specs and no variant, returns just the subcategory name.
 */
export function composeMaterialName(
  material: MaterialLite | null | undefined,
  subcategory: SubcategoryLite | null | undefined,
  locale: Locale = 'en',
): string {
  if (!subcategory) return '';

  const subName = pickLocaleText(subcategory.name_en, subcategory.name_ar, locale);

  const variantKey = subcategory.variant_definitions?.key ?? null;
  const specs = (material?.specs ?? {}) as Record<string, unknown>;

  // Spec labels (excluding the variant axis)
  const specLabels: string[] = [];
  for (const def of subcategory.spec_definitions ?? []) {
    if (def.key === variantKey) continue;
    if (!(def.key in specs)) continue;
    const label = specValueToLabel(def, specs[def.key], locale);
    if (label) specLabels.push(label);
  }

  // Variant label (with unit appended when known)
  let variantLabel = '';
  const rawVariant =
    material?.variant_value ??
    (variantKey ? specs[variantKey] : undefined) ??
    material?.size_cm ??
    null;
  if (rawVariant != null && String(rawVariant).trim() !== '') {
    const value = String(rawVariant).trim();
    // Derive unit: prefer "(unit)" inside variant label, else suffix after last "_" in key
    const labelText = pickLocaleText(
      subcategory.variant_definitions?.label_en,
      subcategory.variant_definitions?.label_ar,
      locale,
    );
    const parenMatch = labelText?.match(/\(([^)]+)\)/);
    let unit: string | null = parenMatch ? parenMatch[1].trim() : null;
    if (!unit && variantKey && variantKey.includes('_')) {
      const tail = variantKey.split('_').pop();
      if (tail && tail !== variantKey) unit = tail;
    }
    variantLabel = unit ? `${value} ${unit}` : value;
  }

  const parts: string[] = [subName];
  if (specLabels.length) parts.push(specLabels.join(', '));

  const head = parts.filter(Boolean).join(': ');
  if (variantLabel) return head ? `${head} — ${variantLabel}` : variantLabel;
  return head;
}

/**
 * Compose the display name **from the material code** instead of from
 * `material.specs`. The code is the authoritative source — its spec digits
 * are assigned by the coding system and never drift. `specs` JSON can go
 * stale if a row was edited before the trigger backfill landed.
 *
 * Code shape: `MAT.<CAT>.<SUB>.<digit1><digit2>...<digitN>.<size>`
 *   - The middle group's digits are positional, one per `spec_definitions`
 *     entry (excluding the variant axis), each mapped via `option.code_digit`.
 *   - The trailing group is the raw variant value (e.g. `15` → "15 cm").
 *
 * Falls back to `composeMaterialName(material, subcategory, locale)` when
 * the code can't be parsed or required digit maps are missing.
 */
export function composeMaterialNameFromCode(
  code: string | null | undefined,
  subcategory: SubcategoryLite | null | undefined,
  locale: Locale = 'en',
  fallbackMaterial?: MaterialLite | null,
): string {
  if (!subcategory) return '';
  if (!code) return composeMaterialName(fallbackMaterial, subcategory, locale);

  // Accept BOTH levels:
  //   variant:  MAT.<CAT>.<SUB>.<digits>.<size>
  //   spec:     MAT.<CAT>.<SUB>.<digits>          (no size segment → no "— X cm")
  const variantMatch = code.match(/^MAT\.[A-Z]{2}\.\d{2}\.(\d+)\.(\d+)$/);
  const specMatch = variantMatch ? null : code.match(/^MAT\.[A-Z]{2}\.\d{2}\.(\d+)$/);
  if (!variantMatch && !specMatch) {
    return composeMaterialName(fallbackMaterial, subcategory, locale);
  }
  const digitsStr = (variantMatch ?? specMatch)![1];
  const sizeRaw = variantMatch ? variantMatch[2] : '';

  const subName = pickLocaleText(subcategory.name_en, subcategory.name_ar, locale);
  const variantKey = subcategory.variant_definitions?.key ?? null;
  const specDefs = (subcategory.spec_definitions ?? []).filter(d => d.key !== variantKey);

  const digits = digitsStr.split('');
  const specLabels: string[] = [];
  for (let i = 0; i < specDefs.length; i++) {
    const def = specDefs[i];
    // Smart decoder: fall back to axis default when the code is shorter
    // than current definitions (e.g. a newly appended axis).
    const digit = digits[i] ?? (def.default_code_digit ?? null);
    if (digit == null) break;
    const opt = def.options?.find(o => String(o.code_digit ?? '') === digit);
    if (opt) specLabels.push(pickLocaleText(opt.label_en, opt.label_ar, locale));
    else if (digit) specLabels.push(digit); // unknown digit — surface it
  }

  // Variant value + unit
  let variantLabel = '';
  if (sizeRaw) {
    const labelText = pickLocaleText(
      subcategory.variant_definitions?.label_en,
      subcategory.variant_definitions?.label_ar,
      locale,
    );
    const parenMatch = labelText?.match(/\(([^)]+)\)/);
    let unit: string | null = parenMatch ? parenMatch[1].trim() : null;
    if (!unit && variantKey && variantKey.includes('_')) {
      const tail = variantKey.split('_').pop();
      if (tail && tail !== variantKey) unit = tail;
    }
    // Strip leading zeros for display ("15" stays "15", "05" → "5").
    const value = String(parseInt(sizeRaw, 10));
    variantLabel = unit ? `${value} ${unit}` : value;
  }

  const parts: string[] = [subName];
  if (specLabels.length) parts.push(specLabels.join(', '));
  const head = parts.filter(Boolean).join(': ');
  if (variantLabel) return head ? `${head} — ${variantLabel}` : variantLabel;
  return head;
}
