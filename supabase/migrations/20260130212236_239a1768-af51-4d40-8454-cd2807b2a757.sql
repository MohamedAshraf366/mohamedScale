-- Add opportunity_id to communications table for deal-specific conversation tracking
ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL;

-- Create index for performance when filtering communications by opportunity
CREATE INDEX IF NOT EXISTS idx_communications_opportunity_id ON public.communications(opportunity_id);