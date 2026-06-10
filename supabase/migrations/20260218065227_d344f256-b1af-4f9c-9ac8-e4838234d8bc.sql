
-- Part 1a: Add spec_definitions to material_subcategories
ALTER TABLE public.material_subcategories
  ADD COLUMN IF NOT EXISTS spec_definitions jsonb DEFAULT '[]'::jsonb;

-- Part 1c: Add variant_definitions to material_subcategories
ALTER TABLE public.material_subcategories
  ADD COLUMN IF NOT EXISTS variant_definitions jsonb DEFAULT '{}'::jsonb;

-- Part 1b: Add image_url to materials
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS image_url text;

-- Part 1d: Create material-images storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('material-images', 'material-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: anyone can view
CREATE POLICY "Material images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'material-images');

-- Storage RLS: authenticated users can upload
CREATE POLICY "Authenticated users can upload material images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'material-images' AND auth.role() = 'authenticated');

-- Storage RLS: authenticated users can update their uploads
CREATE POLICY "Authenticated users can update material images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'material-images' AND auth.role() = 'authenticated');

-- Storage RLS: authenticated users can delete
CREATE POLICY "Authenticated users can delete material images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'material-images' AND auth.role() = 'authenticated');

-- Part 1e: Seed spec_definitions for Cement Block subcategory
UPDATE public.material_subcategories
SET spec_definitions = '[
  {
    "key": "block_type",
    "label_en": "Block Type",
    "label_ar": "نوع البلوك",
    "options": [
      { "value": "regular", "code_digit": "1", "label_en": "Regular", "label_ar": "عادي" },
      { "value": "steamed", "code_digit": "2", "label_en": "Steamed", "label_ar": "مبخر" },
      { "value": "volcanic", "code_digit": "3", "label_en": "Volcanic", "label_ar": "بركاني" }
    ]
  },
  {
    "key": "insulation_spec",
    "label_en": "Insulation",
    "label_ar": "العزل",
    "options": [
      { "value": "uninsulated", "code_digit": "1", "label_en": "Uninsulated", "label_ar": "بدون عزل" },
      { "value": "sandwich_blue", "code_digit": "2", "label_en": "Sandwich Blue", "label_ar": "ساندويتش أزرق" },
      { "value": "sandwich_white", "code_digit": "3", "label_en": "Sandwich White", "label_ar": "ساندويتش أبيض" },
      { "value": "inserted_blue", "code_digit": "4", "label_en": "Inserted Blue", "label_ar": "مدرج أزرق" },
      { "value": "inserted_white", "code_digit": "5", "label_en": "Inserted White", "label_ar": "مدرج أبيض" }
    ]
  },
  {
    "key": "holes_spec",
    "label_en": "Holes",
    "label_ar": "الثقوب",
    "options": [
      { "value": "solid", "code_digit": "0", "label_en": "Solid", "label_ar": "مصمت" },
      { "value": "2_holes", "code_digit": "1", "label_en": "2 Holes", "label_ar": "2 ثقوب" },
      { "value": "3_holes", "code_digit": "2", "label_en": "3 Holes", "label_ar": "3 ثقوب" },
      { "value": "4_holes", "code_digit": "3", "label_en": "4 Holes", "label_ar": "4 ثقوب" },
      { "value": "6_holes", "code_digit": "4", "label_en": "6 Holes", "label_ar": "6 ثقوب" },
      { "value": "8_holes", "code_digit": "5", "label_en": "8 Holes", "label_ar": "8 ثقوب" },
      { "value": "10_holes", "code_digit": "6", "label_en": "10 Holes", "label_ar": "10 ثقوب" },
      { "value": "12_holes", "code_digit": "7", "label_en": "12 Holes", "label_ar": "12 ثقوب" }
    ]
  }
]'::jsonb,
variant_definitions = '{
  "key": "size_cm",
  "label_en": "Size (cm)",
  "label_ar": "المقاس (سم)",
  "options": ["10", "15", "20", "25", "30"]
}'::jsonb
WHERE id = 'ee074bee-16e6-45dc-b143-196e45d5a965';
