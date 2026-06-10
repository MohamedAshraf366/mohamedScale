-- Populate name_ar for all cement block materials using spec definitions
UPDATE materials
SET name_ar = 
  'بلوك اسمنتي: ' ||
  CASE (specs->>'block_type')
    WHEN 'regular' THEN 'عادي'
    WHEN 'steamed' THEN 'مبخر'
    WHEN 'volcanic' THEN 'بركاني'
    ELSE specs->>'block_type'
  END || ', ' ||
  CASE (specs->>'insulation_spec')
    WHEN 'uninsulated' THEN 'بدون عزل'
    WHEN 'sandwich_blue' THEN 'ساندويتش أزرق'
    WHEN 'sandwich_white' THEN 'ساندويتش أبيض'
    WHEN 'inserted_blue' THEN 'مدرج أزرق'
    WHEN 'inserted_white' THEN 'مدرج أبيض'
    ELSE specs->>'insulation_spec'
  END || ', ' ||
  CASE (specs->>'holes_spec')
    WHEN 'solid' THEN 'مصمت'
    WHEN '2_holes' THEN '2 ثقوب'
    WHEN '3_holes' THEN '3 ثقوب'
    WHEN '4_holes' THEN '4 ثقوب'
    WHEN '6_holes' THEN '6 ثقوب'
    WHEN '8_holes' THEN '8 ثقوب'
    WHEN '10_holes' THEN '10 ثقوب'
    WHEN '12_holes' THEN '12 ثقوب'
    ELSE specs->>'holes_spec'
  END || ', ' ||
  (specs->>'size_cm') || ' سم'
WHERE specs->>'product_family' = 'cement_block'
  AND name_ar IS NULL;