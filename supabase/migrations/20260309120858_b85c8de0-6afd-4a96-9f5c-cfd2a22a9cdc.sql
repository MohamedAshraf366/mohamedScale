
-- 1. Deactivate old individual add_* intents and schedule_task
UPDATE public.agent_actions SET status = 'archived' WHERE intent_key IN ('add_customer_v2', 'add_project_v2', 'add_opportunity_v2', 'schedule_task_v2');

-- 2. Insert create_entity_v2 (merged intent)
INSERT INTO public.agent_actions (intent_key, title_en, title_ar, status, menu_order, tool_name, tables, keywords, example_phrases_en, example_phrases_ar, main_fields)
VALUES (
  'create_entity_v2',
  'Add Customer / Project / Opportunity',
  'إضافة عميل / مشروع / فرصة',
  'active',
  10,
  'write_data',
  ARRAY['accounts','contacts','customers','projects','opportunities','communications','tasks'],
  ARRAY['add','create','new','customer','project','opportunity','عميل','مشروع','فرصة','جديد'],
  ARRAY['Add a new customer called X','Create project Y for customer Z','New opportunity for customer X project Y'],
  ARRAY['أضف عميل جديد اسمه X','أنشئ مشروع Y للعميل Z','فرصة جديدة للعميل X مشروع Y'],
  '{
    "sections": {
      "customer": {"required": true, "mode": "create_or_select", "description": "Create new or select existing customer"},
      "project": {"required": false, "mode": "create_or_select_or_default", "description": "Create new, select existing, or auto-create General project"},
      "opportunity": {"required": false, "mode": "create", "description": "Optionally create a new opportunity"},
      "context": {"required": true, "description": "Summary of the interaction or reason for creation"},
      "next_action": {"required": true, "description": "Schedule a follow-up task"}
    },
    "business_rules": [
      "Customer is always required (create or select)",
      "If opportunity is created without a project, auto-create a General project",
      "Context and Next Action are mandatory for every write",
      "If interest_level is Not interested, auto-mark opportunity as lost"
    ]
  }'::jsonb
)
ON CONFLICT (intent_key) DO UPDATE SET
  title_en = EXCLUDED.title_en,
  title_ar = EXCLUDED.title_ar,
  status = EXCLUDED.status,
  menu_order = EXCLUDED.menu_order,
  tool_name = EXCLUDED.tool_name,
  tables = EXCLUDED.tables,
  keywords = EXCLUDED.keywords,
  example_phrases_en = EXCLUDED.example_phrases_en,
  example_phrases_ar = EXCLUDED.example_phrases_ar,
  main_fields = EXCLUDED.main_fields,
  updated_at = now();

-- 3. Insert send_document_v2
INSERT INTO public.agent_actions (intent_key, title_en, title_ar, status, menu_order, tool_name, tables, keywords, example_phrases_en, example_phrases_ar, main_fields)
VALUES (
  'send_document_v2',
  'Send Quotation / Price List',
  'إرسال عرض سعر / قائمة أسعار',
  'active',
  50,
  'write_data',
  ARRAY['quotations','communications','tasks'],
  ARRAY['send','quotation','price list','pricelist','mark sent','إرسال','عرض سعر','قائمة أسعار'],
  ARRAY['Send quotation for opportunity X','Mark price list as sent for X','Send the quote to customer Y'],
  ARRAY['أرسل عرض السعر للفرصة X','علّم قائمة الأسعار كمرسلة','أرسل العرض للعميل Y'],
  '{
    "sections": {
      "opportunity": {"required": true, "mode": "select", "description": "Select the opportunity to send document for"},
      "document_type": {"required": true, "values": ["quotation", "pricelist"], "description": "Type of document to send"},
      "context": {"required": true, "description": "Communication log: channel and summary of how/when it was sent"},
      "next_action": {"required": true, "description": "Follow-up task after sending"}
    },
    "business_rules": [
      "For quotation: all items must have quantities, supplier prices, and delivery rates",
      "For pricelist: at least one quotation item must exist",
      "Marks quotation.sent_at timestamp",
      "Logs a communication with metadata.document_type",
      "Creates follow-up task",
      "Returns PDF download URL after commit"
    ],
    "validations": {
      "quotation": "All quotation_items must have supplier_material_id, quantity > 0, and matching delivery_rate for project zone",
      "pricelist": "At least one active quotation_item must exist"
    }
  }'::jsonb
)
ON CONFLICT (intent_key) DO UPDATE SET
  title_en = EXCLUDED.title_en,
  title_ar = EXCLUDED.title_ar,
  status = EXCLUDED.status,
  menu_order = EXCLUDED.menu_order,
  tool_name = EXCLUDED.tool_name,
  tables = EXCLUDED.tables,
  keywords = EXCLUDED.keywords,
  example_phrases_en = EXCLUDED.example_phrases_en,
  example_phrases_ar = EXCLUDED.example_phrases_ar,
  main_fields = EXCLUDED.main_fields,
  updated_at = now();

-- 4. Insert get_document_v2
INSERT INTO public.agent_actions (intent_key, title_en, title_ar, status, menu_order, tool_name, tables, keywords, example_phrases_en, example_phrases_ar, main_fields)
VALUES (
  'get_document_v2',
  'Get Draft Document',
  'تحميل مسودة المستند',
  'active',
  55,
  'read_data',
  ARRAY['quotations','quotation_items'],
  ARRAY['download','draft','preview','pdf','document','تحميل','مسودة','معاينة'],
  ARRAY['Get the draft quotation for opportunity X','Download price list preview','Show me the draft for X'],
  ARRAY['حمّل مسودة عرض السعر للفرصة X','معاينة قائمة الأسعار','أعطني المسودة'],
  '{
    "sections": {
      "opportunity": {"required": true, "mode": "select", "description": "Select the opportunity"},
      "document_type": {"required": true, "values": ["quotation", "pricelist"], "description": "Type of document to preview"}
    },
    "business_rules": [
      "Read-only: no state changes",
      "Generates on-the-fly PDF with DRAFT watermark",
      "Returns download URL",
      "Requires at least one quotation_item to exist"
    ]
  }'::jsonb
)
ON CONFLICT (intent_key) DO UPDATE SET
  title_en = EXCLUDED.title_en,
  title_ar = EXCLUDED.title_ar,
  status = EXCLUDED.status,
  menu_order = EXCLUDED.menu_order,
  tool_name = EXCLUDED.tool_name,
  tables = EXCLUDED.tables,
  keywords = EXCLUDED.keywords,
  example_phrases_en = EXCLUDED.example_phrases_en,
  example_phrases_ar = EXCLUDED.example_phrases_ar,
  main_fields = EXCLUDED.main_fields,
  updated_at = now();
