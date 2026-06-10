-- Create quotations for test opportunities with materials_interest data
INSERT INTO public.quotations (id, opportunity_id, customer_account_id, project_id, status, quote_type, version)
VALUES 
  ('d0000003-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'a0000003-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'c1000002-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'b1000003-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'draft', 'order', 1),
  ('d0000005-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'a0000005-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'c1000002-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'b1000003-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'draft', 'order', 1)
ON CONFLICT (id) DO NOTHING;

-- Insert quotation items for opportunity a0000003 (has supplier pricing)
INSERT INTO public.quotation_items (quotation_id, material_id, quantity, uom, supplier_material_id, supplier_account_id, unit_price, delivery_price, line_total, position, status)
VALUES 
  ('d0000003-bbbb-4bbb-bbbb-bbbbbbbbbbbb', '453e3109-5453-4dec-9c48-3e28b5e1f1fd', 2000, 'piece', '9403e30e-19a1-4fbe-b4b3-1e975465b399', (SELECT supplier_account_id FROM supplier_materials WHERE id = '9403e30e-19a1-4fbe-b4b3-1e975465b399'), 2.78, 0.35, 2000 * 2.78, 0, 'active'),
  ('d0000003-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'b0d5a1d2-23cd-4048-8519-8c824d7350d5', 4000, 'piece', 'c2725008-128a-4209-8384-d3301e2b8dfe', (SELECT supplier_account_id FROM supplier_materials WHERE id = 'c2725008-128a-4209-8384-d3301e2b8dfe'), 2.6, 0.3, 4000 * 2.6, 1, 'active');

-- Insert quotation items for opportunity a0000005 (no supplier pricing yet)
INSERT INTO public.quotation_items (quotation_id, material_id, quantity, uom, position, status)
VALUES 
  ('d0000005-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'ec359e6f-a2f1-4016-8807-476819dd856b', 6000, 'piece', 0, 'active'),
  ('d0000005-bbbb-4bbb-bbbb-bbbbbbbbbbbb', '79099f6e-3090-4e4f-8538-6f1a130d2f5b', 3500, 'piece', 1, 'active');

-- Update quotation totals for a0000003
UPDATE public.quotations
SET 
  subtotal = (SELECT COALESCE(SUM(line_total), 0) FROM quotation_items WHERE quotation_id = 'd0000003-bbbb-4bbb-bbbb-bbbbbbbbbbbb' AND status = 'active'),
  delivery_total = (SELECT COALESCE(SUM(quantity * COALESCE(delivery_price, 0)), 0) FROM quotation_items WHERE quotation_id = 'd0000003-bbbb-4bbb-bbbb-bbbbbbbbbbbb' AND status = 'active'),
  total = (SELECT COALESCE(SUM(line_total), 0) + COALESCE(SUM(quantity * COALESCE(delivery_price, 0)), 0) FROM quotation_items WHERE quotation_id = 'd0000003-bbbb-4bbb-bbbb-bbbbbbbbbbbb' AND status = 'active')
WHERE id = 'd0000003-bbbb-4bbb-bbbb-bbbbbbbbbbbb';