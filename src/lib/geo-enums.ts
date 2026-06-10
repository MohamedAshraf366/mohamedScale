/**
 * GCC Country and Saudi City enums — mirrors the DB enum types.
 * Used for validation, dropdowns, and normalizing raw geocoding output.
 */

export const GCC_COUNTRIES = [
  'SA', 'AE', 'BH', 'KW', 'OM', 'QA',
] as const;

export type GccCountry = typeof GCC_COUNTRIES[number];

export const GCC_COUNTRY_LABELS: Record<GccCountry, string> = {
  SA: 'Saudi Arabia',
  AE: 'United Arab Emirates',
  BH: 'Bahrain',
  KW: 'Kuwait',
  OM: 'Oman',
  QA: 'Qatar',
};

export const SAUDI_CITIES = [
  'Riyadh', 'Jeddah', 'Makkah', 'Madinah', 'Dammam', 'Khobar', 'Dhahran',
  'Tabuk', 'Abha', 'Taif', 'Hail', 'Buraidah', 'Najran', 'Jazan',
  'Yanbu', 'Jubail', 'Khamis Mushait', 'Al Ahsa', 'Al Qatif',
  'Sakaka', 'Arar', 'Baha', 'Bisha', 'Hafar Al Batin',
  'Unaizah', 'Dawadmi', 'Khafji', 'Ras Tanura',
  'Al Majmaah', 'Shaqra', 'Al Zulfi', 'Wadi Al Dawasir',
  'Afif', 'Al Kharj', 'Diriyah', 'Muzahmiyya', 'Huraymila',
  'Rumah', 'Thadiq', 'Al Ghat', 'Marat', 'Layla',
] as const;

export type SaudiCity = typeof SAUDI_CITIES[number];

/**
 * Map of common Nominatim / Arabic city names → canonical enum value.
 * Add entries as new variants appear from geocoding services.
 */
const CITY_ALIASES: Record<string, SaudiCity> = {
  // Arabic
  'الرياض': 'Riyadh',
  'جدة': 'Jeddah',
  'مكة': 'Makkah',
  'مكة المكرمة': 'Makkah',
  'المدينة المنورة': 'Madinah',
  'الدمام': 'Dammam',
  'الخبر': 'Khobar',
  'الظهران': 'Dhahran',
  'تبوك': 'Tabuk',
  'أبها': 'Abha',
  'الطائف': 'Taif',
  'حائل': 'Hail',
  'بريدة': 'Buraidah',
  'نجران': 'Najran',
  'جازان': 'Jazan',
  'جيزان': 'Jazan',
  'ينبع': 'Yanbu',
  'الجبيل': 'Jubail',
  'خميس مشيط': 'Khamis Mushait',
  'الأحساء': 'Al Ahsa',
  'القطيف': 'Al Qatif',
  'سكاكا': 'Sakaka',
  'عرعر': 'Arar',
  'الباحة': 'Baha',
  'بيشة': 'Bisha',
  'حفر الباطن': 'Hafar Al Batin',
  'عنيزة': 'Unaizah',
  'الدوادمي': 'Dawadmi',
  'الخفجي': 'Khafji',
  'رأس تنورة': 'Ras Tanura',
  'المجمعة': 'Al Majmaah',
  'شقراء': 'Shaqra',
  'الزلفي': 'Al Zulfi',
  'وادي الدواسر': 'Wadi Al Dawasir',
  'عفيف': 'Afif',
  'الخرج': 'Al Kharj',
  'الدرعية': 'Diriyah',
  'المزاحمية': 'Muzahmiyya',
  'حريملاء': 'Huraymila',
  'رماح': 'Rumah',
  'ثادق': 'Thadiq',
  'الغاط': 'Al Ghat',
  'مرات': 'Marat',
  'ليلى': 'Layla',
  // Nominatim municipality-style names
  'العارض': 'Riyadh',
  // English variants
  'riyadh': 'Riyadh',
  'jeddah': 'Jeddah',
  'jedda': 'Jeddah',
  'mecca': 'Makkah',
  'medina': 'Madinah',
};

/**
 * Normalize a raw country string to a GCC country code.
 * Returns 'SA' as default if unrecognized.
 */
export function normalizeCountry(raw: string | null | undefined): GccCountry {
  if (!raw) return 'SA';
  const trimmed = raw.trim();
  // Already a valid code?
  if (GCC_COUNTRIES.includes(trimmed as GccCountry)) return trimmed as GccCountry;
  // Match by label
  const entry = Object.entries(GCC_COUNTRY_LABELS).find(
    ([, label]) => label.toLowerCase() === trimmed.toLowerCase()
  );
  if (entry) return entry[0] as GccCountry;
  // Common aliases
  if (/saudi/i.test(trimmed)) return 'SA';
  if (/emirates|uae/i.test(trimmed)) return 'AE';
  if (/bahrain/i.test(trimmed)) return 'BH';
  if (/kuwait/i.test(trimmed)) return 'KW';
  if (/oman/i.test(trimmed)) return 'OM';
  if (/qatar/i.test(trimmed)) return 'QA';
  return 'SA';
}

/**
 * Normalize a raw city string to a canonical SaudiCity enum value.
 * Returns null if unrecognized (caller should move raw value to address_text).
 */
export function normalizeCity(raw: string | null | undefined): SaudiCity | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Exact match
  if (SAUDI_CITIES.includes(trimmed as SaudiCity)) return trimmed as SaudiCity;
  // Case-insensitive match
  const lower = trimmed.toLowerCase();
  const direct = SAUDI_CITIES.find(c => c.toLowerCase() === lower);
  if (direct) return direct;
  // Alias lookup (case-insensitive)
  const alias = CITY_ALIASES[trimmed] || CITY_ALIASES[lower];
  if (alias) return alias;
  // Partial match: check if any city name is contained in the raw string
  // e.g. "Al Maathar Municipality, Riyadh governorate" → Riyadh
  const containsMatch = SAUDI_CITIES.find(c => lower.includes(c.toLowerCase()));
  if (containsMatch) return containsMatch;
  return null;
}

/**
 * Normalize a location's city and country, moving unmatched city to address_text.
 */
export function normalizeLocationFields(fields: {
  city?: string | null;
  country?: string | null;
  address_text?: string | null;
}): { city: SaudiCity | null; country: GccCountry; address_text: string | null } {
  const country = normalizeCountry(fields.country);
  const normalizedCity = normalizeCity(fields.city);
  let addressText = fields.address_text || null;

  // If city didn't match and has a value, prepend it to address_text
  if (fields.city && !normalizedCity) {
    addressText = addressText
      ? `${fields.city}, ${addressText}`
      : fields.city;
  }

  return { city: normalizedCity, country, address_text: addressText };
}
