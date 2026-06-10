-- Assign AI-generated images to materials based on block_type + insulation_spec
-- Images are served from the public folder

-- Regular + Uninsulated (all holes)
UPDATE materials SET image_url = '/materials/cement-block-regular-uninsulated-solid.jpg'
WHERE specs->>'block_type' = 'regular' AND specs->>'insulation_spec' = 'uninsulated';

-- Regular + Sandwich Blue
UPDATE materials SET image_url = '/materials/cement-block-regular-sandwich-blue.jpg'
WHERE specs->>'block_type' = 'regular' AND specs->>'insulation_spec' = 'sandwich_blue';

-- Regular + Sandwich White
UPDATE materials SET image_url = '/materials/cement-block-regular-sandwich-white.jpg'
WHERE specs->>'block_type' = 'regular' AND specs->>'insulation_spec' = 'sandwich_white';

-- Regular + Inserted Blue
UPDATE materials SET image_url = '/materials/cement-block-regular-inserted-blue.jpg'
WHERE specs->>'block_type' = 'regular' AND specs->>'insulation_spec' = 'inserted_blue';

-- Regular + Inserted White
UPDATE materials SET image_url = '/materials/cement-block-regular-inserted-white.jpg'
WHERE specs->>'block_type' = 'regular' AND specs->>'insulation_spec' = 'inserted_white';

-- Steamed (all insulations use same base steamed image for now)
UPDATE materials SET image_url = '/materials/cement-block-steamed-uninsulated-solid.jpg'
WHERE specs->>'block_type' = 'steamed';

-- Volcanic (all insulations use same base volcanic image for now)
UPDATE materials SET image_url = '/materials/cement-block-volcanic-uninsulated-solid.jpg'
WHERE specs->>'block_type' = 'volcanic';