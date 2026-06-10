
-- ── 1) Fix the trigger that caused the original failure ─────────────────────
CREATE OR REPLACE FUNCTION public.generate_customer_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_max int;
BEGIN
  -- Take the highest existing SAL.#### number, regardless of count
  SELECT COALESCE(MAX( (substring(code from '^SAL\.(\d+)$'))::int ), 0)
    INTO v_max
  FROM public.accounts
  WHERE code ~ '^SAL\.\d+$';

  UPDATE public.accounts
     SET code = 'SAL.' || lpad((v_max + 1)::text, 4, '0')
   WHERE id = NEW.account_id
     AND code IS NULL;

  RETURN NEW;
END;
$$;

-- ── 2) Repair the orphan account from today's failed save ────────────────────
INSERT INTO public.customers (account_id, customer_type)
SELECT 'ba62b986-b428-4e0f-bab0-0a305355c0bc'::uuid, 'SME'
WHERE NOT EXISTS (
  SELECT 1 FROM public.customers WHERE account_id = 'ba62b986-b428-4e0f-bab0-0a305355c0bc'
);

-- ── 3) Atomic create_customer RPC ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_customer(
  p_display_name      text,
  p_display_name_ar   text DEFAULT NULL,
  p_legal_name        text DEFAULT NULL,
  p_tax_number        text DEFAULT NULL,
  p_website           text DEFAULT NULL,
  p_account_status    text DEFAULT 'active',
  p_account_notes     text DEFAULT NULL,
  p_customer_type     text DEFAULT 'SME',
  p_pricing_tier      text DEFAULT NULL,
  p_payment_terms_days int  DEFAULT NULL,
  p_credit_limit      numeric DEFAULT NULL,
  p_customer_notes    text DEFAULT NULL,
  p_contact_name      text DEFAULT NULL,
  p_contact_phone     text DEFAULT NULL,
  p_contact_email     text DEFAULT NULL,
  p_contact_role      text DEFAULT NULL,
  p_prefers_whatsapp  boolean DEFAULT true,
  p_location          jsonb   DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name        text := nullif(btrim(p_display_name), '');
  v_name_ar     text := nullif(btrim(p_display_name_ar), '');
  v_dup_account uuid;
  v_account_id  uuid;
  v_contact_id  uuid;
  v_location_id uuid;
  v_actor       uuid := auth.uid();
BEGIN
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Customer name is required' USING ERRCODE = '22023';
  END IF;

  -- Duplicate check: only consider accounts that ALSO have a live customer row
  SELECT a.id INTO v_dup_account
  FROM public.accounts a
  JOIN public.customers c ON c.account_id = a.id
  WHERE a.deleted_at IS NULL
    AND c.deleted_at IS NULL
    AND (
      lower(btrim(a.display_name))    = lower(v_name)
      OR (v_name_ar IS NOT NULL AND lower(btrim(a.display_name_ar)) = lower(v_name_ar))
    )
  LIMIT 1;

  IF v_dup_account IS NOT NULL THEN
    RAISE EXCEPTION 'Customer "%" already exists. Please select the existing customer instead.', v_name
      USING ERRCODE = '23505';
  END IF;

  -- Optional location
  IF p_location IS NOT NULL AND (p_location ? 'lat') AND (p_location->>'lat') IS NOT NULL THEN
    INSERT INTO public.locations (
      lat, lng, address_text, address_link, place_id, place_name,
      city, region_code, zone_code, country, created_by
    ) VALUES (
      (p_location->>'lat')::numeric,
      (p_location->>'lng')::numeric,
      p_location->>'address_text',
      p_location->>'address_link',
      p_location->>'place_id',
      p_location->>'place_name',
      -- nullif(p_location->>'city','')::city_enum,
      CASE 
        WHEN p_location->>'city' IS NULL THEN NULL
        ELSE (p_location->>'city')::city_enum
      END
      coalesce(p_location->>'region_code', 'SA-01'),
      p_location->>'zone_code',
      coalesce((p_location->>'country')::gcc_country, 'SA'::gcc_country),
      v_actor
    )
    RETURNING id INTO v_location_id;
  END IF;

  INSERT INTO public.accounts (
    display_name, display_name_ar, legal_name, tax_number,
    website, status, notes, location_id, created_by
  ) VALUES (
    v_name, v_name_ar, p_legal_name, p_tax_number,
    p_website, coalesce(p_account_status,'active'), p_account_notes,
    v_location_id, v_actor
  )
  RETURNING id INTO v_account_id;

  INSERT INTO public.customers (
    account_id, customer_type, pricing_tier,
    payment_terms_days, credit_limit, notes, created_by
  ) VALUES (
    v_account_id, coalesce(p_customer_type,'SME'), p_pricing_tier,
    p_payment_terms_days, p_credit_limit, p_customer_notes, v_actor
  );

  IF nullif(btrim(p_contact_phone),'') IS NOT NULL OR nullif(btrim(p_contact_name),'') IS NOT NULL THEN
    INSERT INTO public.contacts (
      account_id, full_name, phone, email, role_title,
      is_primary, prefers_whatsapp, created_by
    ) VALUES (
      v_account_id,
      coalesce(nullif(btrim(p_contact_name),''), v_name),
      nullif(btrim(p_contact_phone),''),
      nullif(btrim(p_contact_email),''),
      nullif(btrim(p_contact_role),''),
      true,
      coalesce(p_prefers_whatsapp, true),
      v_actor
    )
    RETURNING id INTO v_contact_id;

    UPDATE public.accounts SET poc_contact_id = v_contact_id WHERE id = v_account_id;
  END IF;

  RETURN v_account_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_customer(
  text, text, text, text, text, text, text, text, text, int, numeric, text,
  text, text, text, text, boolean, jsonb
) TO authenticated;
