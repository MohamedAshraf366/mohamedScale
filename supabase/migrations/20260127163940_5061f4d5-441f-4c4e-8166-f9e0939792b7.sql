
-- Migrate 3 suppliers from Scale 1.0

-- Step 1: Create locations
INSERT INTO locations (id, city, address_link, country, created_at) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Riyadh', 'https://maps.app.goo.gl/cV65tSvNbuzsRYo5A', 'SA', '2025-10-22 19:50:47.645953+00'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Riyadh', 'https://maps.app.goo.gl/9xTJabX1oycsbJgYA', 'SA', '2025-11-14 16:11:17.28677+00'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Riyadh', 'https://share.google/Pz0Q2y0WS3V4h2sAY', 'SA', '2025-12-12 19:10:26.547756+00');

-- Step 2: Create accounts (using 'company' as account_kind - supplier relationship established via suppliers table)
INSERT INTO accounts (id, display_name, legal_name, account_kind, status, location_id, notes, metadata, created_at, updated_at) VALUES
  ('25e4b750-57e9-4d96-b571-64542b76a7f8', 'مصنع الانشاءات الخليجية', 'مصنع الانشاءات الخليجية', 'company', 'active', 'a1b2c3d4-0001-4000-8000-000000000001', 'test test test', '{}', '2025-10-22 19:50:47.645953+00', '2025-11-11 19:35:14.706725+00'),
  ('972faea6-fe19-4248-9f15-329ae0362b88', 'مصنع صالح الراجحي', 'مصنع صالح الراجحي', 'company', 'active', 'a1b2c3d4-0002-4000-8000-000000000002', NULL, '{"secondary_phone": "+966560294793"}', '2025-11-14 16:11:17.28677+00', '2025-11-14 18:04:43.373203+00'),
  ('22cb340a-4547-4a84-8187-bcb514f01f12', 'شركة اللبنة الماسية للمنتجات الاسمنتية', 'شركة اللبنة الماسية للمنتجات الاسمنتية', 'company', 'active', 'a1b2c3d4-0003-4000-8000-000000000003', NULL, '{"coverage": ["Riyadh", "Central"]}', '2025-12-12 19:10:26.547756+00', '2025-12-12 19:10:26.547756+00');

-- Step 3: Create contacts for each supplier (2 have contact info)
INSERT INTO contacts (id, account_id, full_name, phone, is_primary, created_at) VALUES
  ('b1c2d3e4-0001-4000-8000-000000000001', '25e4b750-57e9-4d96-b571-64542b76a7f8', 'محمد - أبو علاء', '+966561287480', true, '2025-10-22 19:50:47.645953+00'),
  ('b1c2d3e4-0002-4000-8000-000000000002', '972faea6-fe19-4248-9f15-329ae0362b88', 'أبو علي', '+966532428800', true, '2025-11-14 16:11:17.28677+00');

-- Step 4: Update accounts with POC contact IDs
UPDATE accounts SET poc_contact_id = 'b1c2d3e4-0001-4000-8000-000000000001' WHERE id = '25e4b750-57e9-4d96-b571-64542b76a7f8';
UPDATE accounts SET poc_contact_id = 'b1c2d3e4-0002-4000-8000-000000000002' WHERE id = '972faea6-fe19-4248-9f15-329ae0362b88';

-- Step 5: Create supplier records
INSERT INTO suppliers (account_id, supplier_code, supplier_type, lead_time_days, rating, notes, created_at, updated_at) VALUES
  ('25e4b750-57e9-4d96-b571-64542b76a7f8', 'SUP-001', 'store', 2, 5, 'test test test', '2025-10-22 19:50:47.645953+00', '2025-11-11 19:35:14.706725+00'),
  ('972faea6-fe19-4248-9f15-329ae0362b88', 'SUP-002', 'store', NULL, 5, NULL, '2025-11-14 16:11:17.28677+00', '2025-11-14 18:04:43.373203+00'),
  ('22cb340a-4547-4a84-8187-bcb514f01f12', 'SUP-003', 'manufacturer', NULL, NULL, NULL, '2025-12-12 19:10:26.547756+00', '2025-12-12 19:10:26.547756+00');
