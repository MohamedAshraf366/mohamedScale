
-- ============================================================
-- 1. Clean up SAL.0000 example: delete test projects, fix codes
-- ============================================================

-- Delete test projects (keep only فيلا تجريبية id: 4e13f017)
DELETE FROM projects WHERE customer_account_id = 'e58c58da-24f9-41e1-89e2-3c776d196b42'
  AND id != '4e13f017-f538-4dce-b778-f154671b109c';

-- Fix example project code
UPDATE projects SET code = 'SAL.0000_001' WHERE id = '4e13f017-f538-4dce-b778-f154671b109c';

-- Fix example opportunity code (already SAL.0000_000_000, but verify project link)
-- The opportunity is already correctly coded

-- Delete test communications under the example account (keep clean)
DELETE FROM communication_action_items WHERE communication_id IN (
  SELECT id FROM communications WHERE account_id = 'e58c58da-24f9-41e1-89e2-3c776d196b42'
);
DELETE FROM communications WHERE account_id = 'e58c58da-24f9-41e1-89e2-3c776d196b42';

-- Delete test quotation items and quotations
DELETE FROM quotation_items WHERE quotation_id IN (
  SELECT id FROM quotations WHERE customer_account_id = 'e58c58da-24f9-41e1-89e2-3c776d196b42'
);
DELETE FROM quotations WHERE customer_account_id = 'e58c58da-24f9-41e1-89e2-3c776d196b42';

-- ============================================================
-- 2. Hard delete customers after SAL.0176 + the OLD duplicate
-- ============================================================

-- Collect all account IDs to purge
-- SAL.0178, 0179, 0180, 0181, 0182, 0184, 0000_OLD
DO $$
DECLARE
  purge_ids uuid[] := ARRAY[
    'db3baa23-1ae4-437a-939b-7fe5d2d19801',
    '51989f2b-b6b8-4143-a138-4150f4b92df8',
    '124b874a-b7d0-47b9-ab3d-ada150bbfe1e',
    'f04b7a40-b623-4065-b877-50e20e66a635',
    '4f8789f3-cbc4-4ab5-a4d8-6aa866d8e2b0',
    'd901c76b-00dd-472e-9d8a-6aa6f50defb3',
    '4da166bc-25fa-4d87-9c16-590307b6046e',
    '47d36816-2bed-45dc-84eb-d9413a0277dc',
    'c3f7ec24-6153-4421-a6f0-e2520d0d4cf8',
    '2315f23c-1289-47e6-bc7f-acd4dd9e3f56'
  ]::uuid[];
BEGIN
  -- Delete deep child data first
  DELETE FROM communication_action_items WHERE communication_id IN (
    SELECT id FROM communications WHERE account_id = ANY(purge_ids)
  );
  DELETE FROM communications WHERE account_id = ANY(purge_ids);
  
  DELETE FROM quotation_items WHERE quotation_id IN (
    SELECT id FROM quotations WHERE customer_account_id = ANY(purge_ids)
  );
  DELETE FROM quotations WHERE customer_account_id = ANY(purge_ids);
  
  DELETE FROM order_items WHERE order_id IN (
    SELECT id FROM orders WHERE customer_account_id = ANY(purge_ids)
  );
  DELETE FROM orders WHERE customer_account_id = ANY(purge_ids);
  
  DELETE FROM payments WHERE invoice_id IN (
    SELECT id FROM invoices WHERE customer_account_id = ANY(purge_ids)
  );
  DELETE FROM invoices WHERE customer_account_id = ANY(purge_ids);
  
  DELETE FROM opportunities WHERE customer_account_id = ANY(purge_ids);
  DELETE FROM projects WHERE customer_account_id = ANY(purge_ids);
  DELETE FROM contacts WHERE account_id = ANY(purge_ids);
  DELETE FROM customers WHERE account_id = ANY(purge_ids);
  
  -- Delete activity log entries for these accounts
  DELETE FROM activity_log WHERE entity_id = ANY(purge_ids) AND entity_type = 'account';
  
  DELETE FROM accounts WHERE id = ANY(purge_ids);
END $$;
