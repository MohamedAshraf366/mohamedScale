-- Add permissive SELECT policy for authenticated users to view agent_actions
CREATE POLICY "Authenticated users can view agent_actions"
ON public.agent_actions
FOR SELECT
TO authenticated
USING (true);