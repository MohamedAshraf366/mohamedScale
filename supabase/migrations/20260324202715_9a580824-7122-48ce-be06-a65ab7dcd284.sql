SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'accounts'::regclass;

-- Fix opportunities_status_check: add 'closed' and 'on_hold'
ALTER TABLE opportunities DROP CONSTRAINT opportunities_status_check;
ALTER TABLE opportunities ADD CONSTRAINT opportunities_status_check 
  CHECK (status = ANY (ARRAY['active','closed','won','lost','archived','on_hold']));

-- Fix accounts_status_check: add 'blacklisted'  
ALTER TABLE accounts DROP CONSTRAINT accounts_status_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_status_check 
  CHECK (status = ANY (ARRAY['active','inactive','blocked','blacklisted', 'deleted']));
ALTER TABLE accounts
ADD CONSTRAINT accounts_deleted_consistency
CHECK (
  (status = 'deleted' AND deleted_at IS NOT NULL)
  OR
  (status != 'deleted' AND deleted_at IS NULL)
);