
-- Step 1: Remove the old SAL.0000 account code to free the unique constraint
UPDATE accounts SET code = 'SAL.0000_OLD' WHERE id = '4da166bc-25fa-4d87-9c16-590307b6046e';

-- Step 2: Set the active example account to SAL.0000
UPDATE accounts SET code = 'SAL.0000' WHERE id = 'e58c58da-24f9-41e1-89e2-3c776d196b42';

-- Step 3: Soft-delete all duplicate example accounts
UPDATE accounts 
SET metadata = jsonb_set(metadata, '{is_example}', 'false'),
    deleted_at = now(),
    deleted_reason = 'Duplicate example account cleanup'
WHERE id IN (
  '4da166bc-25fa-4d87-9c16-590307b6046e',
  'db3baa23-1ae4-437a-939b-7fe5d2d19801',
  '51989f2b-b6b8-4143-a138-4150f4b92df8',
  '124b874a-b7d0-47b9-ab3d-ada150bbfe1e',
  'f04b7a40-b623-4065-b877-50e20e66a635',
  '4f8789f3-cbc4-4ab5-a4d8-6aa866d8e2b0'
);
