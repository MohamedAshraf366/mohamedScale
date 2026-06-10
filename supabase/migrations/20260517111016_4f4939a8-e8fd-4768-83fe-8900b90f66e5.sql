
-- 1. Enum for selection roles
DO $$ BEGIN
  CREATE TYPE public.supplier_selection_role AS ENUM ('selected','quality','backup');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Main table
CREATE TABLE IF NOT EXISTS public.supplier_selections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id     uuid NOT NULL REFERENCES public.supply_domains(id) ON DELETE CASCADE,
  material_code text NULL,
  zone_code     text NULL,
  supplier_id   uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  role          public.supplier_selection_role NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  reason        text NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid NULL,
  -- enforce scope monotonicity: zone_code requires material_code
  CONSTRAINT supplier_selections_scope_chk CHECK (
    NOT (zone_code IS NOT NULL AND material_code IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_ss_domain     ON public.supplier_selections(domain_id) WHERE active;
CREATE INDEX IF NOT EXISTS idx_ss_lookup     ON public.supplier_selections(domain_id, material_code, zone_code, role) WHERE active;
CREATE INDEX IF NOT EXISTS idx_ss_supplier   ON public.supplier_selections(supplier_id) WHERE active;

-- 3. Partial unique indexes (one active selected/quality per scope)
CREATE UNIQUE INDEX IF NOT EXISTS uq_ss_selected_per_scope
  ON public.supplier_selections (domain_id, COALESCE(material_code,''), COALESCE(zone_code,''))
  WHERE active AND role = 'selected';

CREATE UNIQUE INDEX IF NOT EXISTS uq_ss_quality_per_scope
  ON public.supplier_selections (domain_id, COALESCE(material_code,''), COALESCE(zone_code,''))
  WHERE active AND role = 'quality';

CREATE UNIQUE INDEX IF NOT EXISTS uq_ss_backup_per_scope_supplier
  ON public.supplier_selections (domain_id, COALESCE(material_code,''), COALESCE(zone_code,''), supplier_id)
  WHERE active AND role = 'backup';

-- 4. RLS
ALTER TABLE public.supplier_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view supplier_selections"
  ON public.supplier_selections FOR SELECT TO authenticated USING (true);

-- Writes only via SECURITY DEFINER function; deny direct DML
CREATE POLICY "No direct insert"
  ON public.supplier_selections FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No direct update"
  ON public.supplier_selections FOR UPDATE TO authenticated USING (false);
CREATE POLICY "No direct delete"
  ON public.supplier_selections FOR DELETE TO authenticated USING (false);

-- 5. Writer function
CREATE OR REPLACE FUNCTION public.set_supplier_selection(
  p_domain_id     uuid,
  p_material_code text,
  p_zone_code     text,
  p_supplier_id   uuid,
  p_role          public.supplier_selection_role,
  p_action        text DEFAULT 'set',   -- 'set' | 'remove'
  p_reason        text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id uuid;
  v_uid    uuid := auth.uid();
BEGIN
  IF p_zone_code IS NOT NULL AND p_material_code IS NULL THEN
    RAISE EXCEPTION 'zone_code requires material_code (atom scope)';
  END IF;

  IF p_action = 'remove' THEN
    -- Deactivate matching active row(s) at this exact scope + role + supplier
    UPDATE public.supplier_selections
       SET active = false
     WHERE active
       AND domain_id = p_domain_id
       AND COALESCE(material_code,'') = COALESCE(p_material_code,'')
       AND COALESCE(zone_code,'')     = COALESCE(p_zone_code,'')
       AND role = p_role
       AND supplier_id = p_supplier_id;
    RETURN NULL;
  END IF;

  -- 'set'
  IF p_role IN ('selected','quality') THEN
    -- demote any current active row at exact scope+role
    UPDATE public.supplier_selections
       SET active = false
     WHERE active
       AND domain_id = p_domain_id
       AND COALESCE(material_code,'') = COALESCE(p_material_code,'')
       AND COALESCE(zone_code,'')     = COALESCE(p_zone_code,'')
       AND role = p_role;
  END IF;

  INSERT INTO public.supplier_selections (
    domain_id, material_code, zone_code, supplier_id, role, active, reason, created_by
  ) VALUES (
    p_domain_id, p_material_code, p_zone_code, p_supplier_id, p_role, true, p_reason, v_uid
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_supplier_selection(uuid,text,text,uuid,public.supplier_selection_role,text,text) TO authenticated;

-- 6. Helper: find domain for (material_code, zone_code)
CREATE OR REPLACE FUNCTION public.find_domain_for_material_zone(
  p_material_code text,
  p_zone_code     text
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH mat AS (
    SELECT id, subcategory_id FROM public.materials WHERE code = p_material_code LIMIT 1
  ),
  area AS (
    SELECT sa.id
      FROM public.subcategory_areas sa, mat
     WHERE sa.subcategory_id = mat.subcategory_id
       AND p_zone_code = ANY(sa.zone_codes)
     LIMIT 1
  )
  SELECT d.id
    FROM public.supply_domains d, mat, area
   WHERE d.subcategory_id = mat.subcategory_id
     AND d.area_id = area.id
     AND d.status = 'active'
   ORDER BY (d.axis_value IS NULL) DESC
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.find_domain_for_material_zone(text,text) TO authenticated;

-- 7. Resolver
CREATE OR REPLACE FUNCTION public.resolve_supplier(
  p_material_code text,
  p_zone_code     text,
  p_requested_role public.supplier_selection_role DEFAULT 'selected'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain_id  uuid;
  v_scope      text;
  v_role       public.supplier_selection_role;
  v_role_try   public.supplier_selection_role;
  v_supplier   uuid;
  v_was_fb     boolean := false;
  v_role_order public.supplier_selection_role[];
  v_scopes     text[] := ARRAY['atom','unit','domain'];
  v_landed     numeric;
BEGIN
  v_domain_id := public.find_domain_for_material_zone(p_material_code, p_zone_code);
  IF v_domain_id IS NULL THEN
    RETURN jsonb_build_object('reason','no_domain');
  END IF;

  IF p_requested_role = 'selected' THEN
    v_role_order := ARRAY['selected','quality','backup']::public.supplier_selection_role[];
  ELSIF p_requested_role = 'quality' THEN
    v_role_order := ARRAY['quality','selected','backup']::public.supplier_selection_role[];
  ELSE
    v_role_order := ARRAY['backup']::public.supplier_selection_role[];
  END IF;

  FOREACH v_scope IN ARRAY v_scopes LOOP
    FOREACH v_role_try IN ARRAY v_role_order LOOP
      IF v_role_try = 'backup' THEN
        -- cheapest active backup at this scope
        SELECT s.supplier_id INTO v_supplier
          FROM public.supplier_selections s
         WHERE s.active
           AND s.domain_id = v_domain_id
           AND s.role = 'backup'
           AND CASE v_scope
                 WHEN 'atom'   THEN s.material_code = p_material_code AND s.zone_code = p_zone_code
                 WHEN 'unit'   THEN s.material_code = p_material_code AND s.zone_code IS NULL
                 WHEN 'domain' THEN s.material_code IS NULL AND s.zone_code IS NULL
               END
         ORDER BY 1  -- placeholder; landed-price ordering below
         LIMIT 1;
        -- TODO: order by landed price once supplier_quote + delivery joined; for now first match
      ELSE
        SELECT s.supplier_id INTO v_supplier
          FROM public.supplier_selections s
         WHERE s.active
           AND s.domain_id = v_domain_id
           AND s.role = v_role_try
           AND CASE v_scope
                 WHEN 'atom'   THEN s.material_code = p_material_code AND s.zone_code = p_zone_code
                 WHEN 'unit'   THEN s.material_code = p_material_code AND s.zone_code IS NULL
                 WHEN 'domain' THEN s.material_code IS NULL AND s.zone_code IS NULL
               END
         LIMIT 1;
      END IF;

      IF v_supplier IS NOT NULL THEN
        v_role := v_role_try;
        v_was_fb := (v_role <> p_requested_role) OR (v_scope <> 'atom' AND p_zone_code IS NOT NULL AND p_material_code IS NOT NULL);
        RETURN jsonb_build_object(
          'reason','ok',
          'supplier_id', v_supplier,
          'role_used', v_role,
          'scope_used', v_scope,
          'was_fallback', v_was_fb,
          'domain_id', v_domain_id
        );
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('reason','not_found','domain_id', v_domain_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_supplier(text,text,public.supplier_selection_role) TO authenticated;
