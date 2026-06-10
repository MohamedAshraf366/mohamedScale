
-- Soft-delete duplicate communications
UPDATE communications SET 
  deleted_at = now(), 
  deleted_reason = 'Duplicate account cleanup - redundant entry from Mar 13 re-creation'
WHERE account_id IN (
  SELECT id FROM accounts WHERE code IN ('SAL.0179','SAL.0180','SAL.0181','SAL.0183')
) AND deleted_at IS NULL;

-- Soft-delete duplicate opportunities
UPDATE opportunities SET 
  deleted_at = now(), 
  deleted_reason = 'Duplicate account cleanup - redundant entry from Mar 13 re-creation'
WHERE customer_account_id IN (
  SELECT id FROM accounts WHERE code IN ('SAL.0179','SAL.0180','SAL.0181','SAL.0183')
) AND deleted_at IS NULL;

-- Soft-delete duplicate projects
UPDATE projects SET 
  deleted_at = now(), 
  deleted_reason = 'Duplicate account cleanup - redundant entry from Mar 13 re-creation'
WHERE customer_account_id IN (
  SELECT id FROM accounts WHERE code IN ('SAL.0179','SAL.0180','SAL.0181','SAL.0183')
) AND deleted_at IS NULL;

-- Soft-delete duplicate accounts
UPDATE accounts SET 
  deleted_at = now(), 
  deleted_reason = 'Duplicate of original account - created by accident on Mar 13'
WHERE code IN ('SAL.0179','SAL.0180','SAL.0181','SAL.0183') AND deleted_at IS NULL;
