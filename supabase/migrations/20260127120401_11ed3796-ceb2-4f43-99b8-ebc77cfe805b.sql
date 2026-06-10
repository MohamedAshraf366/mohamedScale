-- 1. Add interest_level column to opportunities table
ALTER TABLE public.opportunities 
ADD COLUMN interest_level text;

-- 2. Drop existing stage constraint if it exists
ALTER TABLE public.opportunities 
DROP CONSTRAINT IF EXISTS opportunities_stage_check;

-- 3. Add new stage constraint with correct values
-- Stages: discovery, rfp, negotiation, won, lost
ALTER TABLE public.opportunities 
ADD CONSTRAINT opportunities_stage_check 
CHECK (stage IN ('discovery', 'rfp', 'negotiation', 'won', 'lost'));

-- 4. Add interest_level constraint
ALTER TABLE public.opportunities 
ADD CONSTRAINT opportunities_interest_level_check 
CHECK (interest_level IS NULL OR interest_level IN ('High', 'Medium', 'Low', 'Not interested'));