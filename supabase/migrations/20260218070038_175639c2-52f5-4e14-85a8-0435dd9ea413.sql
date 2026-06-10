
WITH 
block_types(val, label, pos) AS (VALUES 
  ('regular', 'Regular', 0), ('steamed', 'Steamed', 1), ('volcanic', 'Volcanic', 2)
),
insulations(val, label, pos) AS (VALUES 
  ('uninsulated', 'Uninsulated', 0), ('sandwich_blue', 'Sandwich Blue', 1), 
  ('sandwich_white', 'Sandwich White', 2), ('inserted_blue', 'Inserted Blue', 3), 
  ('inserted_white', 'Inserted White', 4)
),
holes(val, label, pos) AS (VALUES 
  ('2_holes', '2 Holes', 0), ('3_holes', '3 Holes', 1),
  ('4_holes', '4 Holes', 2), ('6_holes', '6 Holes', 3), ('8_holes', '8 Holes', 4),
  ('10_holes', '10 Holes', 5), ('12_holes', '12 Holes', 6)
),
sizes(sz, vno) AS (VALUES (10, 1), (15, 2), (20, 3), (25, 4), (30, 5)),
combos AS (
  SELECT b.val as bval, b.label as blabel,
         i.val as ival, i.label as ilabel,
         h.val as hval, h.label as hlabel,
         s.sz, s.vno,
         16 + (b.pos * 35) + (i.pos * 7) + h.pos as mat_no
  FROM block_types b CROSS JOIN insulations i CROSS JOIN holes h CROSS JOIN sizes s
)
INSERT INTO materials (subcategory_id, material_no, variant_no, name, name_en, uom, status, specs)
SELECT 
  'ee074bee-16e6-45dc-b143-196e45d5a965',
  c.mat_no::smallint,
  c.vno::smallint,
  'Cement block: ' || c.blabel || ', ' || c.ilabel || ', ' || c.hlabel || ', ' || c.sz || ' cm',
  'Cement block: ' || c.blabel || ', ' || c.ilabel || ', ' || c.hlabel || ', ' || c.sz || ' cm',
  'unit',
  'active',
  jsonb_build_object(
    'product_family', 'cement_block',
    'block_type', c.bval,
    'insulation_spec', c.ival,
    'holes_spec', c.hval,
    'size_cm', c.sz::text
  )
FROM combos c;
