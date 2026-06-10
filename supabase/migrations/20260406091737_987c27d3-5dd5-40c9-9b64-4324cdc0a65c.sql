-- Drop the target price trigger that blocks supplier_materials inserts
DROP TRIGGER IF EXISTS trg_check_target_price ON public.supplier_materials;
DROP FUNCTION IF EXISTS public.check_target_price();

-- Add is_default column to delivery_rates
ALTER TABLE public.delivery_rates ADD COLUMN is_default boolean NOT NULL DEFAULT false;

-- Mark all existing delivery rates as defaults and clear their material IDs
UPDATE public.delivery_rates SET is_default = true, supplier_material_ids = '{}';

-- Create storage bucket for supplier quote attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('supplier-quotes', 'supplier-quotes', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for supplier-quotes bucket
CREATE POLICY "Authenticated users can upload supplier quotes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'supplier-quotes');

CREATE POLICY "Authenticated users can view supplier quotes"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'supplier-quotes');

CREATE POLICY "Authenticated users can delete supplier quotes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'supplier-quotes');