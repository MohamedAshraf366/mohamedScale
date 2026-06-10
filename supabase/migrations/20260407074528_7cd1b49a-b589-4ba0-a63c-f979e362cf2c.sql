
INSERT INTO accounts (id, display_name, display_name_ar, status, code, is_example) VALUES
  ('aaaaaaaa-0001-4000-a000-000000000001','Al-Bina Factory','مصنع البناء','active','EX-SUP-001',true),
  ('aaaaaaaa-0001-4000-a000-000000000002','Gulf Blocks Premium','بلوك الخليج المتميز','active','EX-SUP-002',true),
  ('aaaaaaaa-0001-4000-a000-000000000003','Riyadh Building Co','شركة الرياض للبناء','active','EX-SUP-003',true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO suppliers (account_id, supplier_type, supplier_code, rating_price, rating_quality, rating_delivery) VALUES
  ('aaaaaaaa-0001-4000-a000-000000000001','manufacturer','EX-S1',5,3,4),
  ('aaaaaaaa-0001-4000-a000-000000000002','manufacturer','EX-S2',2,5,5),
  ('aaaaaaaa-0001-4000-a000-000000000003','manufacturer','EX-S3',3,4,3)
ON CONFLICT (account_id) DO NOTHING;

UPDATE materials SET is_core = true WHERE id IN (
  'b0d5a1d2-23cd-4048-8519-8c824d7350d5','e15f9111-c211-492f-9a0b-616c7ac3bccf',
  'ec359e6f-a2f1-4016-8807-476819dd856b','0c25dfb2-bd13-445a-9b93-e0ab664ad874',
  'd68c93c4-3f2b-45a3-bc1c-9d0b4aecb833','d0dfdd1d-b763-4fe6-b78e-5e82e60069ac',
  'cbfbd726-0ecf-473e-ade9-4ceebfa75d06','1524d5a5-4d79-4b57-b59b-2a770640caed');

INSERT INTO unlock_cycles (id, name, description, status, start_date, end_date, subcategory_id, scope_filter, zone_codes, zone_group_ids, is_example) VALUES (
  'cccccccc-0001-4000-a000-000000000001','Q2 2026 – Cement Blocks Riyadh','Quarterly supply cycle covering all core cement block variants across Riyadh Area 1 and Area 2',
  'active','2026-04-01','2026-06-30','ee074bee-16e6-45dc-b143-196e45d5a965','{}',
  ARRAY['RYD.11138','RYD.11043','RYD.11141','RYD.11048','RYD.11001','RYD.11004','RYD.11006','RYD.11008'],
  ARRAY['f4ef9926-a6de-463a-a560-34bb4dc9b3e2','b015bc49-ae3c-4b37-aa4e-006a9309a90a']::uuid[],true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO unlock_cycle_materials (id, cycle_id, material_id, status, is_example)
SELECT gen_random_uuid(),'cccccccc-0001-4000-a000-000000000001',m.id,'active',true
FROM unnest(ARRAY['b0d5a1d2-23cd-4048-8519-8c824d7350d5','e15f9111-c211-492f-9a0b-616c7ac3bccf','ec359e6f-a2f1-4016-8807-476819dd856b','0c25dfb2-bd13-445a-9b93-e0ab664ad874','d68c93c4-3f2b-45a3-bc1c-9d0b4aecb833','d0dfdd1d-b763-4fe6-b78e-5e82e60069ac','cbfbd726-0ecf-473e-ade9-4ceebfa75d06','1524d5a5-4d79-4b57-b59b-2a770640caed']::uuid[]) AS m(id);

INSERT INTO supply_units (id, cycle_id, material_id, zone_code, area_id, status, is_example)
SELECT gen_random_uuid(),'cccccccc-0001-4000-a000-000000000001',m.id,z.code,
  CASE WHEN z.code IN ('RYD.11138','RYD.11043') THEN 'f4ef9926-a6de-463a-a560-34bb4dc9b3e2'::uuid ELSE 'b015bc49-ae3c-4b37-aa4e-006a9309a90a'::uuid END,
  'active',true
FROM unnest(ARRAY['b0d5a1d2-23cd-4048-8519-8c824d7350d5','e15f9111-c211-492f-9a0b-616c7ac3bccf','ec359e6f-a2f1-4016-8807-476819dd856b','0c25dfb2-bd13-445a-9b93-e0ab664ad874','d68c93c4-3f2b-45a3-bc1c-9d0b4aecb833','d0dfdd1d-b763-4fe6-b78e-5e82e60069ac','cbfbd726-0ecf-473e-ade9-4ceebfa75d06','1524d5a5-4d79-4b57-b59b-2a770640caed']::uuid[]) AS m(id)
CROSS JOIN (SELECT unnest(ARRAY['RYD.11138','RYD.11043','RYD.11001','RYD.11004']) AS code) AS z;

INSERT INTO supplier_quotes (id, supplier_account_id, status, source, submitted_at, valid_until, is_example) VALUES
  ('dddddddd-0001-4000-a000-000000000001','aaaaaaaa-0001-4000-a000-000000000001','approved','direct','2026-03-15','2026-06-30',true),
  ('dddddddd-0001-4000-a000-000000000002','aaaaaaaa-0001-4000-a000-000000000002','approved','direct','2026-03-16','2026-06-30',true),
  ('dddddddd-0001-4000-a000-000000000003','aaaaaaaa-0001-4000-a000-000000000003','submitted','direct','2026-03-18','2026-06-30',true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO supplier_materials (id, supplier_account_id, material_id, unit_price, moq, lead_time_days, is_current, supplier_quote_id, status, is_example) VALUES
  ('eeeeeee1-0001-4000-a000-000000000001','aaaaaaaa-0001-4000-a000-000000000001','b0d5a1d2-23cd-4048-8519-8c824d7350d5',2.50,500,3,true,'dddddddd-0001-4000-a000-000000000001','approved',true),
  ('eeeeeee1-0001-4000-a000-000000000002','aaaaaaaa-0001-4000-a000-000000000001','e15f9111-c211-492f-9a0b-616c7ac3bccf',2.80,500,3,true,'dddddddd-0001-4000-a000-000000000001','approved',true),
  ('eeeeeee1-0001-4000-a000-000000000003','aaaaaaaa-0001-4000-a000-000000000001','ec359e6f-a2f1-4016-8807-476819dd856b',3.20,500,3,true,'dddddddd-0001-4000-a000-000000000001','approved',true),
  ('eeeeeee1-0001-4000-a000-000000000004','aaaaaaaa-0001-4000-a000-000000000001','0c25dfb2-bd13-445a-9b93-e0ab664ad874',2.70,500,3,true,'dddddddd-0001-4000-a000-000000000001','approved',true),
  ('eeeeeee1-0001-4000-a000-000000000005','aaaaaaaa-0001-4000-a000-000000000001','d68c93c4-3f2b-45a3-bc1c-9d0b4aecb833',3.00,500,3,true,'dddddddd-0001-4000-a000-000000000001','approved',true),
  ('eeeeeee1-0001-4000-a000-000000000006','aaaaaaaa-0001-4000-a000-000000000001','d0dfdd1d-b763-4fe6-b78e-5e82e60069ac',3.50,500,3,true,'dddddddd-0001-4000-a000-000000000001','approved',true),
  ('eeeeeee1-0001-4000-a000-000000000007','aaaaaaaa-0001-4000-a000-000000000001','cbfbd726-0ecf-473e-ade9-4ceebfa75d06',2.60,500,3,true,'dddddddd-0001-4000-a000-000000000001','approved',true),
  ('eeeeeee1-0001-4000-a000-000000000008','aaaaaaaa-0001-4000-a000-000000000001','1524d5a5-4d79-4b57-b59b-2a770640caed',2.90,500,3,true,'dddddddd-0001-4000-a000-000000000001','approved',true),
  ('eeeeeee2-0001-4000-a000-000000000001','aaaaaaaa-0001-4000-a000-000000000002','b0d5a1d2-23cd-4048-8519-8c824d7350d5',3.50,300,2,true,'dddddddd-0001-4000-a000-000000000002','approved',true),
  ('eeeeeee2-0001-4000-a000-000000000002','aaaaaaaa-0001-4000-a000-000000000002','e15f9111-c211-492f-9a0b-616c7ac3bccf',3.80,300,2,true,'dddddddd-0001-4000-a000-000000000002','approved',true),
  ('eeeeeee2-0001-4000-a000-000000000003','aaaaaaaa-0001-4000-a000-000000000002','ec359e6f-a2f1-4016-8807-476819dd856b',4.30,300,2,true,'dddddddd-0001-4000-a000-000000000002','approved',true),
  ('eeeeeee2-0001-4000-a000-000000000004','aaaaaaaa-0001-4000-a000-000000000002','0c25dfb2-bd13-445a-9b93-e0ab664ad874',3.70,300,2,true,'dddddddd-0001-4000-a000-000000000002','approved',true),
  ('eeeeeee2-0001-4000-a000-000000000005','aaaaaaaa-0001-4000-a000-000000000002','d68c93c4-3f2b-45a3-bc1c-9d0b4aecb833',4.00,300,2,true,'dddddddd-0001-4000-a000-000000000002','approved',true),
  ('eeeeeee2-0001-4000-a000-000000000006','aaaaaaaa-0001-4000-a000-000000000002','d0dfdd1d-b763-4fe6-b78e-5e82e60069ac',4.80,300,2,true,'dddddddd-0001-4000-a000-000000000002','approved',true),
  ('eeeeeee2-0001-4000-a000-000000000007','aaaaaaaa-0001-4000-a000-000000000002','cbfbd726-0ecf-473e-ade9-4ceebfa75d06',3.60,300,2,true,'dddddddd-0001-4000-a000-000000000002','approved',true),
  ('eeeeeee2-0001-4000-a000-000000000008','aaaaaaaa-0001-4000-a000-000000000002','1524d5a5-4d79-4b57-b59b-2a770640caed',3.90,300,2,true,'dddddddd-0001-4000-a000-000000000002','approved',true),
  ('eeeeeee3-0001-4000-a000-000000000001','aaaaaaaa-0001-4000-a000-000000000003','b0d5a1d2-23cd-4048-8519-8c824d7350d5',3.00,400,4,true,'dddddddd-0001-4000-a000-000000000003','quoted',true),
  ('eeeeeee3-0001-4000-a000-000000000002','aaaaaaaa-0001-4000-a000-000000000003','e15f9111-c211-492f-9a0b-616c7ac3bccf',3.30,400,4,true,'dddddddd-0001-4000-a000-000000000003','quoted',true),
  ('eeeeeee3-0001-4000-a000-000000000003','aaaaaaaa-0001-4000-a000-000000000003','ec359e6f-a2f1-4016-8807-476819dd856b',3.80,400,4,true,'dddddddd-0001-4000-a000-000000000003','quoted',true),
  ('eeeeeee3-0001-4000-a000-000000000004','aaaaaaaa-0001-4000-a000-000000000003','0c25dfb2-bd13-445a-9b93-e0ab664ad874',3.20,400,4,true,'dddddddd-0001-4000-a000-000000000003','quoted',true),
  ('eeeeeee3-0001-4000-a000-000000000005','aaaaaaaa-0001-4000-a000-000000000003','d68c93c4-3f2b-45a3-bc1c-9d0b4aecb833',3.50,400,4,true,'dddddddd-0001-4000-a000-000000000003','quoted',true),
  ('eeeeeee3-0001-4000-a000-000000000006','aaaaaaaa-0001-4000-a000-000000000003','d0dfdd1d-b763-4fe6-b78e-5e82e60069ac',4.20,400,4,true,'dddddddd-0001-4000-a000-000000000003','quoted',true),
  ('eeeeeee3-0001-4000-a000-000000000007','aaaaaaaa-0001-4000-a000-000000000003','cbfbd726-0ecf-473e-ade9-4ceebfa75d06',3.10,400,4,true,'dddddddd-0001-4000-a000-000000000003','quoted',true),
  ('eeeeeee3-0001-4000-a000-000000000008','aaaaaaaa-0001-4000-a000-000000000003','1524d5a5-4d79-4b57-b59b-2a770640caed',3.40,400,4,true,'dddddddd-0001-4000-a000-000000000003','quoted',true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO delivery_rates (id, supplier_account_id, price_per_moq, zone_codes, is_default, is_example) VALUES
  ('ffffffff-0001-4000-a000-000000000001','aaaaaaaa-0001-4000-a000-000000000001',0.30,ARRAY['RYD.11138','RYD.11043','RYD.11001','RYD.11004'],true,true),
  ('ffffffff-0001-4000-a000-000000000002','aaaaaaaa-0001-4000-a000-000000000002',0.50,ARRAY['RYD.11138','RYD.11043','RYD.11001','RYD.11004'],true,true),
  ('ffffffff-0001-4000-a000-000000000003','aaaaaaaa-0001-4000-a000-000000000003',0.40,ARRAY['RYD.11138','RYD.11043','RYD.11001','RYD.11004'],true,true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO target_prices (id, material_id, area_id, zone_codes, target_price, currency, is_example) VALUES
  (gen_random_uuid(),'b0d5a1d2-23cd-4048-8519-8c824d7350d5','f4ef9926-a6de-463a-a560-34bb4dc9b3e2',ARRAY['RYD.11138','RYD.11043'],2.80,'SAR',true),
  (gen_random_uuid(),'e15f9111-c211-492f-9a0b-616c7ac3bccf','f4ef9926-a6de-463a-a560-34bb4dc9b3e2',ARRAY['RYD.11138','RYD.11043'],3.10,'SAR',true),
  (gen_random_uuid(),'ec359e6f-a2f1-4016-8807-476819dd856b','f4ef9926-a6de-463a-a560-34bb4dc9b3e2',ARRAY['RYD.11138','RYD.11043'],3.50,'SAR',true),
  (gen_random_uuid(),'0c25dfb2-bd13-445a-9b93-e0ab664ad874','f4ef9926-a6de-463a-a560-34bb4dc9b3e2',ARRAY['RYD.11138','RYD.11043'],3.00,'SAR',true),
  (gen_random_uuid(),'d68c93c4-3f2b-45a3-bc1c-9d0b4aecb833','f4ef9926-a6de-463a-a560-34bb4dc9b3e2',ARRAY['RYD.11138','RYD.11043'],3.30,'SAR',true),
  (gen_random_uuid(),'d0dfdd1d-b763-4fe6-b78e-5e82e60069ac','f4ef9926-a6de-463a-a560-34bb4dc9b3e2',ARRAY['RYD.11138','RYD.11043'],3.80,'SAR',true),
  (gen_random_uuid(),'cbfbd726-0ecf-473e-ade9-4ceebfa75d06','f4ef9926-a6de-463a-a560-34bb4dc9b3e2',ARRAY['RYD.11138','RYD.11043'],2.90,'SAR',true),
  (gen_random_uuid(),'1524d5a5-4d79-4b57-b59b-2a770640caed','f4ef9926-a6de-463a-a560-34bb4dc9b3e2',ARRAY['RYD.11138','RYD.11043'],3.20,'SAR',true),
  (gen_random_uuid(),'b0d5a1d2-23cd-4048-8519-8c824d7350d5','b015bc49-ae3c-4b37-aa4e-006a9309a90a',ARRAY['RYD.11001','RYD.11004'],2.80,'SAR',true),
  (gen_random_uuid(),'e15f9111-c211-492f-9a0b-616c7ac3bccf','b015bc49-ae3c-4b37-aa4e-006a9309a90a',ARRAY['RYD.11001','RYD.11004'],3.10,'SAR',true),
  (gen_random_uuid(),'ec359e6f-a2f1-4016-8807-476819dd856b','b015bc49-ae3c-4b37-aa4e-006a9309a90a',ARRAY['RYD.11001','RYD.11004'],3.50,'SAR',true),
  (gen_random_uuid(),'0c25dfb2-bd13-445a-9b93-e0ab664ad874','b015bc49-ae3c-4b37-aa4e-006a9309a90a',ARRAY['RYD.11001','RYD.11004'],3.00,'SAR',true),
  (gen_random_uuid(),'d68c93c4-3f2b-45a3-bc1c-9d0b4aecb833','b015bc49-ae3c-4b37-aa4e-006a9309a90a',ARRAY['RYD.11001','RYD.11004'],3.30,'SAR',true),
  (gen_random_uuid(),'d0dfdd1d-b763-4fe6-b78e-5e82e60069ac','b015bc49-ae3c-4b37-aa4e-006a9309a90a',ARRAY['RYD.11001','RYD.11004'],3.80,'SAR',true),
  (gen_random_uuid(),'cbfbd726-0ecf-473e-ade9-4ceebfa75d06','b015bc49-ae3c-4b37-aa4e-006a9309a90a',ARRAY['RYD.11001','RYD.11004'],2.90,'SAR',true),
  (gen_random_uuid(),'1524d5a5-4d79-4b57-b59b-2a770640caed','b015bc49-ae3c-4b37-aa4e-006a9309a90a',ARRAY['RYD.11001','RYD.11004'],3.20,'SAR',true);

INSERT INTO supply_unit_suppliers (id, supply_unit_id, supplier_account_id, supplier_material_id, role, rank, landed_price, is_quality_pick, is_example)
SELECT gen_random_uuid(),su.id,'aaaaaaaa-0001-4000-a000-000000000001',
  (SELECT sm.id FROM supplier_materials sm WHERE sm.supplier_account_id='aaaaaaaa-0001-4000-a000-000000000001' AND sm.material_id=su.material_id AND sm.is_example=true LIMIT 1),
  'selected',1,(SELECT sm.unit_price+0.30 FROM supplier_materials sm WHERE sm.supplier_account_id='aaaaaaaa-0001-4000-a000-000000000001' AND sm.material_id=su.material_id AND sm.is_example=true LIMIT 1),false,true
FROM supply_units su WHERE su.cycle_id='cccccccc-0001-4000-a000-000000000001' AND su.is_example=true;

INSERT INTO supply_unit_suppliers (id, supply_unit_id, supplier_account_id, supplier_material_id, role, rank, landed_price, is_quality_pick, is_example)
SELECT gen_random_uuid(),su.id,'aaaaaaaa-0001-4000-a000-000000000002',
  (SELECT sm.id FROM supplier_materials sm WHERE sm.supplier_account_id='aaaaaaaa-0001-4000-a000-000000000002' AND sm.material_id=su.material_id AND sm.is_example=true LIMIT 1),
  'backup',2,(SELECT sm.unit_price+0.50 FROM supplier_materials sm WHERE sm.supplier_account_id='aaaaaaaa-0001-4000-a000-000000000002' AND sm.material_id=su.material_id AND sm.is_example=true LIMIT 1),true,true
FROM supply_units su WHERE su.cycle_id='cccccccc-0001-4000-a000-000000000001' AND su.is_example=true;

INSERT INTO supply_unit_suppliers (id, supply_unit_id, supplier_account_id, supplier_material_id, role, rank, landed_price, is_quality_pick, is_example)
SELECT gen_random_uuid(),su.id,'aaaaaaaa-0001-4000-a000-000000000003',
  (SELECT sm.id FROM supplier_materials sm WHERE sm.supplier_account_id='aaaaaaaa-0001-4000-a000-000000000003' AND sm.material_id=su.material_id AND sm.is_example=true LIMIT 1),
  'candidate',3,(SELECT sm.unit_price+0.40 FROM supplier_materials sm WHERE sm.supplier_account_id='aaaaaaaa-0001-4000-a000-000000000003' AND sm.material_id=su.material_id AND sm.is_example=true LIMIT 1),false,true
FROM supply_units su WHERE su.cycle_id='cccccccc-0001-4000-a000-000000000001' AND su.is_example=true;
