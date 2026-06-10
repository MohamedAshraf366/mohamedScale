
-- Update quotation code trigger to use _PL for price lists (is_soft=true)
CREATE OR REPLACE FUNCTION public.generate_quotation_code()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, extensions
AS $function$
declare v_parent_code text; v_seq int; v_suffix text;
begin
  IF NEW.opportunity_id IS NOT NULL THEN
    SELECT o.code INTO v_parent_code FROM opportunities o WHERE o.id = NEW.opportunity_id;
  END IF;
  IF v_parent_code IS NULL AND NEW.order_id IS NOT NULL THEN
    SELECT o.code INTO v_parent_code FROM orders o WHERE o.id = NEW.order_id;
  END IF;
  IF v_parent_code IS NULL THEN return NEW; END IF;

  -- Determine suffix based on is_soft flag
  v_suffix := CASE WHEN NEW.is_soft THEN '_PL.' ELSE '_QOT.' END;

  IF NEW.opportunity_id IS NOT NULL THEN
    SELECT count(*) INTO v_seq FROM quotations
      WHERE opportunity_id = NEW.opportunity_id AND is_soft = NEW.is_soft AND code IS NOT NULL;
  ELSE
    SELECT count(*) INTO v_seq FROM quotations
      WHERE order_id = NEW.order_id AND is_soft = NEW.is_soft AND code IS NOT NULL;
  END IF;
  NEW.code := v_parent_code || v_suffix || lpad((v_seq + 1)::text, 3, '0');
  return NEW;
end;
$function$;
