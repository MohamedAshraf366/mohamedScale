CREATE TABLE public.supplier_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_account_id uuid NOT NULL REFERENCES public.suppliers(account_id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  supply_unit_id uuid REFERENCES public.supply_units(id) ON DELETE SET NULL,
  issue_type text NOT NULL
    CHECK (issue_type IN ('delay','quality','pricing','communication','documentation','coverage','validity','other')),
  severity text NOT NULL DEFAULT 'minor'
    CHECK (severity IN ('minor','major','critical')),
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','auto')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','investigating','resolved','escalated','closed')),
  description text NOT NULL,
  resolution_notes text,
  final_outcome text,
  reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_si_supplier ON public.supplier_issues(supplier_account_id);
CREATE INDEX idx_si_status ON public.supplier_issues(status);
CREATE INDEX idx_si_severity ON public.supplier_issues(severity);
CREATE INDEX idx_si_type ON public.supplier_issues(issue_type);
CREATE INDEX idx_si_supply_unit ON public.supplier_issues(supply_unit_id);

ALTER TABLE public.supplier_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view supplier_issues"
  ON public.supplier_issues FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage supplier_issues"
  ON public.supplier_issues FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_supplier_issues_updated_at
  BEFORE UPDATE ON public.supplier_issues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();