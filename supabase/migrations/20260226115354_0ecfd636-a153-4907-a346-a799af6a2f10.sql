
-- Flag customers that need manual review after migration
-- 1. شركه اساكن - phone is 11 digits (missing a digit)
UPDATE accounts SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{needs_review}', '"phone: 11 digits instead of 12 (96655860979) - missing digit"')
WHERE id = '2e77df6f-4e51-46de-8bd1-ca4a0ae90c56';

-- 2. مؤسسه أرض المصمم - phone was a URL, set to NULL
UPDATE accounts SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{needs_review}', '"phone: missing (original was a Google Maps URL)"')
WHERE id = '233b39f6-d382-46c5-abc3-a012bd695574';

-- 3. مؤسسه الذكاء المعماري - city/district appear swapped
UPDATE accounts SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{needs_review}', '"location: city and district may be swapped (city=العارض, district=الرياض)"')
WHERE id = 'b154e22a-d293-455b-bcd9-8b0d73a14420';
