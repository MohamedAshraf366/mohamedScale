
-- Add Arabic name columns to accounts, contacts, and projects
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS display_name_ar text;

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS full_name_ar text;

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS name_ar text;

-- Make display_name nullable (it already is, but ensure EN is not required)
-- display_name is already nullable per the types, so no change needed.
-- The constraint is: at least one of display_name or display_name_ar must be provided.
-- We'll add a check constraint for that.
ALTER TABLE public.accounts ADD CONSTRAINT accounts_name_en_or_ar_required
  CHECK (display_name IS NOT NULL OR display_name_ar IS NOT NULL);
