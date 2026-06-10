
-- Fix SAL.0085: address had city/district swapped, correct address_text and clear review flag

-- Update location address_text to proper format (district first, then city)
UPDATE locations
SET address_text = 'حي العارض، الرياض',
    updated_at = now()
WHERE id = 'cf7104ad-c7b8-4b11-804f-9004c73c2d88';

-- Clear the needs_review flag from account metadata
UPDATE accounts
SET metadata = '{}'::jsonb,
    updated_at = now()
WHERE id = 'b154e22a-d293-455b-bcd9-8b0d73a14420';
