
-- 1. Soft-delete columns on core tables
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS deleted_reason text DEFAULT NULL;

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deleted_reason text DEFAULT NULL;

ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS deleted_reason text DEFAULT NULL;

ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS deleted_reason text DEFAULT NULL;

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_reason text DEFAULT NULL;

-- 2. Make tasks.customer_account_id nullable
ALTER TABLE public.tasks ALTER COLUMN customer_account_id DROP NOT NULL;

-- 3. Add 'internal' to communications channel constraint
ALTER TABLE public.communications DROP CONSTRAINT IF EXISTS communications_channel_check;
ALTER TABLE public.communications ADD CONSTRAINT communications_channel_check 
  CHECK (channel = ANY (ARRAY['whatsapp','call','meeting','email','sms','in_person','site_visit','other','internal']));

-- 4. Update customer_list_v1 view to filter out soft-deleted records
CREATE OR REPLACE VIEW public.customer_list_v1 AS
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
  COALESCE(t.open_tasks_count, 0::bigint)::integer AS open_tasks_count,
  comm.last_activity,
  COALESCE(o.sales_volume, 0::numeric) AS sales_volume
FROM customers c
JOIN accounts a ON a.id = c.account_id
LEFT JOIN locations l ON l.id = a.location_id
LEFT JOIN LATERAL (
  SELECT ct.id, ct.full_name, ct.phone, ct.email
  FROM contacts ct
  WHERE ct.account_id = a.id
  ORDER BY ct.is_primary DESC, ct.created_at DESC
  LIMIT 1
) pc ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS open_tasks_count
  FROM tasks tk
  WHERE tk.customer_account_id = c.account_id 
    AND tk.status = ANY (ARRAY['open','in_progress'])
    AND tk.deleted_at IS NULL
) t ON true
LEFT JOIN LATERAL (
  SELECT max(cm.occurred_at) AS last_activity
  FROM communications cm
  WHERE cm.account_id = c.account_id
    AND cm.deleted_at IS NULL
) comm ON true
LEFT JOIN LATERAL (
  SELECT sum(ord.total) AS sales_volume
  FROM orders ord
  WHERE ord.customer_account_id = c.account_id
) o ON true
WHERE a.status = 'active' AND a.deleted_at IS NULL;
