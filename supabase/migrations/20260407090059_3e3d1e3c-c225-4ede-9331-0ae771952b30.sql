DROP VIEW IF EXISTS public.customer_list_v1;

CREATE VIEW public.customer_list_v1 AS
SELECT c.account_id,
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
    l.city::text AS location_city,
    l.country::text AS location_country,
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
    COALESCE(o.sales_volume, 0::numeric) AS sales_volume,
    a.is_example
   FROM customers c
     JOIN accounts a ON a.id = c.account_id
     LEFT JOIN locations l ON l.id = a.location_id
     LEFT JOIN LATERAL ( SELECT ct.id,
            ct.full_name,
            ct.phone,
            ct.email
           FROM contacts ct
          WHERE ct.account_id = a.id
          ORDER BY ct.is_primary DESC, ct.created_at DESC
         LIMIT 1) pc ON true
     LEFT JOIN LATERAL ( SELECT count(*) AS open_tasks_count
           FROM tasks tk
          WHERE tk.customer_account_id = c.account_id AND (tk.status = ANY (ARRAY['open'::text, 'in_progress'::text])) AND tk.deleted_at IS NULL) t ON true
     LEFT JOIN LATERAL ( SELECT max(cm.occurred_at) AS last_activity
           FROM communications cm
          WHERE cm.account_id = c.account_id AND cm.deleted_at IS NULL) comm ON true
     LEFT JOIN LATERAL ( SELECT sum(ord.total) AS sales_volume
           FROM orders ord
          WHERE ord.customer_account_id = c.account_id) o ON true
  WHERE a.status = 'active'::text AND a.deleted_at IS NULL;