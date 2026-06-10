
-- Force re-compute all material codes via trigger (variant_no is a trigger column)
UPDATE materials SET variant_no = variant_no;

-- Add new format constraint
ALTER TABLE materials ADD CONSTRAINT materials_code_format_check 
  CHECK (code IS NULL OR code ~ '^MAT\.[A-Z]{2}\.[0-9]{2}\.[0-9]{3}\.[0-9]{2}$') NOT VALID;
