
-- ============================================================
-- SEED: Realistic Sales Demo Data  
-- ============================================================

-- New Accounts + Customers
INSERT INTO accounts (id, display_name, legal_name, status, created_at) VALUES
  ('d2000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'National Housing Co.', 'National Housing Company LLC', 'active', '2025-10-15 09:00:00+00'),
  ('d2000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Riyadh Metro Contractors', 'Riyadh Metro Contractors Ltd', 'active', '2025-11-20 09:00:00+00'),
  ('d2000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Al Madinah Developers', 'Al Madinah Real Estate Dev.', 'active', '2025-12-05 09:00:00+00'),
  ('d2000004-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Jeddah Tower Materials', 'Jeddah Tower Materials Trading', 'active', '2026-01-10 09:00:00+00'),
  ('d2000005-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Eastern Province Builders', 'EP Builders Est.', 'active', '2026-02-01 09:00:00+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO customers (account_id, lifecycle_stage, customer_type) VALUES
  ('d2000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'active', 'Enterprise'),
  ('d2000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'active', 'Enterprise'),
  ('d2000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'active', 'SME'),
  ('d2000004-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'lead', 'SME'),
  ('d2000005-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'lead', 'SME')
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO contacts (id, account_id, full_name, phone, is_primary) VALUES
  ('e3000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Ahmed Al-Harbi', '+966501234567', true),
  ('e3000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Fahad Al-Otaibi', '+966502345678', true),
  ('e3000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Nasser Al-Ghamdi', '+966503456789', true),
  ('e3000004-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000004-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Sultan Al-Zahrani', '+966504567890', true),
  ('e3000005-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000005-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Khalid Al-Dosari', '+966505678901', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, name, customer_account_id, created_at) VALUES
  ('f4000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'King Salman Park Villas', 'd2000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2025-10-20 09:00:00+00'),
  ('f4000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'NHC Affordable Housing Ph.2', 'd2000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2025-12-01 09:00:00+00'),
  ('f4000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Metro Line 3 Stations', 'd2000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2025-11-25 09:00:00+00'),
  ('f4000004-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Al Madinah Mixed-Use Tower', 'd2000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2025-12-15 09:00:00+00'),
  ('f4000005-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Jeddah Waterfront Residences', 'd2000004-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-01-15 09:00:00+00'),
  ('f4000006-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Dammam Industrial Complex', 'd2000005-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-02-03 09:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- Update interest_level on existing opportunities
UPDATE opportunities SET interest_level = 'High' WHERE id = 'a0000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
UPDATE opportunities SET interest_level = 'Medium' WHERE id = 'a0000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
UPDATE opportunities SET interest_level = 'High' WHERE id = 'a0000005-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
UPDATE opportunities SET interest_level = 'Medium' WHERE id = 'a0000004-cccc-4ccc-cccc-cccccccccccc';
UPDATE opportunities SET interest_level = 'Low' WHERE id = 'a0000003-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
UPDATE opportunities SET interest_level = 'Low' WHERE id = 'ae4eb9a1-e8cb-4715-93a1-d32062bf7af7';

-- New opportunities (valid hex UUIDs only)
INSERT INTO opportunities (id, title, customer_account_id, project_id, stage, status, interest_level, created_at, won_at, lost_at, lost_reason) VALUES
  ('a5000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'King Salman Park - Block Supply', 'd2000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'f4000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'won', 'active', 'High', '2025-11-01 09:00:00+00', '2026-01-20 09:00:00+00', NULL, NULL),
  ('a5000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'NHC Ph.2 - Cement & Rebar', 'd2000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'f4000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'won', 'active', 'High', '2025-12-10 09:00:00+00', '2026-01-28 09:00:00+00', NULL, NULL),
  ('a5000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Metro Stations - Steel Supply', 'd2000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'f4000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'won', 'active', 'High', '2025-12-01 09:00:00+00', '2026-02-05 09:00:00+00', NULL, NULL),
  ('a5000004-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Madinah Tower - Full Materials', 'd2000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'f4000004-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'won', 'active', 'Medium', '2025-12-20 09:00:00+00', '2026-02-10 09:00:00+00', NULL, NULL),
  ('a5000005-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Al Malqa Villa - Tiles & Marble', 'c1000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'b1000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'won', 'active', 'High', '2026-01-05 09:00:00+00', '2026-02-12 09:00:00+00', NULL, NULL),
  ('a5000006-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Jeddah Waterfront - Phase 1', 'd2000004-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'f4000005-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'negotiation', 'active', 'High', '2026-01-20 09:00:00+00', NULL, NULL, NULL),
  ('a5000007-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Dammam Industrial - Block Supply', 'd2000005-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'f4000006-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'rfp', 'active', 'Medium', '2026-02-05 09:00:00+00', NULL, NULL, NULL),
  ('a5000008-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'NHC Ph.2 - Finishing Materials', 'd2000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'f4000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'discovery', 'active', 'Medium', '2026-02-08 09:00:00+00', NULL, NULL, NULL),
  ('a5000009-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Metro Line 3 - Concrete Supply', 'd2000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'f4000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'rfp', 'active', 'High', '2026-02-10 09:00:00+00', NULL, NULL, NULL),
  ('a500000a-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Madinah Tower - Interior Fit-out', 'd2000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'f4000004-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'discovery', 'active', 'Low', '2026-02-12 09:00:00+00', NULL, NULL, NULL),
  ('a500000b-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'EP Builders - Insulation Package', 'd2000005-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'f4000006-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'lost', 'active', 'Not interested', '2026-01-15 09:00:00+00', NULL, '2026-02-08 09:00:00+00', 'Price too high');

-- Accepted quotations for won deals
INSERT INTO quotations (id, opportunity_id, customer_account_id, project_id, status, total, subtotal, delivery_total, accepted_at, sent_at, version, is_soft) VALUES
  ('b6000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'a5000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'f4000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'accepted', 185000, 170000, 15000, '2026-01-20 09:00:00+00', '2026-01-18 09:00:00+00', 2, false),
  ('b6000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'a5000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'f4000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'accepted', 320000, 300000, 20000, '2026-01-28 09:00:00+00', '2026-01-25 09:00:00+00', 1, false),
  ('b6000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'a5000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'f4000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'accepted', 450000, 425000, 25000, '2026-02-05 09:00:00+00', '2026-02-03 09:00:00+00', 3, false),
  ('b6000004-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'a5000004-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'f4000004-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'accepted', 275000, 260000, 15000, '2026-02-10 09:00:00+00', '2026-02-08 09:00:00+00', 2, false),
  ('b6000005-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'a5000005-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'c1000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'b1000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'accepted', 92000, 85000, 7000, '2026-02-12 09:00:00+00', '2026-02-11 09:00:00+00', 1, false);

INSERT INTO quotations (id, opportunity_id, customer_account_id, project_id, status, total, subtotal, delivery_total, sent_at, version, is_soft) VALUES
  ('b6000006-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'a5000006-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000004-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'f4000005-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'sent', 210000, 195000, 15000, '2026-02-06 09:00:00+00', 1, false),
  ('b6000007-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'a5000007-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000005-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'f4000006-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'draft', 145000, 135000, 10000, NULL, 1, false);

-- Communications
INSERT INTO communications (id, account_id, channel, occurred_at, subject, summary, direction) VALUES
  ('c7000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'call', '2026-01-16 10:00:00+00', 'Requirements discussion', 'Discussed block supply needs', 'outbound'),
  ('c7000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'whatsapp', '2026-01-22 14:00:00+00', 'Quotation follow-up', 'Sent revised pricing', 'outbound'),
  ('c7000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'email', '2026-01-30 09:00:00+00', 'PO confirmation', 'Client confirmed PO', 'inbound'),
  ('c7000004-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'call', '2026-02-08 11:00:00+00', 'Finishing inquiry', 'Discussed finishing materials', 'outbound'),
  ('c7000005-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'call', '2026-01-10 09:00:00+00', 'Steel supply RFQ', 'Received RFQ', 'inbound'),
  ('c7000006-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'meeting', '2026-01-25 10:00:00+00', 'Technical review', 'On-site review', 'outbound'),
  ('c7000007-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'whatsapp', '2026-02-04 15:00:00+00', 'Final pricing sent', 'Sent final quote v3', 'outbound'),
  ('c7000008-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'call', '2026-02-10 09:00:00+00', 'Concrete inquiry', 'New inquiry', 'inbound'),
  ('c7000009-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'whatsapp', '2026-01-18 11:00:00+00', 'Project brief', 'Received list', 'inbound'),
  ('c700000a-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'call', '2026-02-02 10:00:00+00', 'Negotiation call', 'Discussed pricing', 'outbound'),
  ('c700000b-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'whatsapp', '2026-02-11 14:00:00+00', 'Deal closed', 'Client accepted', 'inbound'),
  ('c700000c-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000004-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'call', '2026-01-22 09:00:00+00', 'Cold outreach', 'Reached out', 'outbound'),
  ('c700000d-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000004-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'meeting', '2026-02-01 10:00:00+00', 'Site visit', 'Visited site', 'outbound'),
  ('c700000e-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000004-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'whatsapp', '2026-02-07 16:00:00+00', 'Quote sent', 'Shared quotation', 'outbound'),
  ('c700000f-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000005-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'call', '2026-02-03 09:00:00+00', 'Introduction call', 'New lead', 'inbound'),
  ('c7000010-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000005-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'whatsapp', '2026-02-06 11:00:00+00', 'Material list', 'Requirements received', 'inbound'),
  ('c7000011-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'd2000005-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'call', '2026-02-12 10:00:00+00', 'Insulation follow-up', 'Price too high', 'outbound'),
  ('c7000012-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'c1000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'call', '2026-01-25 09:00:00+00', 'Tiles discussion', 'Marble options', 'outbound'),
  ('c7000013-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'c1000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'whatsapp', '2026-02-11 15:00:00+00', 'Quote accepted', 'Accepted tiles', 'inbound');

-- Tasks
INSERT INTO tasks (id, title, task_type, status, created_at, due_at, completed_at, customer_account_id) VALUES
  ('d8000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Follow up on NHC Ph.2 PO', 'follow_up', 'done', '2026-01-25 09:00:00+00', '2026-01-30 09:00:00+00', '2026-01-29 14:00:00+00', 'd2000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa'),
  ('d8000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Send revised metro steel quote', 'follow_up', 'done', '2026-01-20 09:00:00+00', '2026-01-26 09:00:00+00', '2026-01-24 10:00:00+00', 'd2000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa'),
  ('d8000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Prepare Madinah Tower proposal', 'follow_up', 'done', '2026-01-28 09:00:00+00', '2026-02-05 09:00:00+00', '2026-02-03 16:00:00+00', 'd2000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa'),
  ('d8000004-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Schedule Jeddah site visit', 'follow_up', 'done', '2026-01-25 09:00:00+00', '2026-02-01 09:00:00+00', '2026-01-31 11:00:00+00', 'd2000004-aaaa-4aaa-aaaa-aaaaaaaaaaaa'),
  ('d8000005-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Call EP Builders re: insulation', 'follow_up', 'done', '2026-02-05 09:00:00+00', '2026-02-10 09:00:00+00', '2026-02-09 14:00:00+00', 'd2000005-aaaa-4aaa-aaaa-aaaaaaaaaaaa'),
  ('d8000006-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Finalize Al Malqa tiles pricing', 'follow_up', 'done', '2026-02-06 09:00:00+00', '2026-02-12 09:00:00+00', '2026-02-11 10:00:00+00', 'c1000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa'),
  ('d8000007-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Send metro final v3 quote', 'follow_up', 'done', '2026-01-28 09:00:00+00', '2026-02-01 09:00:00+00', '2026-02-04 10:00:00+00', 'd2000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa'),
  ('d8000008-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Follow up on Jeddah Phase 1', 'follow_up', 'open', '2026-02-07 09:00:00+00', '2026-02-11 09:00:00+00', NULL, 'd2000004-aaaa-4aaa-aaaa-aaaaaaaaaaaa'),
  ('d8000009-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Check Dammam RFP response', 'follow_up', 'open', '2026-02-08 09:00:00+00', '2026-02-12 09:00:00+00', NULL, 'd2000005-aaaa-4aaa-aaaa-aaaaaaaaaaaa'),
  ('d800000a-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Prepare NHC finishing list', 'follow_up', 'open', '2026-02-10 09:00:00+00', '2026-02-18 09:00:00+00', NULL, 'd2000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa'),
  ('d800000b-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Send Metro concrete quote', 'follow_up', 'open', '2026-02-12 09:00:00+00', '2026-02-20 09:00:00+00', NULL, 'd2000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa'),
  ('d800000c-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Follow up Madinah interior', 'follow_up', 'open', '2026-02-13 09:00:00+00', '2026-02-19 09:00:00+00', NULL, 'd2000003-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
