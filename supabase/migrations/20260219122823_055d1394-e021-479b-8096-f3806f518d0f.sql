
-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Function: auto-detect zone_id from lat/lng using boundary_geojson
CREATE OR REPLACE FUNCTION public.auto_detect_zone()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _zone_id uuid;
BEGIN
  -- Only run if lat/lng are provided and zone_id is not already set
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL AND NEW.zone_id IS NULL THEN
    SELECT z.id INTO _zone_id
    FROM zones z
    WHERE z.boundary_geojson IS NOT NULL
      AND ST_Contains(
            ST_GeomFromGeoJSON(z.boundary_geojson::text),
            ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)
          )
    LIMIT 1;

    IF _zone_id IS NOT NULL THEN
      NEW.zone_id := _zone_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger: run before INSERT or UPDATE on locations
DROP TRIGGER IF EXISTS trg_auto_detect_zone ON public.locations;
CREATE TRIGGER trg_auto_detect_zone
  BEFORE INSERT OR UPDATE ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_detect_zone();
