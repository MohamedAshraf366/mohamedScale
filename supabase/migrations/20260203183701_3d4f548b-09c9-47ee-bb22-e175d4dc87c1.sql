-- Server-side sortable customer list (computed columns)
-- Creates a view that includes last_activity, open_tasks_count, and sales_volume.

CREATE OR REPLACE VIEW public.customer_list_v1
WITH (security_invoker=on)
AS
SELECT
  c.account_id,
  c.lifecycle_stage,
  c.customer_type,
  c.pricing_tier,
  c.payment_terms_days,
  c.credit_limit,
  c.notes,
  c.created_at,

  a.display_name,
  a.legal_name,
  a.status AS account_status,
  a.location_id,

  l.city AS location_city,
  l.country AS location_country,
  l.address_text AS location_address_text,
  l.address_link AS location_address_link,
  l.lat AS location_lat,
  l.lng AS location_lng,

  pc.id AS primary_contact_id,
  pc.full_name AS primary_contact_full_name,
  pc.phone AS primary_contact_phone,
  pc.email AS primary_contact_email,

  COALESCE(t.open_tasks_count, 0)::int AS open_tasks_count,
  comm.last_activity,
  COALESCE(o.sales_volume, 0)::numeric AS sales_volume

FROM public.customers c
JOIN public.accounts a ON a.id = c.account_id
LEFT JOIN public.locations l ON l.id = a.location_id

-- Primary contact (prefer is_primary=true)
LEFT JOIN LATERAL (
  SELECT ct.id, ct.full_name, ct.phone, ct.email
  FROM public.contacts ct
  WHERE ct.account_id = a.id
  ORDER BY ct.is_primary DESC, ct.created_at DESC
  LIMIT 1
) pc ON true

-- Open tasks count
LEFT JOIN LATERAL (
  SELECT count(*) AS open_tasks_count
  FROM public.tasks tk
  WHERE tk.customer_account_id = c.account_id
    AND tk.status IN ('open','in_progress')
) t ON true

-- Last activity
LEFT JOIN LATERAL (
  SELECT max(cm.occurred_at) AS last_activity
  FROM public.communications cm
  WHERE cm.account_id = c.account_id
) comm ON true

-- Sales volume
LEFT JOIN LATERAL (
  SELECT sum(ord.total) AS sales_volume
  FROM public.orders ord
  WHERE ord.customer_account_id = c.account_id
) o ON true

WHERE a.status = 'active';

COMMENT ON VIEW public.customer_list_v1 IS 'Customer list view with computed KPIs for server-side sorting (last_activity, open_tasks_count, sales_volume)';

-- Helpful index notes: view uses base-table indexes; ensure communications.account_id, tasks.customer_account_id, orders.customer_account_id are indexed in schema if performance becomes an issue.
