-- Create 30 zones for Riyadh in a 5x6 grid
DO $$
DECLARE
  riyadh_id UUID;
  min_lat FLOAT := 24.4;
  max_lat FLOAT := 25.0;
  min_lng FLOAT := 46.3;
  max_lng FLOAT := 47.1;
  lat_step FLOAT;
  lng_step FLOAT;
  row_idx INT;
  col_idx INT;
  zone_num INT := 1;
  zone_lat_min FLOAT;
  zone_lat_max FLOAT;
  zone_lng_min FLOAT;
  zone_lng_max FLOAT;
  zone_boundary JSONB;
  zone_display_code TEXT;
BEGIN
  -- Get Riyadh region ID
  SELECT id INTO riyadh_id FROM regions WHERE code = 'RUH';
  
  IF riyadh_id IS NULL THEN
    RAISE EXCEPTION 'Riyadh region not found';
  END IF;
  
  -- Calculate step sizes (5 cols x 6 rows = 30 zones)
  lat_step := (max_lat - min_lat) / 6.0;
  lng_step := (max_lng - min_lng) / 5.0;
  
  -- Create 30 zones
  FOR row_idx IN 0..5 LOOP
    FOR col_idx IN 0..4 LOOP
      zone_lat_min := min_lat + (row_idx * lat_step);
      zone_lat_max := zone_lat_min + lat_step;
      zone_lng_min := min_lng + (col_idx * lng_step);
      zone_lng_max := zone_lng_min + lng_step;
      
      zone_boundary := jsonb_build_object(
        'type', 'Polygon',
        'coordinates', jsonb_build_array(
          jsonb_build_array(
            jsonb_build_array(zone_lng_min, zone_lat_min),
            jsonb_build_array(zone_lng_max, zone_lat_min),
            jsonb_build_array(zone_lng_max, zone_lat_max),
            jsonb_build_array(zone_lng_min, zone_lat_max),
            jsonb_build_array(zone_lng_min, zone_lat_min)
          )
        )
      );
      
      zone_display_code := 'RUH.' || LPAD(zone_num::TEXT, 3, '0');
      
      INSERT INTO zones (region_id, name, display_code, boundary_geojson)
      VALUES (
        riyadh_id,
        'Zone ' || zone_num,
        zone_display_code,
        zone_boundary
      )
      ON CONFLICT DO NOTHING;
      
      zone_num := zone_num + 1;
    END LOOP;
  END LOOP;
END $$;