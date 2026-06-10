
ALTER TABLE public.supplier_materials
  DROP CONSTRAINT IF EXISTS supplier_materials_status_check;

ALTER TABLE public.supplier_materials
  ADD CONSTRAINT supplier_materials_status_check
  CHECK (
    status IN (
      'quoted',
      'under_review',
      'rejected',
      'negotiating',
      'approved',
      'passed',
      'shortlisted'
    )
  );

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS is_blacklisted boolean NOT NULL DEFAULT false;
