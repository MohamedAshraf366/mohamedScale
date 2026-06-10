
CREATE OR REPLACE FUNCTION public.fn_resolve_location_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_url text;
  service_key text;
BEGIN
  -- Only fire when address_link has a maps short link and lat is null
  IF NEW.address_link IS NOT NULL
     AND NEW.address_link LIKE '%maps.app.goo.gl%'
     AND NEW.lat IS NULL
  THEN
    edge_url := rtrim(current_setting('app.settings.supabase_url', true), '/') 
                || '/functions/v1/resolve-project-locations';
    service_key := current_setting('app.settings.service_role_key', true);
    
    -- If settings not available, construct from known project ref
    IF edge_url IS NULL OR edge_url = '' OR edge_url = '/functions/v1/resolve-project-locations' THEN
      edge_url := 'https://bliiejmmpjpduxrewyev.supabase.co/functions/v1/resolve-project-locations';
    END IF;

    PERFORM net.http_post(
      url := edge_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(service_key, current_setting('supabase.service_role_key', true))
      ),
      body := jsonb_build_object('location_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_location_link ON public.locations;
CREATE TRIGGER trg_resolve_location_link
  AFTER INSERT OR UPDATE OF address_link
  ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_resolve_location_link();
