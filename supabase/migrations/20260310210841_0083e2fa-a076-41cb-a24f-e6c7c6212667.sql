
-- Fix 1: Add 'subject' to communications columns_doc in agent_table_schema
UPDATE public.agent_table_schema
SET columns_doc = columns_doc || '[{"name":"subject","type":"text","nullable":true,"description_en":"Short subject line for the communication","description_ar":"عنوان مختصر للتواصل"}]'::jsonb,
    updated_at = now()
WHERE table_name = 'communications';

-- Fix 2: Insert agent_table_schema row for communication_action_items
INSERT INTO public.agent_table_schema (table_name, module, description_en, description_ar, columns_doc, relationships, read_hints)
VALUES (
  'communication_action_items',
  'sales',
  'Action items / tasks created from a communication log entry',
  'بنود المتابعة الناتجة عن سجل تواصل',
  '[
    {"name":"id","type":"uuid","nullable":false,"description_en":"Primary key","description_ar":"المعرف"},
    {"name":"communication_id","type":"uuid","nullable":false,"description_en":"FK to communications","description_ar":"معرف التواصل"},
    {"name":"title","type":"text","nullable":false,"description_en":"Action item title","description_ar":"عنوان البند"},
    {"name":"status","type":"text","nullable":false,"description_en":"open | done | cancelled","description_ar":"الحالة"},
    {"name":"priority","type":"text","nullable":false,"description_en":"low | medium | high | urgent","description_ar":"الأولوية"},
    {"name":"due_at","type":"timestamptz","nullable":true,"description_en":"Due date/time","description_ar":"تاريخ الاستحقاق"},
    {"name":"assigned_to","type":"uuid","nullable":true,"description_en":"FK to profiles.id","description_ar":"المسؤول"},
    {"name":"details","type":"text","nullable":true,"description_en":"Additional details","description_ar":"تفاصيل إضافية"}
  ]'::jsonb,
  '[{"table":"communications","fk":"communication_id","type":"belongs_to"}]'::jsonb,
  '[{"hint_en":"Filter by status=open for pending items","hint_ar":"فلتر بالحالة=open للبنود المعلقة"}]'::jsonb
)
ON CONFLICT (table_name) DO NOTHING;
