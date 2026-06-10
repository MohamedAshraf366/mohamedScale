CREATE TABLE public.renegotiation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_account_id uuid NOT NULL REFERENCES public.suppliers(account_id) ON DELETE CASCADE,
  original_quote_id uuid NOT NULL REFERENCES public.supplier_quotes(id) ON DELETE RESTRICT,
  replacement_quote_id uuid REFERENCES public.supplier_quotes(id) ON DELETE SET NULL,
  trigger_type text NOT NULL
    CHECK (trigger_type IN ('validity_expiry','target_price_reduction','manual')),
  trigger_ref_id uuid,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','outreach_sent','quote_received','under_review','resolved','cancelled')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_reneg_cases_supplier ON public.renegotiation_cases(supplier_account_id);
CREATE INDEX idx_reneg_cases_status ON public.renegotiation_cases(status);
CREATE INDEX idx_reneg_cases_original_quote ON public.renegotiation_cases(original_quote_id);
CREATE INDEX idx_reneg_cases_assigned ON public.renegotiation_cases(assigned_to);

ALTER TABLE public.renegotiation_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view renegotiation_cases"
  ON public.renegotiation_cases FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage renegotiation_cases"
  ON public.renegotiation_cases FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_renegotiation_cases_updated_at
  BEFORE UPDATE ON public.renegotiation_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();