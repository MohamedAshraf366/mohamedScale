
-- Fix auto_detect_zone trigger to use zone_code + region_code instead of zone_id
CREATE OR REPLACE FUNCTION public.auto_detect_zone()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _zone record;
BEGIN
  -- Only run if lat/lng are provided
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    -- Auto-detect zone if zone_code is not already set
    IF NEW.zone_code IS NULL THEN
      SELECT z.code, z.region_code
        INTO _zone
        FROM zones z
       WHERE z.boundary_geojson IS NOT NULL
         AND ST_Contains(
               ST_GeomFromGeoJSON(z.boundary_geojson::text),
               ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)
             )
       LIMIT 1;

      IF _zone IS NOT NULL THEN
        NEW.zone_code := _zone.code;
        -- Also set region_code from the zone if not already set
        IF NEW.region_code IS NULL OR NEW.region_code = '' THEN
          NEW.region_code := _zone.region_code;
        END IF;
      END IF;
    ELSE
      -- zone_code is set; ensure region_code is also set from the zone
      IF NEW.region_code IS NULL OR NEW.region_code = '' THEN
        SELECT z.region_code INTO _zone
          FROM zones z
         WHERE z.code = NEW.zone_code
         LIMIT 1;
        IF _zone IS NOT NULL THEN
          NEW.region_code := _zone.region_code;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
