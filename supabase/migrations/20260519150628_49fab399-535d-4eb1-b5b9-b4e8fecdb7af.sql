WITH norm AS (
  SELECT id, phone,
    CASE WHEN regexp_replace(phone,'\s+','','g') LIKE '05%'
         THEN '9665' || substring(regexp_replace(phone,'\s+','','g') FROM 3)
         ELSE regexp_replace(phone,'\s+','','g') END AS new_phone
  FROM public.contacts WHERE phone IS NOT NULL
),
changed AS (
  SELECT id, phone, new_phone FROM norm WHERE new_phone <> phone
),
safe AS (
  SELECT c.id, c.new_phone
  FROM changed c
  WHERE NOT EXISTS (SELECT 1 FROM public.contacts c2 WHERE c2.phone = c.new_phone AND c2.id <> c.id)
    AND (SELECT COUNT(*) FROM changed c3 WHERE c3.new_phone = c.new_phone) = 1
)
UPDATE public.contacts c
SET phone = s.new_phone
FROM safe s
WHERE c.id = s.id;