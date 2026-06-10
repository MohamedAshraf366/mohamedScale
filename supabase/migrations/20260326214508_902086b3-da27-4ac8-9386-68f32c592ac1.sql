
-- Migration C: Delete only "Test Categery" (code2='TE')
-- Cascade will handle subcategories -> materials via FK constraints

-- Delete materials under TE subcategories
DELETE FROM public.materials
WHERE subcategory_id IN (
  SELECT id FROM public.material_subcategories
  WHERE category_id = '9833ce5a-a0e9-42f7-b329-32d685de8c3b'
);

-- Delete subcategories under TE
DELETE FROM public.material_subcategories
WHERE category_id = '9833ce5a-a0e9-42f7-b329-32d685de8c3b';

-- Delete the TE category itself
DELETE FROM public.material_categories
WHERE id = '9833ce5a-a0e9-42f7-b329-32d685de8c3b';
