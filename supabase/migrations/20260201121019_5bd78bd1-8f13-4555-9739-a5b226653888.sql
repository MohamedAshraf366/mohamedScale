-- Seed test customers with accounts, contacts and projects

-- Customer 1: Al-Faisal Construction (active customer)
INSERT INTO accounts (id, display_name, legal_name, account_kind, status, website, notes)
VALUES (
  'c1000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  'Al-Faisal Construction',
  'Al-Faisal Construction Company LLC',
  'company',
  'active',
  'https://alfaisal-construction.sa',
  'Major contractor in Riyadh area'
);

INSERT INTO customers (account_id, lifecycle_stage, segment, payment_terms_days, credit_limit)
VALUES (
  'c1000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  'active',
  'enterprise',
  30,
  500000
);

INSERT INTO contacts (id, account_id, full_name, role_title, phone, email, is_primary, prefers_whatsapp)
VALUES (
  'ca100001-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  'c1000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  'Mohammed Al-Faisal',
  'Procurement Manager',
  '+966501234567',
  'mohammed@alfaisal-construction.sa',
  true,
  true
);

INSERT INTO projects (id, customer_account_id, name, status, notes)
VALUES 
  ('b1000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'c1000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Al Malqa Villa Complex', 'active', 'Phase 1 - 12 villas'),
  ('b1000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'c1000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Industrial Warehouse - Sudair', 'active', '15,000 sqm warehouse');

-- Customer 2: Saudi Binladin Group (active customer)
INSERT INTO accounts (id, display_name, legal_name, account_kind, status, notes)
VALUES (
  'c1000002-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  'Saudi Binladin Group',
  'Saudi Binladin Group',
  'company',
  'active',
  'Large infrastructure projects'
);

INSERT INTO customers (account_id, lifecycle_stage, segment, payment_terms_days, credit_limit)
VALUES (
  'c1000002-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  'active',
  'enterprise',
  45,
  1000000
);

INSERT INTO contacts (id, account_id, full_name, role_title, phone, email, is_primary, prefers_whatsapp)
VALUES (
  'ca100002-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  'c1000002-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  'Ahmed Binladin',
  'Project Director',
  '+966509876543',
  'ahmed@binladin.com',
  true,
  true
);

INSERT INTO projects (id, customer_account_id, name, status, notes)
VALUES 
  ('b1000003-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'c1000002-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'NEOM Residential Block A', 'active', 'High-end residential units');

-- Customer 3: Khalid Trading (lead)
INSERT INTO accounts (id, display_name, legal_name, account_kind, status, notes)
VALUES (
  'c1000003-cccc-4ccc-cccc-cccccccccccc',
  'Khalid Trading Est.',
  'Khalid Trading Establishment',
  'company',
  'active',
  'Small contractor, reliable payer'
);

INSERT INTO customers (account_id, lifecycle_stage, segment, payment_terms_days, credit_limit)
VALUES (
  'c1000003-cccc-4ccc-cccc-cccccccccccc',
  'lead',
  'sme',
  14,
  50000
);

INSERT INTO contacts (id, account_id, full_name, role_title, phone, email, is_primary, prefers_whatsapp)
VALUES (
  'ca100003-cccc-4ccc-cccc-cccccccccccc',
  'c1000003-cccc-4ccc-cccc-cccccccccccc',
  'Khalid Al-Otaibi',
  'Owner',
  '+966551112222',
  'khalid@khalidtrading.sa',
  true,
  true
);

INSERT INTO projects (id, customer_account_id, name, status, notes)
VALUES 
  ('b1000004-cccc-4ccc-cccc-cccccccccccc', 'c1000003-cccc-4ccc-cccc-cccccccccccc', 'Private Villa - Al Yasmin', 'active', 'Single villa project');

-- Seed 5 opportunities across different stages
INSERT INTO opportunities (id, customer_account_id, project_id, title, stage, status, priority, description, source, expected_close_date)
VALUES
  -- Discovery stage
  (
    'a0000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'c1000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'b1000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'Al Malqa Villa - Block Supply',
    'discovery',
    'active',
    'high',
    'Initial inquiry for cement blocks for 12 villas',
    'referral',
    '2026-03-15'
  ),
  -- RFP stage  
  (
    'a0000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'c1000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'b1000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'Sudair Warehouse - Full Supply',
    'rfp',
    'active',
    'high',
    'RFP received for warehouse construction materials',
    'direct',
    '2026-02-28'
  ),
  -- Negotiation stage
  (
    'a0000003-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    'c1000002-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    'b1000003-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    'NEOM Block A - Phase 1',
    'negotiation',
    'active',
    'medium',
    'Negotiating final pricing for insulated blocks',
    'tender',
    '2026-02-20'
  ),
  -- Discovery - new lead
  (
    'a0000004-cccc-4ccc-cccc-cccccccccccc',
    'c1000003-cccc-4ccc-cccc-cccccccccccc',
    'b1000004-cccc-4ccc-cccc-cccccccccccc',
    'Al Yasmin Villa - Initial Quote',
    'discovery',
    'active',
    'low',
    'Small project, price-sensitive customer',
    'website',
    '2026-04-01'
  ),
  -- RFP stage
  (
    'a0000005-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    'c1000002-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    'b1000003-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    'NEOM Block A - Phase 2',
    'rfp',
    'active',
    'high',
    'Follow-on order for additional blocks',
    'existing_customer',
    '2026-03-10'
  );