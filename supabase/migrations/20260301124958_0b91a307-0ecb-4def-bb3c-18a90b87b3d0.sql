
UPDATE accounts 
SET metadata = jsonb_set(metadata, '{is_example}', 'false'),
    deleted_at = now(),
    deleted_reason = 'Duplicate example account cleanup'
WHERE id IN (
  '47d36816-2bed-45dc-84eb-d9413a0277dc',
  'c3f7ec24-6153-4421-a6f0-e2520d0d4cf8',
  '2315f23c-1289-47e6-bc7f-acd4dd9e3f56'
);
