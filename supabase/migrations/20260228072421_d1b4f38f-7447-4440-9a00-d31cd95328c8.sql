
-- Create a location for the example project in a zone that has delivery rates
DO $$
DECLARE
  loc_id uuid;
BEGIN
  INSERT INTO public.locations (
    address_text, city, country, region_code, zone_code,
    lat, lng, place_name
  ) VALUES (
    'فيلا تجريبية، حي المحمدية، الرياض',
    'Riyadh',
    'SA',
    'RYD',
    'RYD.11012',
    24.7136,
    46.6753,
    'Example Villa - Al Muhammadiyah'
  )
  RETURNING id INTO loc_id;

  UPDATE public.projects
  SET location_id = loc_id
  WHERE id = '4e13f017-f538-4dce-b778-f154671b109c';
END $$;
