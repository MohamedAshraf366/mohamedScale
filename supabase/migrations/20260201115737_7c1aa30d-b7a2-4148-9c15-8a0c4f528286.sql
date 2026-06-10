-- Create 3 test supplier accounts and supplier records
-- Supplier 1: Gulf Construction Factory (Manufacturer - Premium)
INSERT INTO public.accounts (id, account_kind, display_name, legal_name, status)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'company', 'Gulf Construction Factory', 'Gulf Construction Factory Co. Ltd.', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'company', 'Saleh Al Rajhi Factory', 'Saleh Al Rajhi Block Factory', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'company', 'Al-Labna Al-Masiya', 'Al-Labna Al-Masiya Trading Est.', 'active')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

-- Create supplier records
INSERT INTO public.suppliers (account_id, supplier_code, supplier_type, lead_time_days, rating)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'SUP-001', 'manufacturer', 3, 4.5),
  ('22222222-2222-2222-2222-222222222222', 'SUP-002', 'manufacturer', 2, 4.2),
  ('33333333-3333-3333-3333-333333333333', 'SUP-003', 'store', 1, 4.0)
ON CONFLICT (account_id) DO UPDATE SET supplier_code = EXCLUDED.supplier_code;

-- Insert supplier_materials pricing for first 10 materials across all 3 suppliers
INSERT INTO public.supplier_materials (supplier_account_id, material_id, unit_price, delivery_price, moq, lead_time_days, status, quote_version)
SELECT 
  s.account_id,
  m.id,
  CASE 
    WHEN s.supplier_code = 'SUP-001' THEN 2.50 + (ROW_NUMBER() OVER (PARTITION BY s.account_id ORDER BY m.code) * 0.10)
    WHEN s.supplier_code = 'SUP-002' THEN 2.30 + (ROW_NUMBER() OVER (PARTITION BY s.account_id ORDER BY m.code) * 0.08)
    ELSE 2.80 + (ROW_NUMBER() OVER (PARTITION BY s.account_id ORDER BY m.code) * 0.12)
  END as unit_price,
  CASE 
    WHEN s.supplier_code = 'SUP-001' THEN 0.30
    WHEN s.supplier_code = 'SUP-002' THEN 0.35
    ELSE 0.25
  END as delivery_price,
  CASE 
    WHEN s.supplier_code = 'SUP-001' THEN 500
    WHEN s.supplier_code = 'SUP-002' THEN 300
    ELSE 100
  END as moq,
  CASE 
    WHEN s.supplier_code = 'SUP-001' THEN 3
    WHEN s.supplier_code = 'SUP-002' THEN 2
    ELSE 1
  END as lead_time_days,
  'approved',
  1
FROM public.suppliers s
CROSS JOIN (
  SELECT id, code FROM public.materials 
  WHERE status = 'active' 
  ORDER BY code 
  LIMIT 10
) m
WHERE NOT EXISTS (
  SELECT 1 FROM public.supplier_materials sm 
  WHERE sm.supplier_account_id = s.account_id AND sm.material_id = m.id
);