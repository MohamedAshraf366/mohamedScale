ALTER TABLE public.materials ALTER COLUMN uom DROP NOT NULL;
ALTER TABLE public.materials ALTER COLUMN uom DROP DEFAULT;
UPDATE public.materials SET uom = NULL WHERE uom IS NOT NULL;