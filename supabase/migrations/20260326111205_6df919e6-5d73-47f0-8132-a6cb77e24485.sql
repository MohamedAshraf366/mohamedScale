
-- 1. Create supplier_quotes parent table
CREATE TABLE public.supplier_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_account_id uuid NOT NULL REFERENCES public.suppliers(account_id),
  status text NOT NULL DEFAULT 'quoted',
  source text NOT NULL DEFAULT 'manual',
  quotation_file_id uuid REFERENCES public.attachments(id),
  notes text,
  submitted_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

-- 2. Create supplier_quote_delivery_lines table
CREATE TABLE public.supplier_quote_delivery_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_quote_id uuid NOT NULL REFERENCES public.supplier_quotes(id) ON DELETE CASCADE,
  zone_codes text[] NOT NULL DEFAULT '{}',
  price_per_moq numeric NOT NULL,
  material_ids uuid[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Add supplier_quote_id FK to existing supplier_materials
ALTER TABLE public.supplier_materials
  ADD COLUMN supplier_quote_id uuid REFERENCES public.supplier_quotes(id);

-- 4. RLS for supplier_quotes
ALTER TABLE public.supplier_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view supplier_quotes"
  ON public.supplier_quotes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage supplier_quotes"
  ON public.supplier_quotes FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 5. RLS for supplier_quote_delivery_lines
ALTER TABLE public.supplier_quote_delivery_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view supplier_quote_delivery_lines"
  ON public.supplier_quote_delivery_lines FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage supplier_quote_delivery_lines"
  ON public.supplier_quote_delivery_lines FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 6. Migrate existing data: group supplier_materials by supplier + file into parent quotes
INSERT INTO public.supplier_quotes (supplier_account_id, status, source, quotation_file_id, created_at, updated_at, created_by)
SELECT
  sm.supplier_account_id,
  CASE
    WHEN bool_and(sm.status = 'approved') THEN 'approved'
    WHEN bool_or(sm.status = 'rejected') AND NOT bool_or(sm.status != 'rejected') THEN 'rejected'
    ELSE (array_agg(sm.status ORDER BY sm.created_at DESC))[1]
  END as status,
  CASE WHEN sm.quotation_file_id IS NOT NULL THEN 'ai_upload' ELSE 'manual' END as source,
  sm.quotation_file_id,
  min(sm.created_at),
  max(sm.updated_at),
  (array_agg(sm.created_by) FILTER (WHERE sm.created_by IS NOT NULL))[1]
FROM public.supplier_materials sm
WHERE sm.is_current = true
GROUP BY sm.supplier_account_id, sm.quotation_file_id;

-- 7. Link existing supplier_materials to their parent quotes
UPDATE public.supplier_materials sm
SET supplier_quote_id = sq.id
FROM public.supplier_quotes sq
WHERE sm.supplier_account_id = sq.supplier_account_id
  AND sm.is_current = true
  AND (sm.quotation_file_id IS NOT DISTINCT FROM sq.quotation_file_id);

-- 8. Index for fast lookups
CREATE INDEX idx_supplier_materials_quote_id ON public.supplier_materials(supplier_quote_id);
CREATE INDEX idx_supplier_quotes_supplier ON public.supplier_quotes(supplier_account_id);
CREATE INDEX idx_supplier_quote_delivery_lines_quote ON public.supplier_quote_delivery_lines(supplier_quote_id);
