
-- Create pdf_templates table for customizable document templates
CREATE TABLE public.pdf_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  name text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.pdf_templates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Authenticated users can view pdf_templates"
  ON public.pdf_templates FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update
CREATE POLICY "Admins can insert pdf_templates"
  ON public.pdf_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update pdf_templates"
  ON public.pdf_templates FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed default templates
INSERT INTO public.pdf_templates (template_key, name, settings) VALUES
('quotation', 'Official Quotation', '{
  "company_name": "SCALE",
  "tagline": "Building Materials Simplified",
  "primary_color": "#2980B9",
  "footer_left": "Version {{version}} - Generated {{date}}",
  "footer_right": "Prices valid for 7 days from issue date",
  "pricelist_note": "* Prices are per unit. Final total depends on confirmed quantities.",
  "terms_text": "",
  "show_supplier_name": true,
  "show_delivery_column": true,
  "show_contact_phone": true,
  "show_delivery_section": true,
  "labels": {
    "en": {
      "document_title": "QUOTATION",
      "customer": "Customer",
      "contact": "Contact",
      "date": "Date",
      "project": "Project",
      "delivery_location": "Delivery Location",
      "delivery_details": "DELIVERY DETAILS",
      "est_delivery": "Est. Delivery",
      "subtotal": "Subtotal",
      "delivery": "Delivery",
      "total": "Total"
    },
    "ar": {
      "document_title": "عرض سعر",
      "customer": "العميل",
      "contact": "جهة الاتصال",
      "date": "التاريخ",
      "project": "المشروع",
      "delivery_location": "موقع التسليم",
      "delivery_details": "تفاصيل التسليم",
      "est_delivery": "التسليم المتوقع",
      "subtotal": "المجموع الفرعي",
      "delivery": "التوصيل",
      "total": "الإجمالي"
    }
  },
  "columns": {
    "en": {
      "num": "#",
      "item": "Item Description",
      "uom": "UOM",
      "qty": "QTY",
      "unit_price": "Unit Price",
      "total": "Total",
      "delivery": "Delivery",
      "supplier": "Supplier"
    },
    "ar": {
      "num": "#",
      "item": "وصف المادة",
      "uom": "الوحدة",
      "qty": "الكمية",
      "unit_price": "سعر الوحدة",
      "total": "الإجمالي",
      "delivery": "التوصيل",
      "supplier": "المورد"
    }
  }
}'::jsonb),
('pricelist', 'Price List', '{
  "company_name": "SCALE",
  "tagline": "Building Materials Simplified",
  "primary_color": "#2980B9",
  "footer_left": "Version {{version}} - Generated {{date}}",
  "footer_right": "Prices valid for 7 days from issue date",
  "pricelist_note": "* Prices are per unit. Final total depends on confirmed quantities.",
  "terms_text": "",
  "show_supplier_name": true,
  "show_delivery_column": true,
  "show_contact_phone": true,
  "show_delivery_section": true,
  "labels": {
    "en": {
      "document_title": "PRICE LIST",
      "customer": "Customer",
      "contact": "Contact",
      "date": "Date",
      "project": "Project",
      "delivery_location": "Delivery Location",
      "delivery_details": "DELIVERY DETAILS",
      "est_delivery": "Est. Delivery",
      "subtotal": "Subtotal",
      "delivery": "Delivery",
      "total": "Total"
    },
    "ar": {
      "document_title": "قائمة أسعار",
      "customer": "العميل",
      "contact": "جهة الاتصال",
      "date": "التاريخ",
      "project": "المشروع",
      "delivery_location": "موقع التسليم",
      "delivery_details": "تفاصيل التسليم",
      "est_delivery": "التسليم المتوقع",
      "subtotal": "المجموع الفرعي",
      "delivery": "التوصيل",
      "total": "الإجمالي"
    }
  },
  "columns": {
    "en": {
      "num": "#",
      "item": "Item Description",
      "uom": "UOM",
      "qty": "QTY",
      "unit_price": "Unit Price",
      "total": "Total",
      "delivery": "Delivery",
      "supplier": "Supplier"
    },
    "ar": {
      "num": "#",
      "item": "وصف المادة",
      "uom": "الوحدة",
      "qty": "الكمية",
      "unit_price": "سعر الوحدة",
      "total": "الإجمالي",
      "delivery": "التوصيل",
      "supplier": "المورد"
    }
  }
}'::jsonb);
