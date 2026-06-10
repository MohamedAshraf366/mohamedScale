
-- Migration A: Supplier Quotes system

-- 1. Create supplier_quotes parent table
CREATE TABLE IF NOT EXISTS public.supplier_quotes (
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
CREATE TABLE IF NOT EXISTS public.supplier_quote_delivery_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_quote_id uuid NOT NULL REFERENCES public.supplier_quotes(id) ON DELETE CASCADE,
  zone_codes text[] NOT NULL DEFAULT '{}',
  price_per_moq numeric NOT NULL,
  material_ids uuid[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Add supplier_quote_id FK to existing supplier_materials (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'supplier_materials' AND column_name = 'supplier_quote_id'
  ) THEN
    ALTER TABLE public.supplier_materials ADD COLUMN supplier_quote_id uuid REFERENCES public.supplier_quotes(id);
  END IF;
END $$;

-- 4. RLS for supplier_quotes
ALTER TABLE public.supplier_quotes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_quotes' AND policyname = 'Authenticated users can view supplier_quotes') THEN
    CREATE POLICY "Authenticated users can view supplier_quotes"
      ON public.supplier_quotes FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_quotes' AND policyname = 'Authenticated users can manage supplier_quotes') THEN
    CREATE POLICY "Authenticated users can manage supplier_quotes"
      ON public.supplier_quotes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 5. RLS for supplier_quote_delivery_lines
ALTER TABLE public.supplier_quote_delivery_lines ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_quote_delivery_lines' AND policyname = 'Authenticated users can view supplier_quote_delivery_lines') THEN
    CREATE POLICY "Authenticated users can view supplier_quote_delivery_lines"
      ON public.supplier_quote_delivery_lines FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_quote_delivery_lines' AND policyname = 'Authenticated users can manage supplier_quote_delivery_lines') THEN
    CREATE POLICY "Authenticated users can manage supplier_quote_delivery_lines"
      ON public.supplier_quote_delivery_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 6. Migrate existing supplier_materials into parent quotes (only if no quotes exist yet)
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
  AND sm.supplier_quote_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.supplier_quotes LIMIT 1)
GROUP BY sm.supplier_account_id, sm.quotation_file_id;

-- 7. Link existing supplier_materials to their parent quotes (only unlinked ones)
UPDATE public.supplier_materials sm
SET supplier_quote_id = sq.id
FROM public.supplier_quotes sq
WHERE sm.supplier_account_id = sq.supplier_account_id
  AND sm.is_current = true
  AND sm.supplier_quote_id IS NULL
  AND (sm.quotation_file_id IS NOT DISTINCT FROM sq.quotation_file_id);

-- 8. Indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_supplier_materials_quote_id ON public.supplier_materials(supplier_quote_id);
CREATE INDEX IF NOT EXISTS idx_supplier_quotes_supplier ON public.supplier_quotes(supplier_account_id);
CREATE INDEX IF NOT EXISTS idx_supplier_quote_delivery_lines_quote ON public.supplier_quote_delivery_lines(supplier_quote_id);
