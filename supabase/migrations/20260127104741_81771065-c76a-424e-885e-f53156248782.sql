-- Create opportunities table for sales pipeline tracking
CREATE TABLE public.opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Core relationships
  customer_account_id UUID NOT NULL REFERENCES public.customers(account_id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  
  -- Opportunity details
  title TEXT NOT NULL,
  description TEXT,
  
  -- Pipeline stage
  stage TEXT NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  
  -- Value tracking
  estimated_value NUMERIC,
  currency TEXT NOT NULL DEFAULT 'SAR',
  probability INTEGER CHECK (probability >= 0 AND probability <= 100),
  
  -- Dates
  expected_close_date DATE,
  won_at TIMESTAMP WITH TIME ZONE,
  lost_at TIMESTAMP WITH TIME ZONE,
  lost_reason TEXT,
  
  -- Source & attribution
  source TEXT, -- e.g., 'referral', 'cold_call', 'website', 'whatsapp'
  assigned_to UUID,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost', 'archived')),
  
  -- Metadata
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Enable RLS
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view opportunities"
ON public.opportunities FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can manage opportunities"
ON public.opportunities FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Index for common queries
CREATE INDEX idx_opportunities_customer ON public.opportunities(customer_account_id);
CREATE INDEX idx_opportunities_stage ON public.opportunities(stage);
CREATE INDEX idx_opportunities_status ON public.opportunities(status);
CREATE INDEX idx_opportunities_assigned ON public.opportunities(assigned_to);

-- Add comment for documentation
COMMENT ON TABLE public.opportunities IS 'Sales pipeline opportunities tracking';