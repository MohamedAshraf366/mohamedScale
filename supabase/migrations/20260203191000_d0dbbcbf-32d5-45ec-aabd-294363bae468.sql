-- Add contact_id to opportunities table for tracking the primary contact for the deal
ALTER TABLE public.opportunities
ADD COLUMN contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_opportunities_contact_id ON public.opportunities(contact_id);

-- Add comment for clarity
COMMENT ON COLUMN public.opportunities.contact_id IS 'Primary contact for this opportunity, defaults to project POC or customer primary contact';