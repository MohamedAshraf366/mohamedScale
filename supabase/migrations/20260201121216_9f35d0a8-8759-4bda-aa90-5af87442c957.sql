-- Update test opportunities with materials_interest data

UPDATE opportunities SET materials_interest = '[
  {"material_id": "b0d5a1d2-23cd-4048-8519-8c824d7350d5", "name": "Cement block: Regular, Uninsulated, 10 cm", "quantity": 5000, "uom": "piece"},
  {"material_id": "e15f9111-c211-492f-9a0b-616c7ac3bccf", "name": "Cement block: Regular, Uninsulated, 15 cm", "quantity": 3000, "uom": "piece"}
]'::jsonb
WHERE id = 'a0000001-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

UPDATE opportunities SET materials_interest = '[
  {"material_id": "ec359e6f-a2f1-4016-8807-476819dd856b", "name": "Cement block: Regular, Uninsulated, 20 cm", "quantity": 8000, "uom": "piece"},
  {"material_id": "d6ac9554-0b11-4b5d-885a-4e2ce78cdec5", "name": "Cement block: Regular, Uninsulated, 25 cm", "quantity": 2500, "uom": "piece"},
  {"material_id": "79099f6e-3090-4e4f-8538-6f1a130d2f5b", "name": "Cement block: Regular, Uninsulated, 30 cm", "quantity": 1500, "uom": "piece"}
]'::jsonb
WHERE id = 'a0000002-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

UPDATE opportunities SET materials_interest = '[
  {"material_id": "453e3109-5453-4dec-9c48-3e28b5e1f1fd", "name": "Cement block: Regular, Sandwich Blue, 10 cm", "quantity": 10000, "uom": "piece"},
  {"material_id": "b0d5a1d2-23cd-4048-8519-8c824d7350d5", "name": "Cement block: Regular, Uninsulated, 10 cm", "quantity": 4000, "uom": "piece"}
]'::jsonb
WHERE id = 'a0000003-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

UPDATE opportunities SET materials_interest = '[
  {"material_id": "e15f9111-c211-492f-9a0b-616c7ac3bccf", "name": "Cement block: Regular, Uninsulated, 15 cm", "quantity": 1200, "uom": "piece"}
]'::jsonb
WHERE id = 'a0000004-cccc-4ccc-cccc-cccccccccccc';

UPDATE opportunities SET materials_interest = '[
  {"material_id": "ec359e6f-a2f1-4016-8807-476819dd856b", "name": "Cement block: Regular, Uninsulated, 20 cm", "quantity": 6000, "uom": "piece"},
  {"material_id": "79099f6e-3090-4e4f-8538-6f1a130d2f5b", "name": "Cement block: Regular, Uninsulated, 30 cm", "quantity": 3500, "uom": "piece"}
]'::jsonb
WHERE id = 'a0000005-bbbb-4bbb-bbbb-bbbbbbbbbbbb';