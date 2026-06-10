
-- ============================================================
-- Fix + Apply: Code-based geographic references (regions/zones/locations)
-- (retry with correct dollar-quoting)
-- ============================================================

-- 0) Disable existing zones trigger during column changes
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'generate_zone_display_code_trigger'
      AND tgrelid = 'public.zones'::regclass
  ) THEN
    EXECUTE 'DROP TRIGGER generate_zone_display_code_trigger ON public.zones';
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END
$do$;

-- 1) Ensure zones.display_code is populated (pre-migration only)
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='zones' AND column_name='display_code'
  ) THEN
    EXECUTE $sql$
      UPDATE public.zones z
      SET display_code = (
        SELECT r.code FROM public.regions r WHERE r.id = z.region_id
      ) || '.' || z.code
      WHERE z.display_code IS NULL
        AND z.code IS NOT NULL
        AND z.region_id IS NOT NULL;
    $sql$;
  END IF;
END
$do$;

-- 2) Restructure zones columns: code->zone_no, display_code->code (pre-migration only)
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='zones' AND column_name='display_code'
  ) THEN
    EXECUTE 'ALTER TABLE public.zones RENAME COLUMN code TO zone_no';
    EXECUTE 'ALTER TABLE public.zones RENAME COLUMN display_code TO code';
  END IF;
END
$do$;

-- zones.code unique
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'zones_code_unique'
      AND conrelid = 'public.zones'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE public.zones ADD CONSTRAINT zones_code_unique UNIQUE (code)';
  END IF;
END
$do$;

-- 3) zones.region_code replaces zones.region_id
ALTER TABLE public.zones ADD COLUMN IF NOT EXISTS region_code TEXT;

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='zones' AND column_name='region_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.zones z
      SET region_code = r.code
      FROM public.regions r
      WHERE r.id = z.region_id
        AND z.region_code IS NULL;
    $sql$;
  END IF;
END
$do$;

ALTER TABLE public.zones ALTER COLUMN region_code SET NOT NULL;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'zones_region_code_fkey'
      AND conrelid = 'public.zones'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE public.zones ADD CONSTRAINT zones_region_code_fkey FOREIGN KEY (region_code) REFERENCES public.regions(code)';
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='zones' AND column_name='region_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.zones DROP COLUMN region_id';
  END IF;
END
$do$;

-- 4) locations: add zone_code + region_code, backfill, enforce, drop zone_id
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS zone_code TEXT;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS region_code TEXT;

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='locations' AND column_name='zone_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.locations l
      SET zone_code = z.code
      FROM public.zones z
      WHERE z.id = l.zone_id
        AND l.zone_id IS NOT NULL
        AND l.zone_code IS NULL;
    $sql$;
  END IF;
END
$do$;

UPDATE public.locations l
SET region_code = z.region_code
FROM public.zones z
WHERE z.code = l.zone_code
  AND l.zone_code IS NOT NULL
  AND l.region_code IS NULL;

UPDATE public.locations l SET
  zone_code = sub.zcode,
  region_code = sub.rcode
FROM (
  SELECT l2.id, z.code AS zcode, z.region_code AS rcode
  FROM public.locations l2
  JOIN public.zones z ON z.boundary_geojson IS NOT NULL
    AND l2.lat IS NOT NULL AND l2.lng IS NOT NULL
    AND ST_Contains(
      ST_GeomFromGeoJSON(z.boundary_geojson::text),
      ST_SetSRID(ST_MakePoint(l2.lng, l2.lat), 4326)
    )
  WHERE l2.zone_code IS NULL
) sub
WHERE l.id = sub.id;

UPDATE public.locations SET region_code = 'RYD' WHERE region_code IS NULL;
ALTER TABLE public.locations ALTER COLUMN region_code SET NOT NULL;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'locations_zone_code_fkey'
      AND conrelid = 'public.locations'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE public.locations ADD CONSTRAINT locations_zone_code_fkey FOREIGN KEY (zone_code) REFERENCES public.zones(code)';
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'locations_region_code_fkey'
      AND conrelid = 'public.locations'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE public.locations ADD CONSTRAINT locations_region_code_fkey FOREIGN KEY (region_code) REFERENCES public.regions(code)';
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='locations' AND column_name='zone_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.locations DROP COLUMN zone_id';
  END IF;
END
$do$;

-- 5) delivery_rates: zone_ids -> zone_codes
ALTER TABLE public.delivery_rates ADD COLUMN IF NOT EXISTS zone_codes TEXT[] NOT NULL DEFAULT '{}';

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='delivery_rates' AND column_name='zone_ids'
  ) THEN
    EXECUTE $sql$
      UPDATE public.delivery_rates dr
      SET zone_codes = COALESCE(
        (SELECT array_agg(z.code ORDER BY z.code)
         FROM unnest(dr.zone_ids) AS zid
         JOIN public.zones z ON z.id = zid),
        '{}'
      )
      WHERE (dr.zone_codes IS NULL OR dr.zone_codes = '{}');
    $sql$;

    EXECUTE 'ALTER TABLE public.delivery_rates DROP COLUMN zone_ids';
  END IF;
END
$do$;

-- 6) topology tables
ALTER TABLE public.region_edges ADD COLUMN IF NOT EXISTS region_code TEXT;
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='region_edges' AND column_name='region_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.region_edges re
      SET region_code = r.code
      FROM public.regions r
      WHERE r.id = re.region_id
        AND re.region_code IS NULL;
    $sql$;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'region_edges_region_code_fkey'
      AND conrelid = 'public.region_edges'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE public.region_edges ADD CONSTRAINT region_edges_region_code_fkey FOREIGN KEY (region_code) REFERENCES public.regions(code)';
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='region_edges' AND column_name='region_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.region_edges DROP COLUMN region_id';
  END IF;
END
$do$;

ALTER TABLE public.zone_edges ADD COLUMN IF NOT EXISTS zone_code TEXT;
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='zone_edges' AND column_name='zone_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.zone_edges ze
      SET zone_code = z.code
      FROM public.zones z
      WHERE z.id = ze.zone_id
        AND ze.zone_code IS NULL;
    $sql$;
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'zone_edges_zone_code_fkey'
      AND conrelid = 'public.zone_edges'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE public.zone_edges ADD CONSTRAINT zone_edges_zone_code_fkey FOREIGN KEY (zone_code) REFERENCES public.zones(code)';
  END IF;
END
$do$;

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='zone_edges' AND column_name='zone_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.zone_edges DROP COLUMN zone_id';
  END IF;
END
$do$;

-- 7) Updated functions
CREATE OR REPLACE FUNCTION public.auto_detect_zone()
RETURNS TRIGGER AS $$
DECLARE
  _zone_code TEXT;
  _region_code TEXT;
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL AND NEW.zone_code IS NULL THEN
    SELECT z.code, z.region_code INTO _zone_code, _region_code
    FROM public.zones z
    WHERE z.boundary_geojson IS NOT NULL
      AND ST_Contains(
            ST_GeomFromGeoJSON(z.boundary_geojson::text),
            ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)
          )
    LIMIT 1;

    IF _zone_code IS NOT NULL THEN
      NEW.zone_code := _zone_code;
      IF NEW.region_code IS NULL THEN
        NEW.region_code := _region_code;
      END IF;
    END IF;
  END IF;

  IF NEW.region_code IS NULL AND NEW.zone_code IS NOT NULL THEN
    SELECT z.region_code INTO _region_code
    FROM public.zones z
    WHERE z.code = NEW.zone_code
    LIMIT 1;

    IF _region_code IS NOT NULL THEN
      NEW.region_code := _region_code;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.generate_sup_code()
RETURNS TRIGGER AS $$
DECLARE
  v_region_code TEXT;
  v_seq INT;
BEGIN
  SELECT l.region_code INTO v_region_code
  FROM public.accounts a
  JOIN public.locations l ON l.id = a.location_id
  WHERE a.id = NEW.account_id;

  v_region_code := COALESCE(v_region_code, 'RYD');
  SELECT count(*) INTO v_seq FROM public.suppliers s WHERE s.supplier_code LIKE 'SUP.' || v_region_code || '.%';
  NEW.supplier_code := 'SUP.' || v_region_code || '.' || LPAD((v_seq + 1)::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.generate_zone_display_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.region_code IS NOT NULL THEN
    IF NEW.zone_no IS NULL THEN
      NEW.zone_no := LPAD(
        (SELECT COALESCE(MAX(NULLIF(z.zone_no, '')::INTEGER), 0) + 1
         FROM public.zones z
         WHERE z.region_code = NEW.region_code)::TEXT,
        5,
        '0'
      );
    END IF;
    NEW.code := NEW.region_code || '.' || NEW.zone_no;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_zone_display_code_trigger
BEFORE INSERT OR UPDATE ON public.zones
FOR EACH ROW
EXECUTE FUNCTION public.generate_zone_display_code();
