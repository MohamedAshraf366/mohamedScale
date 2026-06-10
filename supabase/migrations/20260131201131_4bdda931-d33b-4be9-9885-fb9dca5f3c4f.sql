-- 1. Add materials_interest JSONB column to opportunities
-- This stores materials with optional quantities: [{material_id, name, quantity?}]
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS materials_interest jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Fix stage default from 'lead' to 'discovery'
ALTER TABLE public.opportunities
ALTER COLUMN stage SET DEFAULT 'discovery';

-- 3. Add opportunity_id to quotations table
ALTER TABLE public.quotations
ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_quotations_opportunity_id ON public.quotations(opportunity_id);

-- 4. Add metadata columns where missing (per the plan)
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.quotations
ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.quotation_items
ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 5. Enforce metadata NOT NULL default on communications
ALTER TABLE public.communications
ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

-- 6. Create trigger function for auto-updating opportunity stage based on quotations
CREATE OR REPLACE FUNCTION public.update_opportunity_stage_from_quotation()
RETURNS TRIGGER AS $$
DECLARE
  v_opp_id uuid;
  v_has_official_draft boolean;
  v_has_official_sent boolean;
  v_has_official_accepted boolean;
  v_has_official_rejected boolean;
  v_new_stage text;
BEGIN
  -- Get the opportunity_id from the quotation
  v_opp_id := COALESCE(NEW.opportunity_id, OLD.opportunity_id);
  
  IF v_opp_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Check quotation states for this opportunity
  SELECT
    EXISTS(SELECT 1 FROM public.quotations WHERE opportunity_id = v_opp_id AND quote_type = 'order' AND status = 'draft'),
    EXISTS(SELECT 1 FROM public.quotations WHERE opportunity_id = v_opp_id AND quote_type = 'order' AND status = 'sent'),
    EXISTS(SELECT 1 FROM public.quotations WHERE opportunity_id = v_opp_id AND quote_type = 'order' AND status = 'accepted'),
    EXISTS(SELECT 1 FROM public.quotations WHERE opportunity_id = v_opp_id AND quote_type = 'order' AND status = 'rejected')
  INTO v_has_official_draft, v_has_official_sent, v_has_official_accepted, v_has_official_rejected;
  
  -- Determine new stage based on quotation state
  IF v_has_official_accepted THEN
    v_new_stage := 'won';
  ELSIF v_has_official_rejected AND NOT v_has_official_sent AND NOT v_has_official_draft THEN
    v_new_stage := 'lost';
  ELSIF v_has_official_sent THEN
    v_new_stage := 'negotiation';
  ELSIF v_has_official_draft THEN
    v_new_stage := 'rfp';
  ELSE
    v_new_stage := 'discovery';
  END IF;
  
  -- Update the opportunity stage
  UPDATE public.opportunities
  SET stage = v_new_stage, updated_at = now()
  WHERE id = v_opp_id AND stage != v_new_stage;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on quotations table
DROP TRIGGER IF EXISTS trg_quotation_update_opp_stage ON public.quotations;
CREATE TRIGGER trg_quotation_update_opp_stage
AFTER INSERT OR UPDATE OR DELETE ON public.quotations
FOR EACH ROW
EXECUTE FUNCTION public.update_opportunity_stage_from_quotation();