-- =====================================================
-- Clean up old data and seed 13 official Saudi provinces
-- =====================================================

-- First, delete all existing zones
DELETE FROM zones;

-- Then, delete all existing regions
DELETE FROM regions;

-- Clear topology tables (for fresh start)
DELETE FROM zone_edges;
DELETE FROM region_edges;
DELETE FROM geo_edges;
DELETE FROM geo_vertices;

-- Insert the 13 official Saudi administrative regions (Mantiqah)
-- Using simplified center coordinates and placeholder boundaries
-- Full GeoJSON boundaries will be loaded from the data file
INSERT INTO regions (code, name_en, name_ar, center_lat, center_lng, is_active) VALUES
  ('ASR', '''Asir', 'عسير', 18.2164, 42.5053, true),
  ('BAH', 'Al Bahah', 'الباحة', 20.0129, 41.4677, true),
  ('SHQ', 'Ash Sharqiyah', 'الشرقية', 26.4207, 49.9777, true),
  ('HAL', 'Ha''il', 'حائل', 27.5236, 41.6803, true),
  ('JZN', 'Jizan', 'جازان', 16.8892, 42.5511, true),
  ('JOF', 'Al Jawf', 'الجوف', 29.8147, 39.7469, true),
  ('MKK', 'Makkah', 'مكة المكرمة', 21.4225, 39.8262, true),
  ('MED', 'Al Madinah', 'المدينة المنورة', 24.5247, 39.5692, true),
  ('NJR', 'Najran', 'نجران', 17.4933, 44.1277, true),
  ('NRN', 'Northern Borders', 'الحدود الشمالية', 30.9843, 42.5530, true),
  ('QAS', 'Al Qassim', 'القصيم', 26.3267, 43.9700, true),
  ('RUH', 'Ar Riyad', 'الرياض', 24.7136, 46.6753, true),
  ('TBK', 'Tabuk', 'تبوك', 28.3838, 36.5650, true);