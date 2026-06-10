CREATE TABLE public.supplier_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_account_id uuid NOT NULL REFERENCES public.suppliers(account_id) ON DELETE CASCADE,
  issue_id uuid REFERENCES public.supplier_issues(id) ON DELETE SET NULL,
  supply_unit_id uuid REFERENCES public.supply_units(id) ON DELETE SET NULL,
  affected_material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  affected_zone_code text REFERENCES public.zones(code) ON DELETE SET NULL,
  action_type text NOT NULL
    CHECK (action_type IN ('warning','freeze','unfreeze','demote_to_backup','remove_from_unit','blacklist','unblacklist')),
  reason text,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sa_supplier ON public.supplier_actions(supplier_account_id);
CREATE INDEX idx_sa_type ON public.supplier_actions(action_type);
CREATE INDEX idx_sa_issue ON public.supplier_actions(issue_id);
CREATE INDEX idx_sa_supply_unit ON public.supplier_actions(supply_unit_id);

ALTER TABLE public.supplier_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view supplier_actions"
  ON public.supplier_actions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Management can insert supplier_actions"
  ON public.supplier_actions FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'management'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role)
  );