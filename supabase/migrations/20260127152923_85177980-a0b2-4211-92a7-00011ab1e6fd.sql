-- Add new columns to tasks table for follow-up migration support
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS communication_id uuid REFERENCES public.communications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS client_response text,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS legacy_follow_up_id uuid;

-- Create indexes on new FK columns for query performance
CREATE INDEX IF NOT EXISTS idx_tasks_opportunity_id ON public.tasks(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_tasks_communication_id ON public.tasks(communication_id);
CREATE INDEX IF NOT EXISTS idx_tasks_legacy_follow_up_id ON public.tasks(legacy_follow_up_id);