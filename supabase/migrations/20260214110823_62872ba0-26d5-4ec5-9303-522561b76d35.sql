
-- =============================================
-- CODING SYSTEM: Schema + Triggers + Data Seed
-- =============================================

-- Part 1: Add code columns
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS code text UNIQUE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS code text UNIQUE;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS code text UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS code text UNIQUE;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS code text UNIQUE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS code text UNIQUE;

-- Part 2: Rewrite material code trigger → MAT.CC.SS.NNN.NN
CREATE OR REPLACE FUNCTION public.set_material_code()
RETURNS trigger LANGUAGE plpgsql AS $function$
declare
  v_cat_code char(2);
  v_sub_no smallint;
  v_block_type text;
  v_insulation text;
  v_holes text;
  v_size text;
  v_d1 char(1);
  v_d2 char(1);
  v_d3 char(1);
begin
  if new.subcategory_id is null or new.material_no is null then
    return new;
  end if;

  select c.code2, s.subcategory_no
    into v_cat_code, v_sub_no
  from public.material_subcategories s
  join public.material_categories c on c.id = s.category_id
  where s.id = new.subcategory_id;

  if v_cat_code is null then
    raise exception 'Invalid subcategory_id: %', new.subcategory_id;
  end if;

  v_block_type := coalesce(new.specs->>'block_type', 'regular');
  v_insulation := coalesce(new.specs->>'insulation_spec', 'uninsulated');
  v_holes := coalesce(new.specs->>'holes_spec', 'solid');
  v_size := coalesce(new.specs->>'size_cm', '0');

  v_d1 := case v_block_type
    when 'regular' then '1' when 'steamed' then '2' when 'volcanic' then '3' else '1' end;
  v_d2 := case v_insulation
    when 'uninsulated' then '1' when 'sandwich_blue' then '2' when 'sandwich_white' then '3'
    when 'inserted_blue' then '4' when 'inserted_white' then '5' else '1' end;
  v_d3 := case v_holes
    when 'solid' then '0' when '2_holes' then '1' when '3_holes' then '2' when '4_holes' then '3'
    when '6_holes' then '4' when '8_holes' then '5' when '10_holes' then '6' when '12_holes' then '7' else '0' end;

  new.code := 'MAT.' || v_cat_code || '.' || lpad(v_sub_no::text, 2, '0')
    || '.' || v_d1 || v_d2 || v_d3
    || '.' || lpad(v_size, 2, '0');

  return new;
end;
$function$;

-- Part 3: Sales entity code triggers

-- Customer code (AFTER INSERT on customers → updates accounts.code)
CREATE OR REPLACE FUNCTION public.generate_customer_code()
RETURNS trigger LANGUAGE plpgsql AS $function$
declare v_seq int;
begin
  SELECT count(*) INTO v_seq FROM accounts a JOIN customers c ON c.account_id = a.id WHERE a.code IS NOT NULL;
  UPDATE accounts SET code = 'SAL.' || lpad((v_seq + 1)::text, 4, '0') WHERE id = NEW.account_id AND code IS NULL;
  return NEW;
end;
$function$;

-- Project code (BEFORE INSERT)
CREATE OR REPLACE FUNCTION public.generate_project_code()
RETURNS trigger LANGUAGE plpgsql AS $function$
declare v_parent_code text; v_seq int;
begin
  SELECT a.code INTO v_parent_code FROM accounts a WHERE a.id = NEW.customer_account_id;
  IF v_parent_code IS NULL THEN return NEW; END IF;
  SELECT count(*) INTO v_seq FROM projects WHERE customer_account_id = NEW.customer_account_id AND code IS NOT NULL;
  NEW.code := v_parent_code || '_' || lpad((v_seq + 1)::text, 3, '0');
  return NEW;
end;
$function$;

-- Opportunity code (BEFORE INSERT)
CREATE OR REPLACE FUNCTION public.generate_opportunity_code()
RETURNS trigger LANGUAGE plpgsql AS $function$
declare v_parent_code text; v_seq int;
begin
  SELECT p.code INTO v_parent_code FROM projects p WHERE p.id = NEW.project_id;
  IF v_parent_code IS NULL THEN return NEW; END IF;
  SELECT count(*) INTO v_seq FROM opportunities WHERE project_id = NEW.project_id AND code IS NOT NULL;
  NEW.code := v_parent_code || '_' || lpad((v_seq + 1)::text, 3, '0');
  return NEW;
end;
$function$;

-- Order code (BEFORE INSERT)
CREATE OR REPLACE FUNCTION public.generate_order_code()
RETURNS trigger LANGUAGE plpgsql AS $function$
declare v_parent_code text; v_seq int;
begin
  IF NEW.project_id IS NULL THEN return NEW; END IF;
  SELECT p.code INTO v_parent_code FROM projects p WHERE p.id = NEW.project_id;
  IF v_parent_code IS NULL THEN return NEW; END IF;
  SELECT count(*) INTO v_seq FROM orders WHERE project_id = NEW.project_id AND code IS NOT NULL;
  NEW.code := v_parent_code || '_' || lpad((v_seq + 1)::text, 3, '0');
  return NEW;
end;
$function$;

-- Quotation code (BEFORE INSERT)
CREATE OR REPLACE FUNCTION public.generate_quotation_code()
RETURNS trigger LANGUAGE plpgsql AS $function$
declare v_parent_code text; v_seq int;
begin
  IF NEW.opportunity_id IS NOT NULL THEN
    SELECT o.code INTO v_parent_code FROM opportunities o WHERE o.id = NEW.opportunity_id;
  END IF;
  IF v_parent_code IS NULL AND NEW.order_id IS NOT NULL THEN
    SELECT o.code INTO v_parent_code FROM orders o WHERE o.id = NEW.order_id;
  END IF;
  IF v_parent_code IS NULL THEN return NEW; END IF;
  IF NEW.opportunity_id IS NOT NULL THEN
    SELECT count(*) INTO v_seq FROM quotations WHERE opportunity_id = NEW.opportunity_id AND code IS NOT NULL;
  ELSE
    SELECT count(*) INTO v_seq FROM quotations WHERE order_id = NEW.order_id AND code IS NOT NULL;
  END IF;
  NEW.code := v_parent_code || '_QOT.' || lpad((v_seq + 1)::text, 3, '0');
  return NEW;
end;
$function$;

-- Invoice code (BEFORE INSERT)
CREATE OR REPLACE FUNCTION public.generate_invoice_code()
RETURNS trigger LANGUAGE plpgsql AS $function$
declare v_parent_code text; v_seq int;
begin
  IF NEW.order_id IS NULL THEN return NEW; END IF;
  SELECT o.code INTO v_parent_code FROM orders o WHERE o.id = NEW.order_id;
  IF v_parent_code IS NULL THEN return NEW; END IF;
  SELECT count(*) INTO v_seq FROM invoices WHERE order_id = NEW.order_id AND code IS NOT NULL;
  NEW.code := v_parent_code || '_INV.' || lpad((v_seq + 1)::text, 3, '0');
  return NEW;
end;
$function$;

-- Part 4: Supplier code trigger
CREATE OR REPLACE FUNCTION public.generate_sup_code()
RETURNS trigger LANGUAGE plpgsql AS $function$
declare v_region_code text; v_seq int;
begin
  SELECT r.code INTO v_region_code
  FROM accounts a
  JOIN locations l ON l.id = a.location_id
  JOIN zones z ON z.id = l.zone_id
  JOIN regions r ON r.id = z.region_id
  WHERE a.id = NEW.account_id;
  v_region_code := coalesce(v_region_code, 'RYD');
  SELECT count(*) INTO v_seq FROM suppliers s WHERE s.supplier_code LIKE 'SUP.' || v_region_code || '.%';
  NEW.supplier_code := 'SUP.' || v_region_code || '.' || lpad((v_seq + 1)::text, 3, '0');
  return NEW;
end;
$function$;

-- Part 5: Attach triggers
DROP TRIGGER IF EXISTS trg_generate_customer_code ON customers;
CREATE TRIGGER trg_generate_customer_code AFTER INSERT ON customers FOR EACH ROW EXECUTE FUNCTION generate_customer_code();

DROP TRIGGER IF EXISTS trg_generate_project_code ON projects;
CREATE TRIGGER trg_generate_project_code BEFORE INSERT ON projects FOR EACH ROW EXECUTE FUNCTION generate_project_code();

DROP TRIGGER IF EXISTS trg_generate_opportunity_code ON opportunities;
CREATE TRIGGER trg_generate_opportunity_code BEFORE INSERT ON opportunities FOR EACH ROW EXECUTE FUNCTION generate_opportunity_code();

DROP TRIGGER IF EXISTS trg_generate_order_code ON orders;
CREATE TRIGGER trg_generate_order_code BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION generate_order_code();

DROP TRIGGER IF EXISTS trg_generate_quotation_code ON quotations;
CREATE TRIGGER trg_generate_quotation_code BEFORE INSERT ON quotations FOR EACH ROW EXECUTE FUNCTION generate_quotation_code();

DROP TRIGGER IF EXISTS trg_generate_invoice_code ON invoices;
CREATE TRIGGER trg_generate_invoice_code BEFORE INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION generate_invoice_code();

DROP TRIGGER IF EXISTS trg_generate_sup_code ON suppliers;
CREATE TRIGGER trg_generate_sup_code BEFORE INSERT ON suppliers FOR EACH ROW EXECUTE FUNCTION generate_sup_code();

-- Part 6: Seed existing data

-- Add holes_spec to all materials
UPDATE materials SET specs = specs || '{"holes_spec": "solid"}'::jsonb WHERE NOT (specs ? 'holes_spec');

-- Re-generate all material codes via trigger
UPDATE materials SET updated_at = now();

-- Customer account codes (ordered by created_at)
UPDATE accounts SET code = 'SAL.0001' WHERE id = '26334c5a-4c8a-4273-b103-e254218c4d27';
UPDATE accounts SET code = 'SAL.0002' WHERE id = 'c1000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
UPDATE accounts SET code = 'SAL.0003' WHERE id = 'c1000002-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
UPDATE accounts SET code = 'SAL.0004' WHERE id = 'c1000003-cccc-4ccc-cccc-cccccccccccc';
UPDATE accounts SET code = 'SAL.0005' WHERE id = 'd20d43c4-fc43-4225-822a-bb51f9a0b651';

-- Project codes
UPDATE projects SET code = 'SAL.0001_001' WHERE id = '445db1f1-ded3-46af-89bb-e326efd18f26';
UPDATE projects SET code = 'SAL.0002_001' WHERE id = 'b1000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
UPDATE projects SET code = 'SAL.0002_002' WHERE id = 'b1000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
UPDATE projects SET code = 'SAL.0002_003' WHERE id = 'e7a477fa-d33b-4f74-839c-9c37e40b5e16';
UPDATE projects SET code = 'SAL.0003_001' WHERE id = 'b1000003-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
UPDATE projects SET code = 'SAL.0003_002' WHERE id = '34fe3240-9550-4dee-b74f-3d8c1391994b';
UPDATE projects SET code = 'SAL.0004_001' WHERE id = 'b1000004-cccc-4ccc-cccc-cccccccccccc';
UPDATE projects SET code = 'SAL.0005_001' WHERE id = '433b6f90-f64d-4833-a509-2bb34943dd92';

-- Opportunity codes
UPDATE opportunities SET code = 'SAL.0001_001_001' WHERE id = 'ae4eb9a1-e8cb-4715-93a1-d32062bf7af7';
UPDATE opportunities SET code = 'SAL.0002_001_001' WHERE id = 'a0000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
UPDATE opportunities SET code = 'SAL.0002_002_001' WHERE id = 'a0000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
UPDATE opportunities SET code = 'SAL.0003_001_001' WHERE id = 'a0000003-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
UPDATE opportunities SET code = 'SAL.0003_001_002' WHERE id = 'a0000005-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
UPDATE opportunities SET code = 'SAL.0003_001_003' WHERE id = '8b58b094-2aea-45d2-8ecc-ed4ea4927f78';
UPDATE opportunities SET code = 'SAL.0003_002_001' WHERE id = '47399aac-e702-4283-bc71-3e23dd1241ef';
UPDATE opportunities SET code = 'SAL.0004_001_001' WHERE id = 'a0000004-cccc-4ccc-cccc-cccccccccccc';

-- Quotation codes
UPDATE quotations SET code = 'SAL.0003_001_002_QOT.001' WHERE id = 'd0000005-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
UPDATE quotations SET code = 'SAL.0003_001_001_QOT.001' WHERE id = 'd0000003-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
UPDATE quotations SET code = 'SAL.0002_001_001_QOT.001' WHERE id = '72a47e48-d412-47ac-8e98-253313d7273f';
UPDATE quotations SET code = 'SAL.0003_001_003_QOT.001' WHERE id = 'fe8d647d-1262-4cb6-b6f5-e57fb18805cf';
UPDATE quotations SET code = 'SAL.0003_002_001_QOT.001' WHERE id = '723023e4-a0c5-446f-841b-d20281d97c3d';
UPDATE quotations SET code = 'SAL.0004_001_001_QOT.001' WHERE id = '60cdbe68-42cd-453b-a4ad-84c10e8abbc5';

-- Supplier codes
UPDATE suppliers SET supplier_code = 'SUP.RYD.001' WHERE supplier_code = 'SUP-001';
UPDATE suppliers SET supplier_code = 'SUP.RYD.002' WHERE supplier_code = 'SUP-002';
UPDATE suppliers SET supplier_code = 'SUP.RYD.003' WHERE supplier_code = 'SUP-003';
