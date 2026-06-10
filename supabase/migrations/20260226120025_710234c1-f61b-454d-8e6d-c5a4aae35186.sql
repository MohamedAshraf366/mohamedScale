
-- Flag contacts with placeholder name "لم يرد"
UPDATE accounts SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{needs_review}', '"contact: name is placeholder (لم يرد)"')
WHERE id IN (
  SELECT a.id FROM accounts a
  JOIN contacts c ON c.account_id = a.id AND c.is_primary = true
  WHERE c.full_name = 'لم يرد'
) AND (metadata->>'needs_review') IS NULL;

-- Flag contacts where name = company display name
UPDATE accounts SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{needs_review}', '"contact: name is same as company name"')
WHERE id IN (
  SELECT a.id FROM accounts a
  JOIN contacts c ON c.account_id = a.id AND c.is_primary = true
  WHERE c.full_name = a.display_name
) AND (metadata->>'needs_review') IS NULL;
