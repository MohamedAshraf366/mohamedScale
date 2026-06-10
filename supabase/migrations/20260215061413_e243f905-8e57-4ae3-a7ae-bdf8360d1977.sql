UPDATE pdf_templates 
SET settings = jsonb_set(settings, '{primary_color}', '"#f15625"')
WHERE template_key IN ('quotation', 'pricelist');