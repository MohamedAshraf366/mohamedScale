
-- Allow anon role to read zones (boundary data is not sensitive)
CREATE POLICY "Anon can view zones"
ON public.zones FOR SELECT
TO anon
USING (true);

-- Allow anon role to read zone_groups
CREATE POLICY "Anon can view zone_groups"
ON public.zone_groups FOR SELECT
TO anon
USING (true);
