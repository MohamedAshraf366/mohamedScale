
INSERT INTO accounts (id, display_name, display_name_ar, legal_name, status, is_example, code, metadata) VALUES
  ('bbbbbbbb-0001-4000-b000-000000000001', 'Noor Construction Co', 'شركة نور للإنشاء', 'Noor Construction Company LLC', 'active', true, 'CUST-EX-001', '{}'),
  ('bbbbbbbb-0001-4000-b000-000000000002', 'Al-Madinah Builders', 'بناة المدينة', 'Al-Madinah Builders Est.', 'active', true, 'CUST-EX-002', '{}'),
  ('bbbbbbbb-0001-4000-b000-000000000003', 'Saudi Towers Group', 'مجموعة الأبراج السعودية', 'Saudi Towers Group Ltd', 'active', true, 'CUST-EX-003', '{}'),
  ('bbbbbbbb-0001-4000-b000-000000000004', 'Desert Rose Contracting', 'وردة الصحراء للمقاولات', 'Desert Rose Contracting Co', 'active', true, 'CUST-EX-004', '{}'),
  ('bbbbbbbb-0001-4000-b000-000000000005', 'Eastern Province Dev', 'تطوير المنطقة الشرقية', 'Eastern Province Development LLC', 'active', true, 'CUST-EX-005', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO locations (id, region_code, zone_code, address_text, city, country) VALUES
  ('cccccccc-0001-4000-c000-000000000001', 'RYD', 'RYD.01001', 'King Fahd Road, Riyadh', 'Riyadh', 'SA'),
  ('cccccccc-0001-4000-c000-000000000002', 'MDN', NULL, 'Al-Haram District, Madinah', 'Madinah', 'SA'),
  ('cccccccc-0001-4000-c000-000000000003', 'RYD', 'RYD.04001', 'Olaya Street, Riyadh', 'Riyadh', 'SA'),
  ('cccccccc-0001-4000-c000-000000000004', 'JZN', NULL, 'Industrial Area, Jazan', 'Jazan', 'SA'),
  ('cccccccc-0001-4000-c000-000000000005', 'EAS', NULL, 'Corniche Road, Dammam', 'Dammam', 'SA')
ON CONFLICT (id) DO NOTHING;

UPDATE accounts SET location_id = 'cccccccc-0001-4000-c000-000000000001' WHERE id = 'bbbbbbbb-0001-4000-b000-000000000001';
UPDATE accounts SET location_id = 'cccccccc-0001-4000-c000-000000000002' WHERE id = 'bbbbbbbb-0001-4000-b000-000000000002';
UPDATE accounts SET location_id = 'cccccccc-0001-4000-c000-000000000003' WHERE id = 'bbbbbbbb-0001-4000-b000-000000000003';
UPDATE accounts SET location_id = 'cccccccc-0001-4000-c000-000000000004' WHERE id = 'bbbbbbbb-0001-4000-b000-000000000004';
UPDATE accounts SET location_id = 'cccccccc-0001-4000-c000-000000000005' WHERE id = 'bbbbbbbb-0001-4000-b000-000000000005';

INSERT INTO customers (account_id, customer_type, lifecycle_stage, payment_terms_days, pricing_tier, metadata) VALUES
  ('bbbbbbbb-0001-4000-b000-000000000001', 'SME', 'active', 30, 'standard', '{}'),
  ('bbbbbbbb-0001-4000-b000-000000000002', 'Enterprise', 'active', 45, 'premium', '{}'),
  ('bbbbbbbb-0001-4000-b000-000000000003', 'Enterprise', 'lead', 60, 'premium', '{}'),
  ('bbbbbbbb-0001-4000-b000-000000000004', 'SME', 'prospect', 30, 'standard', '{}'),
  ('bbbbbbbb-0001-4000-b000-000000000005', 'Government', 'active', 90, 'enterprise', '{}')
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO contacts (id, account_id, full_name, full_name_ar, role_title, phone, email, is_primary) VALUES
  ('dddddddd-0001-4000-d000-000000000001', 'bbbbbbbb-0001-4000-b000-000000000001', 'Ahmed Al-Rashid', 'أحمد الرشيد', 'Procurement Manager', '+966501234001', 'ahmed@noor-const.example', true),
  ('dddddddd-0001-4000-d000-000000000002', 'bbbbbbbb-0001-4000-b000-000000000001', 'Fatima Hassan', 'فاطمة حسن', 'Project Engineer', '+966501234002', 'fatima@noor-const.example', false),
  ('dddddddd-0001-4000-d000-000000000003', 'bbbbbbbb-0001-4000-b000-000000000002', 'Khalid Al-Otaibi', 'خالد العتيبي', 'CEO', '+966501234003', 'khalid@madinah-builders.example', true),
  ('dddddddd-0001-4000-d000-000000000004', 'bbbbbbbb-0001-4000-b000-000000000003', 'Saeed Al-Ghamdi', 'سعيد الغامدي', 'VP Operations', '+966501234004', 'saeed@saudi-towers.example', true),
  ('dddddddd-0001-4000-d000-000000000005', 'bbbbbbbb-0001-4000-b000-000000000004', 'Mona Al-Zahrani', 'منى الزهراني', 'Site Manager', '+966501234005', 'mona@desert-rose.example', true),
  ('dddddddd-0001-4000-d000-000000000006', 'bbbbbbbb-0001-4000-b000-000000000005', 'Omar Bukhari', 'عمر البخاري', 'Government Liaison', '+966501234006', 'omar@ep-dev.example', true)
ON CONFLICT (id) DO NOTHING;

UPDATE accounts SET poc_contact_id = 'dddddddd-0001-4000-d000-000000000001' WHERE id = 'bbbbbbbb-0001-4000-b000-000000000001';
UPDATE accounts SET poc_contact_id = 'dddddddd-0001-4000-d000-000000000003' WHERE id = 'bbbbbbbb-0001-4000-b000-000000000002';
UPDATE accounts SET poc_contact_id = 'dddddddd-0001-4000-d000-000000000004' WHERE id = 'bbbbbbbb-0001-4000-b000-000000000003';
UPDATE accounts SET poc_contact_id = 'dddddddd-0001-4000-d000-000000000005' WHERE id = 'bbbbbbbb-0001-4000-b000-000000000004';
UPDATE accounts SET poc_contact_id = 'dddddddd-0001-4000-d000-000000000006' WHERE id = 'bbbbbbbb-0001-4000-b000-000000000005';

INSERT INTO projects (id, customer_account_id, name, name_ar, code, location_id, current_phase, project_size, project_type, metadata) VALUES
  ('eeeeeeee-0001-4000-e000-000000000001', 'bbbbbbbb-0001-4000-b000-000000000001', 'Noor Villa Complex Phase 1', 'مجمع فلل نور المرحلة 1', 'PRJ-EX-001', 'cccccccc-0001-4000-c000-000000000001', 'construction', 'medium', 'residential', '{}'),
  ('eeeeeeee-0001-4000-e000-000000000002', 'bbbbbbbb-0001-4000-b000-000000000001', 'Noor Commercial Tower', 'برج نور التجاري', 'PRJ-EX-002', 'cccccccc-0001-4000-c000-000000000001', 'planning', 'large', 'commercial', '{}'),
  ('eeeeeeee-0001-4000-e000-000000000003', 'bbbbbbbb-0001-4000-b000-000000000002', 'Madinah Knowledge Hub', 'مركز المدينة المعرفي', 'PRJ-EX-003', 'cccccccc-0001-4000-c000-000000000002', 'construction', 'large', 'commercial', '{}'),
  ('eeeeeeee-0001-4000-e000-000000000004', 'bbbbbbbb-0001-4000-b000-000000000003', 'Riyadh Sky Residences', 'سكاي ريزيدنس الرياض', 'PRJ-EX-004', 'cccccccc-0001-4000-c000-000000000003', 'design', 'large', 'residential', '{}'),
  ('eeeeeeee-0001-4000-e000-000000000005', 'bbbbbbbb-0001-4000-b000-000000000004', 'Jazan Warehouse Expansion', 'توسعة مستودع جازان', 'PRJ-EX-005', 'cccccccc-0001-4000-c000-000000000004', 'tender', 'small', 'industrial', '{}'),
  ('eeeeeeee-0001-4000-e000-000000000006', 'bbbbbbbb-0001-4000-b000-000000000005', 'EP Government Campus', 'حرم حكومي المنطقة الشرقية', 'PRJ-EX-006', 'cccccccc-0001-4000-c000-000000000005', 'construction', 'large', 'government', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO opportunities (id, customer_account_id, project_id, title, description, stage, status, priority, source, expected_close_date, contact_id, materials_interest, metadata, code) VALUES
  ('ffffffff-0001-4000-f000-000000000001', 'bbbbbbbb-0001-4000-b000-000000000001', 'eeeeeeee-0001-4000-e000-000000000001', 'Villa Complex Blocks Supply', 'Supply of cement blocks for 24-unit villa complex', 'negotiation', 'active', 'high', 'referral', '2026-05-15', 'dddddddd-0001-4000-d000-000000000001', '["cement blocks","insulated blocks"]', '{}', 'OPP-EX-001'),
  ('ffffffff-0001-4000-f000-000000000002', 'bbbbbbbb-0001-4000-b000-000000000001', 'eeeeeeee-0001-4000-e000-000000000002', 'Commercial Tower Precast', 'Precast elements for tower', 'discovery', 'active', 'medium', 'direct', '2026-07-01', 'dddddddd-0001-4000-d000-000000000002', '["precast panels"]', '{}', 'OPP-EX-002'),
  ('ffffffff-0001-4000-f000-000000000003', 'bbbbbbbb-0001-4000-b000-000000000002', 'eeeeeeee-0001-4000-e000-000000000003', 'Knowledge Hub Full Supply', 'Full materials for education complex', 'rfp', 'active', 'high', 'tender', '2026-06-01', 'dddddddd-0001-4000-d000-000000000003', '["cement blocks","volcanic blocks"]', '{}', 'OPP-EX-003'),
  ('ffffffff-0001-4000-f000-000000000004', 'bbbbbbbb-0001-4000-b000-000000000003', 'eeeeeeee-0001-4000-e000-000000000004', 'Sky Residences Bulk Order', 'Bulk block order for twin towers', 'discovery', 'active', 'high', 'inbound', '2026-08-15', 'dddddddd-0001-4000-d000-000000000004', '["insulated blocks","cement blocks"]', '{}', 'OPP-EX-004'),
  ('ffffffff-0001-4000-f000-000000000005', 'bbbbbbbb-0001-4000-b000-000000000004', 'eeeeeeee-0001-4000-e000-000000000005', 'Warehouse Partition Walls', 'Partition blocks for warehouse', 'rfp', 'active', 'low', 'website', '2026-05-30', 'dddddddd-0001-4000-d000-000000000005', '["cement blocks"]', '{}', 'OPP-EX-005'),
  ('ffffffff-0001-4000-f000-000000000006', 'bbbbbbbb-0001-4000-b000-000000000005', 'eeeeeeee-0001-4000-e000-000000000006', 'Government Campus Phase 1', 'Phase 1 materials', 'won', 'active', 'high', 'government_tender', '2026-04-01', 'dddddddd-0001-4000-d000-000000000006', '["cement blocks","volcanic blocks"]', '{}', 'OPP-EX-006'),
  ('ffffffff-0001-4000-f000-000000000007', 'bbbbbbbb-0001-4000-b000-000000000002', 'eeeeeeee-0001-4000-e000-000000000003', 'Knowledge Hub Phase 2', 'Interior fit-out blocks', 'lost', 'active', 'medium', 'existing_customer', '2026-03-15', 'dddddddd-0001-4000-d000-000000000003', '["lightweight blocks"]', '{}', 'OPP-EX-007')
ON CONFLICT (id) DO NOTHING;

UPDATE opportunities SET won_at = '2026-03-20' WHERE id = 'ffffffff-0001-4000-f000-000000000006';
UPDATE opportunities SET lost_at = '2026-03-10', lost_reason = 'Competitor offered lower price' WHERE id = 'ffffffff-0001-4000-f000-000000000007';

INSERT INTO quotations (id, customer_account_id, project_id, opportunity_id, code, status, currency, subtotal, delivery_total, total, valid_until, version, metadata, quote_type, sent_at, accepted_at) VALUES
  ('11111111-0001-4000-1000-000000000001', 'bbbbbbbb-0001-4000-b000-000000000001', 'eeeeeeee-0001-4000-e000-000000000001', 'ffffffff-0001-4000-f000-000000000001', 'Q-EX-001', 'sent', 'SAR', 85000, 5000, 90000, '2026-05-30', 1, '{}', 'order', '2026-04-01', NULL),
  ('11111111-0001-4000-1000-000000000002', 'bbbbbbbb-0001-4000-b000-000000000002', 'eeeeeeee-0001-4000-e000-000000000003', 'ffffffff-0001-4000-f000-000000000003', 'Q-EX-002', 'draft', 'SAR', 210000, 15000, 225000, '2026-06-15', 1, '{}', 'order', NULL, NULL),
  ('11111111-0001-4000-1000-000000000003', 'bbbbbbbb-0001-4000-b000-000000000005', 'eeeeeeee-0001-4000-e000-000000000006', 'ffffffff-0001-4000-f000-000000000006', 'Q-EX-003', 'accepted', 'SAR', 450000, 25000, 475000, '2026-04-30', 1, '{}', 'order', '2026-03-25', '2026-03-28'),
  ('11111111-0001-4000-1000-000000000004', 'bbbbbbbb-0001-4000-b000-000000000004', 'eeeeeeee-0001-4000-e000-000000000005', 'ffffffff-0001-4000-f000-000000000005', 'Q-EX-004', 'sent', 'SAR', 32000, 3000, 35000, '2026-06-01', 1, '{}', 'order', '2026-04-03', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO quotation_items (id, quotation_id, material_id, quantity, unit_price, delivery_price, line_total, uom, position, metadata) VALUES
  ('22222222-0001-4000-2000-000000000001', '11111111-0001-4000-1000-000000000001', '8aecda02-0121-45a3-ac2d-8b0910668a9a', 5000, 12, 1, 65000, 'block', 1, '{}'),
  ('22222222-0001-4000-2000-000000000002', '11111111-0001-4000-1000-000000000001', '0c25dfb2-bd13-445a-9b93-e0ab664ad874', 2000, 10, 1, 22000, 'block', 2, '{}'),
  ('22222222-0001-4000-2000-000000000003', '11111111-0001-4000-1000-000000000002', '44d34792-2275-4811-b05d-5361d04ba35f', 10000, 15, 1.5, 165000, 'block', 1, '{}'),
  ('22222222-0001-4000-2000-000000000004', '11111111-0001-4000-1000-000000000002', 'cbfbd726-0ecf-473e-ade9-4ceebfa75d06', 3000, 14, 1.5, 46500, 'block', 2, '{}'),
  ('22222222-0001-4000-2000-000000000005', '11111111-0001-4000-1000-000000000003', '8aecda02-0121-45a3-ac2d-8b0910668a9a', 20000, 11.5, 1.25, 255000, 'block', 1, '{}'),
  ('22222222-0001-4000-2000-000000000006', '11111111-0001-4000-1000-000000000003', '1524d5a5-4d79-4b57-b59b-2a770640caed', 10000, 13, 1.5, 145000, 'block', 2, '{}'),
  ('22222222-0001-4000-2000-000000000007', '11111111-0001-4000-1000-000000000004', '5e74896d-dd89-470e-96e0-a9da441a9819', 3000, 9, 1, 30000, 'block', 1, '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO orders (id, customer_account_id, project_id, quotation_id, code, status, currency, subtotal, delivery_total, total, notes) VALUES
  ('33333333-0001-4000-3000-000000000001', 'bbbbbbbb-0001-4000-b000-000000000005', 'eeeeeeee-0001-4000-e000-000000000006', '11111111-0001-4000-1000-000000000003', 'ORD-EX-001', 'confirmed', 'SAR', 450000, 25000, 475000, 'Government campus phase 1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (id, order_id, material_id, quantity, unit_price, delivery_price, line_total, uom) VALUES
  ('44444444-0001-4000-4000-000000000001', '33333333-0001-4000-3000-000000000001', '8aecda02-0121-45a3-ac2d-8b0910668a9a', 20000, 11.5, 1.25, 255000, 'block'),
  ('44444444-0001-4000-4000-000000000002', '33333333-0001-4000-3000-000000000001', '1524d5a5-4d79-4b57-b59b-2a770640caed', 10000, 13, 1.5, 145000, 'block')
ON CONFLICT (id) DO NOTHING;

-- channels: whatsapp, call, meeting, email, sms, in_person, site_visit, other, internal
INSERT INTO communications (id, account_id, contact_id, project_id, opportunity_id, channel, direction, subject, summary, raw_notes, occurred_at, sentiment, outcome) VALUES
  ('55555555-0001-4000-5000-000000000001', 'bbbbbbbb-0001-4000-b000-000000000001', 'dddddddd-0001-4000-d000-000000000001', 'eeeeeeee-0001-4000-e000-000000000001', 'ffffffff-0001-4000-f000-000000000001', 'call', 'outbound', 'Quote follow-up', 'Discussed villa complex pricing', 'Called Ahmed re Q-EX-001', now()-interval '5 days', 'positive', 'follow_up_scheduled'),
  ('55555555-0001-4000-5000-000000000002', 'bbbbbbbb-0001-4000-b000-000000000001', 'dddddddd-0001-4000-d000-000000000002', 'eeeeeeee-0001-4000-e000-000000000002', 'ffffffff-0001-4000-f000-000000000002', 'email', 'inbound', 'Tower specs request', 'Fatima needs datasheets', 'Email from Fatima', now()-interval '3 days', 'neutral', 'information_shared'),
  ('55555555-0001-4000-5000-000000000003', 'bbbbbbbb-0001-4000-b000-000000000002', 'dddddddd-0001-4000-d000-000000000003', 'eeeeeeee-0001-4000-e000-000000000003', 'ffffffff-0001-4000-f000-000000000003', 'site_visit', 'outbound', 'Knowledge Hub visit', 'Site visit 15k sqm', 'Met Khalid on site', now()-interval '7 days', 'positive', 'proposal_requested'),
  ('55555555-0001-4000-5000-000000000004', 'bbbbbbbb-0001-4000-b000-000000000003', 'dddddddd-0001-4000-d000-000000000004', NULL, 'ffffffff-0001-4000-f000-000000000004', 'whatsapp', 'inbound', 'Sky Residences inquiry', 'Saeed needs 50k blocks', 'WhatsApp from Saeed', now()-interval '2 days', 'positive', 'meeting_scheduled'),
  ('55555555-0001-4000-5000-000000000005', 'bbbbbbbb-0001-4000-b000-000000000005', 'dddddddd-0001-4000-d000-000000000006', 'eeeeeeee-0001-4000-e000-000000000006', 'ffffffff-0001-4000-f000-000000000006', 'call', 'outbound', 'Order confirmed', 'Omar confirmed ORD-EX-001', 'PO received', now()-interval '1 day', 'positive', 'order_confirmed'),
  ('55555555-0001-4000-5000-000000000006', 'bbbbbbbb-0001-4000-b000-000000000004', 'dddddddd-0001-4000-d000-000000000005', 'eeeeeeee-0001-4000-e000-000000000005', 'ffffffff-0001-4000-f000-000000000005', 'email', 'outbound', 'Warehouse quote sent', 'Sent Q-EX-004', 'Emailed Mona', now()-interval '4 days', 'neutral', 'quote_sent')
ON CONFLICT (id) DO NOTHING;

INSERT INTO communication_action_items (id, communication_id, title, details, status, priority, due_at) VALUES
  ('66666666-0001-4000-6000-000000000001', '55555555-0001-4000-5000-000000000001', 'Follow up bulk discount', '5% discount request', 'open', 'high', now()+interval '2 days'),
  ('66666666-0001-4000-6000-000000000002', '55555555-0001-4000-5000-000000000002', 'Send datasheets', 'Block specs for tower', 'open', 'medium', now()+interval '1 day'),
  ('66666666-0001-4000-6000-000000000003', '55555555-0001-4000-5000-000000000003', 'Prepare KH proposal', 'Site visit proposal', 'open', 'high', now()+interval '5 days'),
  ('66666666-0001-4000-6000-000000000004', '55555555-0001-4000-5000-000000000004', 'Schedule ST meeting', 'Sky Residences meeting', 'open', 'high', now()+interval '3 days'),
  ('66666666-0001-4000-6000-000000000005', '55555555-0001-4000-5000-000000000005', 'Coordinate delivery', 'First batch Apr 20', 'open', 'high', now()+interval '13 days'),
  ('66666666-0001-4000-6000-000000000006', '55555555-0001-4000-5000-000000000006', 'Follow up Desert Rose', 'Call re Q-EX-004', 'open', 'low', now()+interval '7 days'),
  ('66666666-0001-4000-6000-000000000007', '55555555-0001-4000-5000-000000000003', 'Get volcanic pricing', 'Al-Bina Factory quote', 'open', 'medium', now()+interval '2 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO invoices (id, customer_account_id, order_id, quotation_id, code, invoice_number, status, currency, subtotal, tax_total, total, issued_at, due_at) VALUES
  ('77777777-0001-4000-7000-000000000001', 'bbbbbbbb-0001-4000-b000-000000000005', '33333333-0001-4000-3000-000000000001', '11111111-0001-4000-1000-000000000003', 'INV-EX-001', 'INV-2026-001', 'issued', 'SAR', 475000, 71250, 546250, now()-interval '1 day', now()+interval '89 days')
ON CONFLICT (id) DO NOTHING;
