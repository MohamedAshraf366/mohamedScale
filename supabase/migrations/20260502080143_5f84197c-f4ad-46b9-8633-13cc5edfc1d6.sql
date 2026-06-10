-- Auto-progression of opportunity stages based on quotation signals
-- Forward-only: discovery -> rfp -> negotiation. Won/lost handled elsewhere.

CREATE OR REPLACE FUNCTION public.auto_progress_opportunity_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_stage text;
  v_new_stage text;
  v_stage_rank int;
  v_new_rank int;
BEGIN
  IF NEW.opportunity_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine signal: quotation insert -> rfp; quotation sent_at set -> negotiation
  IF (TG_OP = 'INSERT') THEN
    v_new_stage := 'rfp';
  ELSIF (TG_OP = 'UPDATE'
         AND NEW.sent_at IS NOT NULL
         AND (OLD.sent_at IS DISTINCT FROM NEW.sent_at)) THEN
    v_new_stage := 'negotiation';
  ELSE
    RETURN NEW;
  END IF;

  SELECT stage INTO v_current_stage FROM public.opportunities WHERE id = NEW.opportunity_id;
  IF v_current_stage IS NULL THEN
    RETURN NEW;
  END IF;

  -- Forward-only ordering. Skip if already at/past target or in terminal state.
  v_stage_rank := CASE v_current_stage
    WHEN 'discovery' THEN 1
    WHEN 'rfp' THEN 2
    WHEN 'negotiation' THEN 3
    WHEN 'won' THEN 99
    WHEN 'lost' THEN 99
    ELSE 0 END;
  v_new_rank := CASE v_new_stage
    WHEN 'rfp' THEN 2
    WHEN 'negotiation' THEN 3
    ELSE 0 END;

  IF v_new_rank > v_stage_rank AND v_stage_rank < 90 THEN
    UPDATE public.opportunities
    SET stage = v_new_stage, updated_at = now()
    WHERE id = NEW.opportunity_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_progress_opportunity_stage_ins ON public.quotations;
CREATE TRIGGER trg_auto_progress_opportunity_stage_ins
AFTER INSERT ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.auto_progress_opportunity_stage();

DROP TRIGGER IF EXISTS trg_auto_progress_opportunity_stage_upd ON public.quotations;
CREATE TRIGGER trg_auto_progress_opportunity_stage_upd
AFTER UPDATE OF sent_at ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.auto_progress_opportunity_stage();