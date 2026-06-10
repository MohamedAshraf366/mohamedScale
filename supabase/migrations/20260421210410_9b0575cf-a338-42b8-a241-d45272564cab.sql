-- 1. New registry table for reusable add-on definitions
CREATE TABLE public.addon_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_ar text,
  default_uom text NOT NULL DEFAULT 'unit',
  default_price numeric,
  default_margin_pct numeric,
  scope text NOT NULL DEFAULT 'global',
  subcategory_id uuid,
  material_id uuid,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT addon_definitions_scope_check
    CHECK (scope IN ('global', 'subcategory', 'material')),
  CONSTRAINT addon_definitions_scope_refs_check CHECK (
    (scope = 'global'      AND subcategory_id IS NULL AND material_id IS NULL) OR
    (scope = 'subcategory' AND subcategory_id IS NOT NULL AND material_id IS NULL) OR
    (scope = 'material'    AND material_id IS NOT NULL)
  )
);

CREATE INDEX idx_addon_definitions_scope ON public.addon_definitions(scope);
CREATE INDEX idx_addon_definitions_subcategory ON public.addon_definitions(subcategory_id) WHERE subcategory_id IS NOT NULL;
CREATE INDEX idx_addon_definitions_material ON public.addon_definitions(material_id) WHERE material_id IS NOT NULL;

ALTER TABLE public.addon_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view addon_definitions"
  ON public.addon_definitions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage addon_definitions"
  ON public.addon_definitions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_addon_definitions_updated_at
  BEFORE UPDATE ON public.addon_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Extend quotation_items
ALTER TABLE public.quotation_items
  ADD COLUMN item_kind text NOT NULL DEFAULT 'material',
  ADD COLUMN parent_line_id uuid,
  ADD COLUMN addon_definition_id uuid;

ALTER TABLE public.quotation_items
  ADD CONSTRAINT quotation_items_item_kind_check
    CHECK (item_kind IN ('material', 'addon'));

CREATE INDEX idx_quotation_items_parent_line ON public.quotation_items(parent_line_id) WHERE parent_line_id IS NOT NULL;
CREATE INDEX idx_quotation_items_kind ON public.quotation_items(item_kind);

-- 3. Extend order_items (mirror)
ALTER TABLE public.order_items
  ADD COLUMN item_kind text NOT NULL DEFAULT 'material',
  ADD COLUMN parent_line_id uuid,
  ADD COLUMN addon_definition_id uuid;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_item_kind_check
    CHECK (item_kind IN ('material', 'addon'));

CREATE INDEX idx_order_items_parent_line ON public.order_items(parent_line_id) WHERE parent_line_id IS NOT NULL;
CREATE INDEX idx_order_items_kind ON public.order_items(item_kind);