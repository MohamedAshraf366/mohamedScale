-- ============================================
-- REGIONS & ZONES MAP MANAGEMENT SYSTEM
-- Phase 1: Database Schema Setup (Fixed)
-- ============================================

-- 1. Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. Create regions table for KSA cities
CREATE TABLE public.regions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ar TEXT,
  boundary_geojson JSONB,
  center_lat DECIMAL(10, 7),
  center_lng DECIMAL(10, 7),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- 3. Add region-related columns to zones table
ALTER TABLE public.zones
ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS code TEXT,
ADD COLUMN IF NOT EXISTS display_code TEXT;

-- 4. Create index for faster lookups
CREATE INDEX idx_zones_region_id ON public.zones(region_id);
CREATE INDEX idx_regions_code ON public.regions(code);
CREATE INDEX idx_zones_display_code ON public.zones(display_code);

-- 5. Enable RLS on regions
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for regions
CREATE POLICY "Authenticated users can view regions"
ON public.regions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert regions"
ON public.regions
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update regions"
ON public.regions
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete regions"
ON public.regions
FOR DELETE
TO authenticated
USING (true);

-- 7. Trigger to auto-update updated_at on regions
CREATE TRIGGER update_regions_updated_at
BEFORE UPDATE ON public.regions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Function to generate zone display_code
CREATE OR REPLACE FUNCTION public.generate_zone_display_code()
RETURNS TRIGGER AS $$
DECLARE
  region_code TEXT;
BEGIN
  -- Get the region code
  IF NEW.region_id IS NOT NULL THEN
    SELECT code INTO region_code FROM public.regions WHERE id = NEW.region_id;
    
    -- If zone code is not set, generate it
    IF NEW.code IS NULL THEN
      NEW.code := LPAD(
        (SELECT COALESCE(MAX(NULLIF(z.code, '')::INTEGER), 0) + 1 
         FROM public.zones z 
         WHERE z.region_id = NEW.region_id)::TEXT, 
        3, 
        '0'
      );
    END IF;
    
    -- Generate display_code
    NEW.display_code := region_code || '.' || NEW.code;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 9. Trigger for auto-generating zone display_code
CREATE TRIGGER generate_zone_display_code_trigger
BEFORE INSERT OR UPDATE ON public.zones
FOR EACH ROW
EXECUTE FUNCTION public.generate_zone_display_code();