-- Drop the old check constraint and recreate with 'stage_change' included
ALTER TABLE public.activity_log DROP CONSTRAINT activity_log_action_check;

ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_action_check
  CHECK (action = ANY (ARRAY['insert','update','delete','status_change','stage_change','note']));
