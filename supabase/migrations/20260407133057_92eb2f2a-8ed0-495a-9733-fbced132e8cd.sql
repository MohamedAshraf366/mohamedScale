
-- 1. Fix constraint
ALTER TABLE public.supplier_materials DROP CONSTRAINT IF EXISTS supplier_materials_status_check;
UPDATE public.supplier_materials SET status = 'submitted' WHERE status = 'quoted';
ALTER TABLE public.supplier_materials ADD CONSTRAINT supplier_materials_status_check
  CHECK (status = ANY (ARRAY['submitted','under_review','rejected','negotiating','approved','passed','shortlisted']));

-- 2. Categories
INSERT INTO public.material_categories (id, code2, name_en, name_ar, status) VALUES
  ('d0d0d0d0-ca01-4000-a000-000000000001', 'RM', 'Ready Mix Concrete', 'خرسانة جاهزة', 'active'),
  ('d0d0d0d0-ca02-4000-a000-000000000001', 'SA', 'Sand & Aggregates', 'رمل وركام', 'active'),
  ('d0d0d0d0-ca03-4000-a000-000000000001', 'CM', 'Cement', 'أسمنت', 'active')
ON CONFLICT (id) DO NOTHING;

-- 3. Subcategories
INSERT INTO public.material_subcategories (id, category_id, subcategory_no, name_en, name_ar, default_uom, status) VALUES
  ('d0d0d0d0-5b01-4000-a000-000000000001', 'd0d0d0d0-ca01-4000-a000-000000000001', 1, 'Standard Concrete Mix', 'خلطة خرسانية عادية', 'm3', 'active'),
  ('d0d0d0d0-5b02-4000-a000-000000000001', 'd0d0d0d0-ca02-4000-a000-000000000001', 1, 'Washed Sand', 'رمل مغسول', 'ton', 'active'),
  ('d0d0d0d0-5b03-4000-a000-000000000001', 'd0d0d0d0-ca03-4000-a000-000000000001', 1, 'Portland Cement', 'أسمنت بورتلاندي', 'ton', 'active')
ON CONFLICT (id) DO NOTHING;

-- 4. Disable code trigger, insert materials, re-enable
ALTER TABLE public.materials DISABLE TRIGGER trg_materials_set_code;

INSERT INTO public.materials (id, subcategory_id, name, name_en, code, uom, material_no, variant_no, is_core, status) VALUES
  ('d0d0d0d0-0a01-4000-a000-000000000001', 'd0d0d0d0-5b01-4000-a000-000000000001', 'Concrete Mix: C20, Slump 100', 'Concrete Mix: C20, Slump 100', 'MAT.RM.01.110.01', 'm3', 1, 1, true, 'active'),
  ('d0d0d0d0-0a01-4000-a000-000000000002', 'd0d0d0d0-5b01-4000-a000-000000000001', 'Concrete Mix: C25, Slump 100', 'Concrete Mix: C25, Slump 100', 'MAT.RM.01.110.02', 'm3', 1, 2, true, 'active'),
  ('d0d0d0d0-0a01-4000-a000-000000000003', 'd0d0d0d0-5b01-4000-a000-000000000001', 'Concrete Mix: C30, Slump 100', 'Concrete Mix: C30, Slump 100', 'MAT.RM.01.110.03', 'm3', 1, 3, true, 'active'),
  ('d0d0d0d0-0a01-4000-a000-000000000004', 'd0d0d0d0-5b01-4000-a000-000000000001', 'Concrete Mix: C35, Slump 100', 'Concrete Mix: C35, Slump 100', 'MAT.RM.01.110.04', 'm3', 1, 4, false, 'active'),
  ('d0d0d0d0-0a01-4000-a000-000000000005', 'd0d0d0d0-5b01-4000-a000-000000000001', 'Concrete Mix: C40, Slump 100', 'Concrete Mix: C40, Slump 100', 'MAT.RM.01.110.05', 'm3', 1, 5, false, 'active'),
  ('d0d0d0d0-0a01-4000-a000-000000000006', 'd0d0d0d0-5b01-4000-a000-000000000001', 'Concrete Mix: C20, Slump 150', 'Concrete Mix: C20, Slump 150', 'MAT.RM.01.120.01', 'm3', 2, 1, false, 'active'),
  ('d0d0d0d0-0a01-4000-a000-000000000007', 'd0d0d0d0-5b01-4000-a000-000000000001', 'Concrete Mix: C25, Slump 150', 'Concrete Mix: C25, Slump 150', 'MAT.RM.01.120.02', 'm3', 2, 2, true, 'active'),
  ('d0d0d0d0-0a01-4000-a000-000000000008', 'd0d0d0d0-5b01-4000-a000-000000000001', 'Concrete Mix: C30, Slump 150', 'Concrete Mix: C30, Slump 150', 'MAT.RM.01.120.03', 'm3', 2, 3, false, 'active'),
  ('d0d0d0d0-0a02-4000-a000-000000000001', 'd0d0d0d0-5b02-4000-a000-000000000001', 'Washed Sand: Fine, White', 'Washed Sand: Fine, White', 'MAT.SA.01.110.01', 'ton', 1, 1, true, 'active'),
  ('d0d0d0d0-0a02-4000-a000-000000000002', 'd0d0d0d0-5b02-4000-a000-000000000001', 'Washed Sand: Fine, Yellow', 'Washed Sand: Fine, Yellow', 'MAT.SA.01.110.02', 'ton', 1, 2, false, 'active'),
  ('d0d0d0d0-0a02-4000-a000-000000000003', 'd0d0d0d0-5b02-4000-a000-000000000001', 'Washed Sand: Coarse, White', 'Washed Sand: Coarse, White', 'MAT.SA.01.120.01', 'ton', 2, 1, true, 'active'),
  ('d0d0d0d0-0a02-4000-a000-000000000004', 'd0d0d0d0-5b02-4000-a000-000000000001', 'Washed Sand: Coarse, Yellow', 'Washed Sand: Coarse, Yellow', 'MAT.SA.01.120.02', 'ton', 2, 2, false, 'active'),
  ('d0d0d0d0-0a02-4000-a000-000000000005', 'd0d0d0d0-5b02-4000-a000-000000000001', 'Washed Sand: Plastering Grade', 'Washed Sand: Plastering Grade', 'MAT.SA.01.130.01', 'ton', 3, 1, false, 'active'),
  ('d0d0d0d0-0a03-4000-a000-000000000001', 'd0d0d0d0-5b03-4000-a000-000000000001', 'Portland Cement: OPC Type I', 'Portland Cement: OPC Type I', 'MAT.CM.01.110.01', 'ton', 1, 1, true, 'active'),
  ('d0d0d0d0-0a03-4000-a000-000000000002', 'd0d0d0d0-5b03-4000-a000-000000000001', 'Portland Cement: OPC Type II', 'Portland Cement: OPC Type II', 'MAT.CM.01.110.02', 'ton', 1, 2, true, 'active'),
  ('d0d0d0d0-0a03-4000-a000-000000000003', 'd0d0d0d0-5b03-4000-a000-000000000001', 'Portland Cement: OPC Type V', 'Portland Cement: OPC Type V', 'MAT.CM.01.110.03', 'ton', 1, 3, false, 'active'),
  ('d0d0d0d0-0a03-4000-a000-000000000004', 'd0d0d0d0-5b03-4000-a000-000000000001', 'Portland Cement: PPC Blended', 'Portland Cement: PPC Blended', 'MAT.CM.01.120.01', 'ton', 2, 1, false, 'active'),
  ('d0d0d0d0-0a03-4000-a000-000000000005', 'd0d0d0d0-5b03-4000-a000-000000000001', 'Portland Cement: White', 'Portland Cement: White', 'MAT.CM.01.130.01', 'ton', 3, 1, false, 'active')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.materials ENABLE TRIGGER trg_materials_set_code;

-- 5. Areas
INSERT INTO public.subcategory_areas (id, subcategory_id, name, name_ar, sort_order, color, zone_codes) VALUES
  ('d0d0d0d0-ae01-4000-a000-000000000001', 'd0d0d0d0-5b01-4000-a000-000000000001', 'Central Riyadh', 'وسط الرياض', 1, '#3B82F6', ARRAY['RYD.11012','RYD.11008','RYD.11018','RYD.11045','RYD.11036','RYD.11042','RYD.11056','RYD.11058','RYD.11071','RYD.11075']),
  ('d0d0d0d0-ae02-4000-a000-000000000001', 'd0d0d0d0-5b01-4000-a000-000000000001', 'North Riyadh', 'شمال الرياض', 2, '#10B981', ARRAY['RYD.11001','RYD.11037','RYD.11113','RYD.11115','RYD.11116','RYD.11006','RYD.11096']),
  ('d0d0d0d0-ae03-4000-a000-000000000001', 'd0d0d0d0-5b01-4000-a000-000000000001', 'South Riyadh', 'جنوب الرياض', 3, '#F59E0B', ARRAY['RYD.11004','RYD.11009','RYD.11013','RYD.11025','RYD.11028','RYD.11090']),
  ('d0d0d0d0-ae04-4000-a000-000000000001', 'd0d0d0d0-5b02-4000-a000-000000000001', 'Zone A', 'منطقة أ', 1, '#8B5CF6', ARRAY['RYD.11012','RYD.11008','RYD.11018','RYD.11045','RYD.11036','RYD.11042']),
  ('d0d0d0d0-ae05-4000-a000-000000000001', 'd0d0d0d0-5b02-4000-a000-000000000001', 'Zone B', 'منطقة ب', 2, '#EC4899', ARRAY['RYD.11001','RYD.11037','RYD.11113','RYD.11115','RYD.11116','RYD.11006']),
  ('d0d0d0d0-ae06-4000-a000-000000000001', 'd0d0d0d0-5b03-4000-a000-000000000001', 'Riyadh Metro', 'الرياض المتروبولية', 1, '#06B6D4', ARRAY['RYD.11012','RYD.11008','RYD.11018','RYD.11045','RYD.11036','RYD.11042','RYD.11001','RYD.11037']),
  ('d0d0d0d0-ae07-4000-a000-000000000001', 'd0d0d0d0-5b03-4000-a000-000000000001', 'Riyadh Outskirts', 'ضواحي الرياض', 2, '#F97316', ARRAY['RYD.11004','RYD.11009','RYD.11013','RYD.11025','RYD.11028','RYD.11090'])
ON CONFLICT (id) DO NOTHING;

-- 6. Supplier materials
INSERT INTO public.supplier_materials (id, supplier_account_id, material_id, unit_price, moq, lead_time_days, status, is_current, is_example) VALUES
  ('d0d0d0d0-5001-4000-a000-000000000001', 'aaaaaaaa-0001-4000-a000-000000000001', 'd0d0d0d0-0a01-4000-a000-000000000001', 280, 10, 1, 'approved', true, true),
  ('d0d0d0d0-5001-4000-a000-000000000002', 'aaaaaaaa-0001-4000-a000-000000000001', 'd0d0d0d0-0a01-4000-a000-000000000002', 310, 10, 1, 'approved', true, true),
  ('d0d0d0d0-5001-4000-a000-000000000003', 'aaaaaaaa-0001-4000-a000-000000000001', 'd0d0d0d0-0a01-4000-a000-000000000003', 340, 10, 1, 'approved', true, true),
  ('d0d0d0d0-5002-4000-a000-000000000001', 'aaaaaaaa-0001-4000-a000-000000000002', 'd0d0d0d0-0a02-4000-a000-000000000001', 85, 20, 2, 'approved', true, true),
  ('d0d0d0d0-5002-4000-a000-000000000002', 'aaaaaaaa-0001-4000-a000-000000000002', 'd0d0d0d0-0a02-4000-a000-000000000003', 95, 20, 2, 'approved', true, true),
  ('d0d0d0d0-5003-4000-a000-000000000001', 'aaaaaaaa-0001-4000-a000-000000000003', 'd0d0d0d0-0a03-4000-a000-000000000001', 420, 5, 3, 'approved', true, true),
  ('d0d0d0d0-5003-4000-a000-000000000002', 'aaaaaaaa-0001-4000-a000-000000000003', 'd0d0d0d0-0a03-4000-a000-000000000002', 440, 5, 3, 'submitted', true, true)
ON CONFLICT (id) DO NOTHING;

-- 7. Target prices
INSERT INTO public.target_prices (id, material_id, area_id, target_price, is_example) VALUES
  ('d0d0d0d0-1001-4000-a000-000000000001', 'd0d0d0d0-0a01-4000-a000-000000000001', 'd0d0d0d0-ae01-4000-a000-000000000001', 275, true),
  ('d0d0d0d0-1001-4000-a000-000000000002', 'd0d0d0d0-0a01-4000-a000-000000000002', 'd0d0d0d0-ae01-4000-a000-000000000001', 300, true),
  ('d0d0d0d0-1001-4000-a000-000000000003', 'd0d0d0d0-0a01-4000-a000-000000000003', 'd0d0d0d0-ae01-4000-a000-000000000001', 330, true),
  ('d0d0d0d0-1001-4000-a000-000000000004', 'd0d0d0d0-0a02-4000-a000-000000000001', 'd0d0d0d0-ae04-4000-a000-000000000001', 80, true),
  ('d0d0d0d0-1001-4000-a000-000000000005', 'd0d0d0d0-0a02-4000-a000-000000000003', 'd0d0d0d0-ae04-4000-a000-000000000001', 90, true),
  ('d0d0d0d0-1001-4000-a000-000000000006', 'd0d0d0d0-0a03-4000-a000-000000000001', 'd0d0d0d0-ae06-4000-a000-000000000001', 410, true),
  ('d0d0d0d0-1001-4000-a000-000000000007', 'd0d0d0d0-0a03-4000-a000-000000000002', 'd0d0d0d0-ae06-4000-a000-000000000001', 430, true)
ON CONFLICT (id) DO NOTHING;

-- 8. Supply cycles (no area_ids column)
INSERT INTO public.unlock_cycles (id, name, status, subcategory_id, start_date, end_date, is_example) VALUES
  ('cccccccc-0002-4000-a000-000000000001', 'Q3 2026 – Ready Mix Central', 'planned', 'd0d0d0d0-5b01-4000-a000-000000000001', '2026-07-01', '2026-09-30', true),
  ('cccccccc-0003-4000-a000-000000000001', 'Q3 2026 – Sand Supply', 'planned', 'd0d0d0d0-5b02-4000-a000-000000000001', '2026-07-01', '2026-09-30', true),
  ('cccccccc-0004-4000-a000-000000000001', 'Q1 2026 – Cement Procurement', 'completed', 'd0d0d0d0-5b03-4000-a000-000000000001', '2026-01-01', '2026-03-31', true),
  ('cccccccc-0005-4000-a000-000000000001', 'Q2 2026 – Blocks North', 'active', 'ee074bee-16e6-45dc-b143-196e45d5a965', '2026-04-01', '2026-06-30', true)
ON CONFLICT (id) DO NOTHING;

-- 9. Cycle materials
INSERT INTO public.unlock_cycle_materials (id, cycle_id, material_id, status) VALUES
  ('d0d0d0d0-cc01-4000-a000-000000000001', 'cccccccc-0002-4000-a000-000000000001', 'd0d0d0d0-0a01-4000-a000-000000000001', 'pending'),
  ('d0d0d0d0-cc01-4000-a000-000000000002', 'cccccccc-0002-4000-a000-000000000001', 'd0d0d0d0-0a01-4000-a000-000000000002', 'pending'),
  ('d0d0d0d0-cc01-4000-a000-000000000003', 'cccccccc-0002-4000-a000-000000000001', 'd0d0d0d0-0a01-4000-a000-000000000003', 'pending'),
  ('d0d0d0d0-cc01-4000-a000-000000000004', 'cccccccc-0002-4000-a000-000000000001', 'd0d0d0d0-0a01-4000-a000-000000000007', 'pending'),
  ('d0d0d0d0-cc02-4000-a000-000000000001', 'cccccccc-0003-4000-a000-000000000001', 'd0d0d0d0-0a02-4000-a000-000000000001', 'pending'),
  ('d0d0d0d0-cc02-4000-a000-000000000002', 'cccccccc-0003-4000-a000-000000000001', 'd0d0d0d0-0a02-4000-a000-000000000003', 'pending'),
  ('d0d0d0d0-cc02-4000-a000-000000000003', 'cccccccc-0003-4000-a000-000000000001', 'd0d0d0d0-0a02-4000-a000-000000000005', 'pending'),
  ('d0d0d0d0-cc03-4000-a000-000000000001', 'cccccccc-0004-4000-a000-000000000001', 'd0d0d0d0-0a03-4000-a000-000000000001', 'sourced'),
  ('d0d0d0d0-cc03-4000-a000-000000000002', 'cccccccc-0004-4000-a000-000000000001', 'd0d0d0d0-0a03-4000-a000-000000000002', 'sourced'),
  ('d0d0d0d0-cc04-4000-a000-000000000001', 'cccccccc-0005-4000-a000-000000000001', 'b0d5a1d2-23cd-4048-8519-8c824d7350d5', 'sourcing'),
  ('d0d0d0d0-cc04-4000-a000-000000000002', 'cccccccc-0005-4000-a000-000000000001', 'e15f9111-c211-492f-9a0b-616c7ac3bccf', 'sourcing'),
  ('d0d0d0d0-cc04-4000-a000-000000000003', 'cccccccc-0005-4000-a000-000000000001', 'ec359e6f-a2f1-4016-8807-476819dd856b', 'sourcing')
ON CONFLICT (id) DO NOTHING;
