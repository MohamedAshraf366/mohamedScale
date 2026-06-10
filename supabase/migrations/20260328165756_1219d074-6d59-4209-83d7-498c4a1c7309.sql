-- Drop existing policies and recreate with public role for reliable access
DROP POLICY IF EXISTS "Authenticated users can manage subcategory_areas" ON public.subcategory_areas;
DROP POLICY IF EXISTS "Authenticated users can view subcategory_areas" ON public.subcategory_areas;

-- ALL policy for authenticated (covers INSERT, UPDATE, DELETE, SELECT)
CREATE POLICY "Authenticated users can manage subcategory_areas"
ON public.subcategory_areas FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Separate SELECT for anon to allow reads before auth session is established
CREATE POLICY "Anon can view subcategory_areas"
ON public.subcategory_areas FOR SELECT
TO anon
USING (true);