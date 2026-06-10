
-- Drop the existing admin-only policy
DROP POLICY IF EXISTS "Admins can manage kpi_targets" ON public.kpi_targets;

-- Create new policy allowing both admin and management roles
CREATE POLICY "Admins and management can manage kpi_targets"
ON public.kpi_targets
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role)
);
