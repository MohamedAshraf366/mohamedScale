UPDATE materials
SET name = regexp_replace(name, ',\s*(\d+\s*cm)$', ', Solid, \1')
WHERE specs->>'holes_spec' = 'solid'
  AND name !~ 'Solid';