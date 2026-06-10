-- Audit C8: move "freeze pricing on send" logic from app code into a DB trigger.
-- When a quotation's status transitions to 'sent' (or 'accepted') and pricing_locked_at is still NULL,
-- stamp pricing_locked_at = now() automatically. Also stamp sent_at if missing.
-- This makes the freeze rule un-bypassable regardless of which client wrote the update.

CREATE OR REPLACE FUNCTION public.freeze_quotation_on_send()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when status is transitioning into a sent-or-later state.
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('sent', 'accepted', 'converted')
  THEN
    IF NEW.pricing_locked_at IS NULL THEN
      NEW.pricing_locked_at := now();
    END IF;

    -- If status flipped to 'sent' and sent_at wasn't supplied, stamp it.
    IF NEW.status = 'sent' AND NEW.sent_at IS NULL THEN
      NEW.sent_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_quotation_on_send ON public.quotations;

CREATE TRIGGER trg_freeze_quotation_on_send
BEFORE UPDATE ON public.quotations
FOR EACH ROW
EXECUTE FUNCTION public.freeze_quotation_on_send();

COMMENT ON FUNCTION public.freeze_quotation_on_send() IS
  'Audit C8: stamps pricing_locked_at (and sent_at) automatically when a quotation transitions to sent/accepted/converted. Replaces application-level freeze logic in SendQuoteSheet.';