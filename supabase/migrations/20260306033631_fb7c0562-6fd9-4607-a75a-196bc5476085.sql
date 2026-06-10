
-- Trigger function: log opportunity stage changes to activity_log
CREATE OR REPLACE FUNCTION public.log_opportunity_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when stage actually changes
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO public.activity_log (entity_type, entity_id, action, actor_id, old_data, new_data)
    VALUES (
      'opportunity',
      NEW.id,
      'stage_change',
      COALESCE(NEW.updated_by, auth.uid()),
      jsonb_build_object('stage', OLD.stage),
      jsonb_build_object('stage', NEW.stage)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger to opportunities table
DROP TRIGGER IF EXISTS trg_log_opportunity_stage_change ON public.opportunities;
CREATE TRIGGER trg_log_opportunity_stage_change
AFTER UPDATE ON public.opportunities
FOR EACH ROW
EXECUTE FUNCTION public.log_opportunity_stage_change();
