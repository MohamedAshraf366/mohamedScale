
-- Step 1: Drop old code format check
ALTER TABLE materials DROP CONSTRAINT IF EXISTS materials_code_format_check;
