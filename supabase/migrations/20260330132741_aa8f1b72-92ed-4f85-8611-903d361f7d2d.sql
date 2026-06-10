CREATE TABLE public.supplier_quote_validity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_quote_id uuid NOT NULL REFERENCES public.supplier_quotes(id) ON DELETE CASCADE,
  renegotiation_case_id uuid REFERENCES public.renegotiation_cases(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','expiring_soon','outreach_sent','supplier_confirmed','supplier_changed','management_approved','expired')),
  outreach_at timestamptz,
  outreach_method text,
  supplier_response text,
  supplier_responded_at timestamptz,
  management_decision text,
  management_decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  management_decided_at timestamptz,
  new_valid_until date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sqv_quote ON public.supplier_quote_validity(supplier_quote_id);
CREATE INDEX idx_sqv_status ON public.supplier_quote_validity(status);
CREATE INDEX idx_sqv_reneg ON public.supplier_quote_validity(renegotiation_case_id);

ALTER TABLE public.supplier_quote_validity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view supplier_quote_validity"
  ON public.supplier_quote_validity FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage supplier_quote_validity"
  ON public.supplier_quote_validity FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_supplier_quote_validity_updated_at
  BEFORE UPDATE ON public.supplier_quote_validity
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();