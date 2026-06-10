
-- Fix linter warning: set immutable search_path on functions modified by this migration

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
$$ LANGUAGE plpgsql
SET search_path = public, extensions;

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
$$ LANGUAGE plpgsql
SET search_path = public, extensions;

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
$$ LANGUAGE plpgsql
SET search_path = public, extensions;
