-- Add supplier_material linking and status tracking to quotation_items
ALTER TABLE quotation_items 
ADD COLUMN IF NOT EXISTS supplier_material_id uuid REFERENCES supplier_materials(id),
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS removed_at timestamptz,
ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

-- Add version tracking and delivery date to quotations
ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS est_delivery_date date;

-- Add constraint for item status (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotation_items_status_check'
  ) THEN
    ALTER TABLE quotation_items 
    ADD CONSTRAINT quotation_items_status_check 
    CHECK (status IN ('active', 'removed', 'cancelled'));
  END IF;
END $$;