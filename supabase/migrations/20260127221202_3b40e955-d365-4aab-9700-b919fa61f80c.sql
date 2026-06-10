-- Add new columns to supplier_materials table for workflow tracking
ALTER TABLE public.supplier_materials
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'quoted',
ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS quotation_file_id uuid NULL;

-- Add check constraint for valid status values
ALTER TABLE public.supplier_materials
ADD CONSTRAINT supplier_materials_status_check 
CHECK (status IN ('quoted', 'under_review', 'rejected', 'negotiating', 'approved'));

-- Add index on status for filtering
CREATE INDEX IF NOT EXISTS idx_supplier_materials_status ON public.supplier_materials(status);

-- Add foreign key to attachments for quotation file (optional link)
ALTER TABLE public.supplier_materials
ADD CONSTRAINT supplier_materials_quotation_file_id_fkey 
FOREIGN KEY (quotation_file_id) REFERENCES public.attachments(id) ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.supplier_materials.status IS 'Workflow status: quoted, under_review, rejected, negotiating, approved';
COMMENT ON COLUMN public.supplier_materials.metadata IS 'Additional unmapped data from quotations';
COMMENT ON COLUMN public.supplier_materials.quotation_file_id IS 'Link to uploaded quotation file attachment';