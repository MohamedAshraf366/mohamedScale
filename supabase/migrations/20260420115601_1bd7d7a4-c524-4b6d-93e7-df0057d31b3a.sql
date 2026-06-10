DROP VIEW IF EXISTS public.customer_list_v1;

CREATE VIEW public.customer_list_v1 AS
SELECT
  a.id AS account_id,
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
    COALESCE((SELECT MAX(occurred_at) FROM public.communications WHERE account_id = a.id AND deleted_at IS NULL), 'epoch'::timestamptz),
    COALESCE((SELECT MAX(updated_at) FROM public.opportunities WHERE customer_account_id = a.id AND deleted_at IS NULL), 'epoch'::timestamptz),
    COALESCE((SELECT MAX(created_at) FROM public.orders WHERE customer_account_id = a.id), 'epoch'::timestamptz),
    a.created_at
  ) AS last_activity,
  COALESCE((
    SELECT COUNT(*)::int
    FROM public.communication_action_items cai
    JOIN public.communications cm ON cm.id = cai.communication_id
    WHERE cm.account_id = a.id
      AND cm.deleted_at IS NULL
      AND cai.status = 'open'
  ), 0) AS open_tasks_count
FROM public.accounts a
LEFT JOIN public.customers c ON c.account_id = a.id
LEFT JOIN public.contacts ct ON ct.id = a.poc_contact_id
LEFT JOIN public.locations l ON l.id = a.location_id
WHERE a.deleted_at IS NULL AND c.account_id IS NOT NULL;