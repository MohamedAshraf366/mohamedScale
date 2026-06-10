
-- Fix the future-dated communication for SAL.0170
UPDATE communications 
SET occurred_at = created_at
WHERE id = 'ecdb39eb-c0ac-447a-9ac2-7a2d05e51f42';

-- Add validation trigger: communications occurred_at must not be in the future (max 1 hour tolerance)
CREATE OR REPLACE FUNCTION validate_communication_occurred_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.occurred_at > (now() + interval '1 hour') THEN
    RAISE EXCEPTION 'Communication occurred_at cannot be in the future. Got: %', NEW.occurred_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_communication_occurred_at ON communications;
CREATE TRIGGER trg_validate_communication_occurred_at
  BEFORE INSERT OR UPDATE ON communications
  FOR EACH ROW
  EXECUTE FUNCTION validate_communication_occurred_at();

-- Add validation trigger: tasks due_at must be in the future (for new open tasks only)
CREATE OR REPLACE FUNCTION validate_task_due_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate on insert of open/pending tasks
  IF TG_OP = 'INSERT' AND NEW.status IN ('open', 'pending', 'in_progress') THEN
    IF NEW.due_at IS NOT NULL AND NEW.due_at < (now() - interval '1 hour') THEN
      RAISE EXCEPTION 'Follow-up task due_at must be in the future. Got: %', NEW.due_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_task_due_at ON tasks;
CREATE TRIGGER trg_validate_task_due_at
  BEFORE INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION validate_task_due_at();
