-- Fix existing open tasks for opportunity a0000003 - keep only the most recent one open
WITH latest_task AS (
  SELECT id FROM public.tasks 
  WHERE opportunity_id = 'a0000003-bbbb-4bbb-bbbb-bbbbbbbbbbbb' 
    AND status IN ('open', 'in_progress')
  ORDER BY created_at DESC
  LIMIT 1
)
UPDATE public.tasks
SET 
  status = 'done',
  completed_at = now(),
  outcome = 'Auto-closed: duplicate open task'
WHERE opportunity_id = 'a0000003-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
  AND status IN ('open', 'in_progress')
  AND id NOT IN (SELECT id FROM latest_task);