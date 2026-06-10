
-- 1. Revamp supplier rating system
ALTER TABLE public.suppliers DROP COLUMN IF EXISTS rating_price;
ALTER TABLE public.suppliers DROP COLUMN IF EXISTS rating_delivery;
ALTER TABLE public.suppliers DROP COLUMN IF EXISTS rating_responsiveness;
ALTER TABLE public.suppliers DROP COLUMN IF EXISTS rating_quality;
ALTER TABLE public.suppliers ADD COLUMN quality_grade text DEFAULT NULL;
ALTER TABLE public.suppliers ADD COLUMN rating_notes text DEFAULT NULL;

-- 2. Add non-core materials with trigger disabled and explicit codes
ALTER TABLE materials DISABLE TRIGGER trg_materials_set_code;

-- Drop the check constraint temporarily
ALTER TABLE materials DROP CONSTRAINT IF EXISTS materials_code_format_check;

-- Cement Blocks extras (subcategory = Solid Blocks)
INSERT INTO materials (name, name_en, name_ar, uom, status, is_core, subcategory_id, variant_no, material_no, specs, market_price_min_sar, market_price_max_sar, default_moq, code)
SELECT
  v.name, v.name_en, v.name_ar, v.uom, 'active', false, ms.id, v.variant_no, v.material_no, v.specs::jsonb, v.price_min, v.price_max, v.moq, v.code
FROM material_subcategories ms
CROSS JOIN (VALUES
  ('Decorative Block 20cm', 'Decorative Block 20cm', 'بلك ديكور 20سم', 'piece', 1, 200, '{"type":"decorative","size_cm":"20"}'::text, 3.5, 5.5, 500, 'MAT.BB.01.200.20'),
  ('Thermal Insulated Block', 'Thermal Insulated Block', 'بلك عازل حراري', 'piece', 1, 201, '{"type":"thermal_insulated","size_cm":"20"}'::text, 5.0, 8.0, 300, 'MAT.BB.01.201.20'),
  ('Curb Stone 50cm', 'Curb Stone 50cm', 'بردورة 50سم', 'piece', 1, 202, '{"type":"curb","size_cm":"50"}'::text, 4.0, 6.0, 200, 'MAT.BB.01.202.50'),
  ('Interlocking Paver', 'Interlocking Paver', 'بلاط متداخل', 'sqm', 1, 203, '{"type":"paver"}'::text, 35.0, 55.0, 100, 'MAT.BB.01.203.00')
) AS v(name, name_en, name_ar, uom, variant_no, material_no, specs, price_min, price_max, moq, code)
WHERE ms.name_en = 'Solid Blocks';

-- Ready Mix extras (subcategory = Standard Mix)
INSERT INTO materials (name, name_en, name_ar, uom, status, is_core, subcategory_id, variant_no, material_no, specs, market_price_min_sar, market_price_max_sar, default_moq, code)
SELECT
  v.name, v.name_en, v.name_ar, v.uom, 'active', false, ms.id, v.variant_no, v.material_no, v.specs::jsonb, v.price_min, v.price_max, v.moq, v.code
FROM material_subcategories ms
CROSS JOIN (VALUES
  ('C15 Lean Mix', 'C15 Lean Mix', 'خرسانة C15', 'cbm', 1, 210, '{"grade":"C15"}'::text, 160.0, 200.0, 5, 'MAT.RM.01.210.00'),
  ('C50 High Strength', 'C50 High Strength', 'خرسانة C50 عالية', 'cbm', 1, 211, '{"grade":"C50"}'::text, 280.0, 350.0, 5, 'MAT.RM.01.211.00'),
  ('Self-Compacting Concrete', 'Self-Compacting Concrete', 'خرسانة ذاتية الدمك', 'cbm', 1, 212, '{"grade":"C40","type":"SCC"}'::text, 300.0, 380.0, 5, 'MAT.RM.01.212.00'),
  ('Fiber Reinforced Concrete', 'Fiber Reinforced Concrete', 'خرسانة مسلحة بالألياف', 'cbm', 1, 213, '{"grade":"C30","type":"fiber"}'::text, 260.0, 320.0, 5, 'MAT.RM.01.213.00')
) AS v(name, name_en, name_ar, uom, variant_no, material_no, specs, price_min, price_max, moq, code)
WHERE ms.name_en = 'Standard Mix';

-- Sand & Aggregates extras (subcategory = Construction Sand)
INSERT INTO materials (name, name_en, name_ar, uom, status, is_core, subcategory_id, variant_no, material_no, specs, market_price_min_sar, market_price_max_sar, default_moq, code)
SELECT
  v.name, v.name_en, v.name_ar, v.uom, 'active', false, ms.id, v.variant_no, v.material_no, v.specs::jsonb, v.price_min, v.price_max, v.moq, v.code
FROM material_subcategories ms
CROSS JOIN (VALUES
  ('Fine Sand (Washed)', 'Fine Sand (Washed)', 'رمل ناعم مغسول', 'ton', 1, 310, '{"type":"fine_washed"}'::text, 35.0, 55.0, 20, 'MAT.SA.01.310.00'),
  ('Gravel 20mm', 'Gravel 20mm', 'حصى 20مم', 'ton', 1, 311, '{"type":"gravel","size":"20mm"}'::text, 40.0, 60.0, 20, 'MAT.SA.01.311.00'),
  ('Crushed Limestone', 'Crushed Limestone', 'حجر جيري مكسر', 'ton', 1, 312, '{"type":"limestone"}'::text, 25.0, 45.0, 30, 'MAT.SA.01.312.00'),
  ('Sub-base Material', 'Sub-base Material', 'مواد تأسيس', 'ton', 1, 313, '{"type":"sub_base"}'::text, 20.0, 35.0, 30, 'MAT.SA.01.313.00')
) AS v(name, name_en, name_ar, uom, variant_no, material_no, specs, price_min, price_max, moq, code)
WHERE ms.name_en = 'Construction Sand';

-- Cement extras (subcategory = Portland Cement)
INSERT INTO materials (name, name_en, name_ar, uom, status, is_core, subcategory_id, variant_no, material_no, specs, market_price_min_sar, market_price_max_sar, default_moq, code)
SELECT
  v.name, v.name_en, v.name_ar, v.uom, 'active', false, ms.id, v.variant_no, v.material_no, v.specs::jsonb, v.price_min, v.price_max, v.moq, v.code
FROM material_subcategories ms
CROSS JOIN (VALUES
  ('White Cement', 'White Cement', 'اسمنت أبيض', 'bag', 1, 410, '{"type":"white"}'::text, 22.0, 32.0, 50, 'MAT.CM.01.410.00'),
  ('Rapid Setting Cement', 'Rapid Setting Cement', 'اسمنت سريع الشك', 'bag', 1, 411, '{"type":"rapid_setting"}'::text, 20.0, 28.0, 50, 'MAT.CM.01.411.00'),
  ('Masonry Cement', 'Masonry Cement', 'اسمنت بناء', 'bag', 1, 412, '{"type":"masonry"}'::text, 14.0, 20.0, 100, 'MAT.CM.01.412.00'),
  ('Grout Mix', 'Grout Mix', 'خلطة حشو', 'bag', 1, 413, '{"type":"grout"}'::text, 18.0, 26.0, 50, 'MAT.CM.01.413.00')
) AS v(name, name_en, name_ar, uom, variant_no, material_no, specs, price_min, price_max, moq, code)
WHERE ms.name_en = 'Portland Cement';

-- Re-add constraint and re-enable trigger
ALTER TABLE materials ADD CONSTRAINT materials_code_format_check 
  CHECK (code IS NULL OR code ~ '^MAT\.[A-Z]{2}\.[0-9]{2}\.[0-9]{3}\.[0-9]{2}$') NOT VALID;
ALTER TABLE materials ENABLE TRIGGER trg_materials_set_code;
