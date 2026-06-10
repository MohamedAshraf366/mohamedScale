-- 1) Rebuild customer_list_v1 to count real tasks (not the empty communication_action_items)
CREATE OR REPLACE VIEW public.customer_list_v1 AS
SELECT a.id AS account_id,
       a.display_name,
       a.display_name_ar,
       a.legal_name,
       a.code,
       a.status AS account_status,
       a.location_id,
       a.website,
       a.tax_number,
       a.notes AS account_notes,
       a.metadata AS account_metadata,
       a.created_at AS account_created_at,
       c.account_id AS customer_account_id,
       c.customer_type,
       c.lifecycle_stage,
       c.assigned_to,
       c.payment_terms_days,
       c.credit_limit,
       c.pricing_tier,
       ct.id AS primary_contact_id,
       ct.full_name AS primary_contact_name,
       ct.phone AS primary_contact_phone,
       ct.email AS primary_contact_email,
       ct.role_title AS primary_contact_role,
       l.region_code,
       l.zone_code,
       l.city,
       l.address_text,
       l.lat,
       l.lng,
       l.address_link,
       l.country,
       GREATEST(
         COALESCE((SELECT max(communications.occurred_at) FROM communications
                   WHERE communications.account_id = a.id AND communications.deleted_at IS NULL),
                  '1970-01-01 00:00:00+00'::timestamptz),
         COALESCE((SELECT max(opportunities.updated_at) FROM opportunities
                   WHERE opportunities.customer_account_id = a.id AND opportunities.deleted_at IS NULL),
                  '1970-01-01 00:00:00+00'::timestamptz),
         COALESCE((SELECT max(orders.created_at) FROM orders
                   WHERE orders.customer_account_id = a.id),
                  '1970-01-01 00:00:00+00'::timestamptz),
         a.created_at
       ) AS last_activity,
       COALESCE((SELECT count(*)::int FROM tasks t
                 WHERE t.customer_account_id = a.id
                   AND t.deleted_at IS NULL
                   AND t.status IN ('open','in_progress')), 0) AS open_tasks_count
FROM accounts a
  LEFT JOIN customers c ON c.account_id = a.id
  LEFT JOIN contacts ct ON ct.id = a.poc_contact_id
  LEFT JOIN locations l ON l.id = a.location_id
WHERE a.deleted_at IS NULL AND c.account_id IS NOT NULL;

-- 2) Trigger backstop: when an opportunity flips to stage='won', auto-accept its latest quotation
CREATE OR REPLACE FUNCTION public.auto_accept_quotation_on_won()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote_id uuid;
BEGIN
  IF NEW.stage = 'won' AND (OLD.stage IS NULL OR OLD.stage <> 'won') THEN
    SELECT q.id INTO v_quote_id
      FROM public.quotations q
     WHERE q.opportunity_id = NEW.id
       AND q.status IN ('draft','sent')
     ORDER BY q.version DESC NULLS LAST, q.created_at DESC
     LIMIT 1;

    IF v_quote_id IS NOT NULL THEN
      UPDATE public.quotations
         SET status = 'accepted',
             accepted_at = COALESCE(accepted_at, now()),
             updated_at = now()
       WHERE id = v_quote_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_accept_quotation_on_won ON public.opportunities;
CREATE TRIGGER trg_auto_accept_quotation_on_won
AFTER UPDATE OF stage ON public.opportunities
FOR EACH ROW
EXECUTE FUNCTION public.auto_accept_quotation_on_won();

-- 3) Backfill: for already-won opportunities, mark their latest quotation accepted
WITH latest_per_opp AS (
  SELECT DISTINCT ON (q.opportunity_id) q.id, q.opportunity_id, q.status
    FROM public.quotations q
    JOIN public.opportunities o ON o.id = q.opportunity_id
   WHERE o.stage = 'won'
   ORDER BY q.opportunity_id, q.version DESC NULLS LAST, q.created_at DESC
)
UPDATE public.quotations q
   SET status = 'accepted',
       accepted_at = COALESCE(q.accepted_at, now()),
       updated_at = now()
  FROM latest_per_opp lp
 WHERE q.id = lp.id
   AND q.status IN ('draft','sent');