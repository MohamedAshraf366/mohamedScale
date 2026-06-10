-- Create kpi_targets table for configurable dashboard targets
CREATE TABLE public.kpi_targets (
  period_key TEXT NOT NULL PRIMARY KEY CHECK (period_key IN ('week', 'month', 'year', 'custom')),
  targets JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.kpi_targets ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read targets
CREATE POLICY "Authenticated users can view kpi_targets"
  ON public.kpi_targets FOR SELECT TO authenticated
  USING (true);

-- Only admins can manage targets
CREATE POLICY "Admins can manage kpi_targets"
  ON public.kpi_targets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed default values
INSERT INTO public.kpi_targets (period_key, targets) VALUES
  ('week',   '{"orderingClients": 2, "wonDeals": 3, "revenue": 100000, "conversionRate": 0.2, "pipelineConvRate": 0.25, "avgSaleSize": 50000}'::jsonb),
  ('month',  '{"orderingClients": 5, "wonDeals": 10, "revenue": 500000, "conversionRate": 0.25, "pipelineConvRate": 0.3, "avgSaleSize": 60000}'::jsonb),
  ('year',   '{"orderingClients": 20, "wonDeals": 50, "revenue": 5000000, "conversionRate": 0.3, "pipelineConvRate": 0.35, "avgSaleSize": 80000}'::jsonb),
  ('custom', '{"orderingClients": 10, "wonDeals": 20, "revenue": 1000000, "conversionRate": 0.25, "pipelineConvRate": 0.3, "avgSaleSize": 60000}'::jsonb);

-- Auto-update updated_at
CREATE TRIGGER update_kpi_targets_updated_at
  BEFORE UPDATE ON public.kpi_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();