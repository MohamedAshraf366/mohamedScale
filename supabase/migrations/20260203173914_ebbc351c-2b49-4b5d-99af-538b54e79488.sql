-- Remove status column from projects table
ALTER TABLE public.projects DROP COLUMN IF EXISTS status;