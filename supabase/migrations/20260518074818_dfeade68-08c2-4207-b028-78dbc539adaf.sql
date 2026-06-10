
-- Add freeze state to suppliers and have resolver skip frozen/blacklisted suppliers.

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS frozen_reason text;

CREATE OR REPLACE FUNCTION public.resolve_supplier(
  p_material_code text,
  p_zone_code text,
  p_requested_role public.supplier_selection_role DEFAULT 'selected'::public.supplier_selection_role
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_domain_id    uuid;
  v_scope        text;
  v_role_try     public.supplier_selection_role;
  v_supplier     uuid;
  v_role_used    public.supplier_selection_role;
  v_scope_used   text;
  v_role_order   public.supplier_selection_role[];
  v_scopes       text[] := ARRAY['atom','unit','domain'];
  v_material_id  uuid;
BEGIN
  v_domain_id := public.find_domain_for_material_zone(p_material_code, p_zone_code);
  IF v_domain_id IS NULL THEN
    RETURN jsonb_build_object('reason','no_domain');
  END IF;

  SELECT id INTO v_material_id
  FROM public.materials WHERE code = p_material_code LIMIT 1;

  IF p_requested_role = 'selected' THEN
    v_role_order := ARRAY['selected','quality','backup']::public.supplier_selection_role[];
  ELSIF p_requested_role = 'quality' THEN
    v_role_order := ARRAY['quality','selected','backup']::public.supplier_selection_role[];
  ELSE
    v_role_order := ARRAY['backup']::public.supplier_selection_role[];
  END IF;

  FOREACH v_scope IN ARRAY v_scopes LOOP
    FOREACH v_role_try IN ARRAY v_role_order LOOP
      v_supplier := NULL;

      IF v_role_try = 'backup' THEN
        WITH cand AS (
          SELECT s.supplier_id
          FROM public.supplier_selections s
          JOIN public.suppliers sup ON sup.account_id = s.supplier_id
          WHERE s.active
            AND s.domain_id = v_domain_id
            AND s.role = 'backup'
            AND COALESCE(sup.is_blacklisted,false) = false
            AND COALESCE(sup.is_frozen,false) = false
            AND CASE v_scope
                  WHEN 'atom'   THEN s.material_code = p_material_code AND s.zone_code = p_zone_code
                  WHEN 'unit'   THEN s.material_code = p_material_code AND s.zone_code IS NULL
                  WHEN 'domain' THEN s.material_code IS NULL AND s.zone_code IS NULL
                END
        ),
        priced AS (
          SELECT
            c.supplier_id,
            sm.id           AS supplier_material_id,
            sm.unit_price,
            (
              SELECT MIN(dr.price_per_moq)
              FROM public.delivery_rates dr
              WHERE dr.supplier_account_id = c.supplier_id
                AND p_zone_code = ANY (dr.zone_codes)
                AND (
                  COALESCE(array_length(dr.supplier_material_ids, 1), 0) = 0
                  OR sm.id = ANY (dr.supplier_material_ids)
                )
            ) AS delivery_price
          FROM cand c
          JOIN public.supplier_materials sm
            ON sm.supplier_account_id = c.supplier_id
           AND sm.material_id         = v_material_id
           AND COALESCE(sm.is_current, true) = true
           AND COALESCE(sm.status, 'active') = 'active'
           AND (sm.price_valid_until IS NULL OR sm.price_valid_until >= CURRENT_DATE)
           AND sm.unit_price IS NOT NULL
        )
        SELECT supplier_id INTO v_supplier
        FROM priced
        WHERE unit_price IS NOT NULL AND delivery_price IS NOT NULL
        ORDER BY (unit_price + delivery_price) ASC, supplier_id ASC
        LIMIT 1;

      ELSE
        SELECT s.supplier_id INTO v_supplier
        FROM public.supplier_selections s
        JOIN public.suppliers sup ON sup.account_id = s.supplier_id
        WHERE s.active
          AND s.domain_id = v_domain_id
          AND s.role = v_role_try
          AND COALESCE(sup.is_blacklisted,false) = false
          AND COALESCE(sup.is_frozen,false) = false
          AND CASE v_scope
                WHEN 'atom'   THEN s.material_code = p_material_code AND s.zone_code = p_zone_code
                WHEN 'unit'   THEN s.material_code = p_material_code AND s.zone_code IS NULL
                WHEN 'domain' THEN s.material_code IS NULL AND s.zone_code IS NULL
              END
        LIMIT 1;
      END IF;

      IF v_supplier IS NOT NULL THEN
        v_role_used  := v_role_try;
        v_scope_used := v_scope;
        RETURN jsonb_build_object(
          'reason','ok',
          'supplier_id', v_supplier,
          'role_used', v_role_used,
          'scope_used', v_scope_used,
          'was_fallback', (v_role_used <> p_requested_role) OR (v_scope_used <> 'atom'),
          'domain_id', v_domain_id
        );
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('reason','not_found','domain_id', v_domain_id);
END;
$function$;
