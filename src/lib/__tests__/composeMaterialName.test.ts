import { describe, it, expect } from 'vitest';
import {
  composeMaterialName,
  type SubcategoryLite,
  type MaterialLite,
} from '../composeMaterialName';

const blockSubcat: SubcategoryLite = {
  name_en: 'Block',
  name_ar: 'بلوك',
  spec_definitions: [
    {
      key: 'insulation',
      label_en: 'Insulation',
      label_ar: 'العزل',
      options: [
        { value: '1', code_digit: '1', label_en: 'Insulated', label_ar: 'معزول' },
        { value: '2', code_digit: '2', label_en: 'Non-insulated', label_ar: 'غير معزول' },
      ],
    },
    {
      key: 'holes',
      label_en: 'Holes',
      label_ar: 'فتحات',
      options: [
        { value: '4', code_digit: '4', label_en: '4 Holes', label_ar: '٤ فتحات' },
        { value: '6', code_digit: '6', label_en: '6 Holes', label_ar: '٦ فتحات' },
      ],
    },
    {
      key: 'size_cm',
      label_en: 'Size',
      options: [],
    },
  ],
  variant_definitions: {
    key: 'size_cm',
    label_en: 'Size',
    options: ['15', '20', '25'],
  },
};

describe('composeMaterialName', () => {
  it('composes English name with specs and variant (unit from key suffix)', () => {
    const mat: MaterialLite = { specs: { insulation: '1', holes: '4' }, size_cm: '20' };
    expect(composeMaterialName(mat, blockSubcat, 'en')).toBe(
      'Block: Insulated, 4 Holes — 20 cm',
    );
  });

  it('composes Arabic name and falls back to English when label_ar missing', () => {
    const mat: MaterialLite = { specs: { insulation: '2', holes: '6' }, size_cm: '25' };
    expect(composeMaterialName(mat, blockSubcat, 'ar')).toBe(
      'بلوك: غير معزول, ٦ فتحات — 25 cm',
    );
  });

  it('skips spec keys not present on the material', () => {
    const mat: MaterialLite = { specs: { insulation: '1' }, size_cm: '15' };
    expect(composeMaterialName(mat, blockSubcat, 'en')).toBe('Block: Insulated — 15 cm');
  });

  it('returns subcategory name when no specs and no variant', () => {
    expect(composeMaterialName({ specs: {} }, blockSubcat, 'en')).toBe('Block');
  });

  it('falls back to raw value when option not in definitions', () => {
    const mat: MaterialLite = { specs: { insulation: 'XX' }, size_cm: '20' };
    expect(composeMaterialName(mat, blockSubcat, 'en')).toBe('Block: XX — 20 cm');
  });

  it('does not duplicate variant in spec list', () => {
    const mat: MaterialLite = { specs: { insulation: '1', size_cm: '20' } };
    const out = composeMaterialName(mat, blockSubcat, 'en');
    expect(out).toBe('Block: Insulated — 20 cm');
  });

  it('prefers unit from variant label parens over key suffix', () => {
    const sub: SubcategoryLite = {
      ...blockSubcat,
      variant_definitions: { key: 'size_cm', label_en: 'Length (mm)', options: [] },
    };
    expect(composeMaterialName({ specs: {}, size_cm: '12' }, sub, 'en')).toBe(
      'Block — 12 mm',
    );
  });

  it('omits unit when variant key has no underscore and label has no parens', () => {
    const sub: SubcategoryLite = {
      ...blockSubcat,
      variant_definitions: { key: 'grade', label_en: 'Grade', options: [] },
    };
    expect(composeMaterialName({ specs: { grade: 'A' } }, sub, 'en')).toBe('Block — A');
  });

  it('handles missing subcategory gracefully', () => {
    expect(composeMaterialName({ specs: {} }, null, 'en')).toBe('');
  });
});
