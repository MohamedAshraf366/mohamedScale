-- Allow management role to manage zone_groups (currently admin-only)
DROP POLICY "Admins can manage zone_groups" ON public.zone_groups;

CREATE POLICY "Admins and management can manage zone_groups"
ON public.zone_groups
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));