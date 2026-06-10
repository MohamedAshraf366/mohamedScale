-- ============================================
-- 1. إضافة أعمدة جديدة إلى جدول orders
-- ============================================
DO $$ 
BEGIN
    -- أعمدة دورة العمل
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='lifecycle_stage') THEN
        ALTER TABLE orders ADD COLUMN lifecycle_stage TEXT DEFAULT 'quotation';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='procurement_status') THEN
        ALTER TABLE orders ADD COLUMN procurement_status TEXT DEFAULT 'pending_purchase_orders';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='finance_status') THEN
        ALTER TABLE orders ADD COLUMN finance_status TEXT DEFAULT 'pending_invoice_matching';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='collection_status') THEN
        ALTER TABLE orders ADD COLUMN collection_status TEXT DEFAULT 'not_collected';
    END IF;
    
    -- بيانات التوصيل الإضافية
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='expected_delivery_date') THEN
        ALTER TABLE orders ADD COLUMN expected_delivery_date DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_location') THEN
        ALTER TABLE orders ADD COLUMN delivery_location TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='guard_phone') THEN
        ALTER TABLE orders ADD COLUMN guard_phone TEXT;
    END IF;
    
    -- أعمدة الربط مع عروض الأسعار
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='quotation_id') THEN
        ALTER TABLE orders ADD COLUMN quotation_id UUID;
    END IF;
    
    -- القيم المالية
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='total_purchase_orders_value') THEN
        ALTER TABLE orders ADD COLUMN total_purchase_orders_value DECIMAL(15,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='total_supplier_invoices_value') THEN
        ALTER TABLE orders ADD COLUMN total_supplier_invoices_value DECIMAL(15,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='total_paid_to_suppliers') THEN
        ALTER TABLE orders ADD COLUMN total_paid_to_suppliers DECIMAL(15,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='sales_invoice_number') THEN
        ALTER TABLE orders ADD COLUMN sales_invoice_number TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='sales_invoice_amount') THEN
        ALTER TABLE orders ADD COLUMN sales_invoice_amount DECIMAL(15,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='sales_invoice_date') THEN
        ALTER TABLE orders ADD COLUMN sales_invoice_date DATE;
    END IF;
END $$;

-- ============================================
-- 2. إنشاء جدول أوامر الشراء (باستخدام account_id بدلاً من id)
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    supplier_id UUID,  -- هذا يشير إلى account_id في جدول suppliers
    po_number TEXT NOT NULL,
    po_date DATE NOT NULL,
    expected_delivery_date DATE,
    status TEXT DEFAULT 'draft',
    total_amount DECIMAL(15,2),
    currency TEXT DEFAULT 'SAR',
    pdf_attachment_url TEXT,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- إضافة foreign keys
DO $$
BEGIN
    -- Foreign key لـ orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_purchase_orders_order' 
                   AND table_name = 'purchase_orders') THEN
        ALTER TABLE purchase_orders 
            ADD CONSTRAINT fk_purchase_orders_order 
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
    END IF;
    
    -- Foreign key لـ suppliers (باستخدام account_id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_purchase_orders_supplier' 
                   AND table_name = 'purchase_orders') THEN
        ALTER TABLE purchase_orders 
            ADD CONSTRAINT fk_purchase_orders_supplier 
            FOREIGN KEY (supplier_id) REFERENCES suppliers(account_id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================
-- 3. إنشاء جدول استلام المشتريات
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL,
    receipt_date DATE NOT NULL,
    received_quantity DECIMAL(15,2),
    delivered_by TEXT,
    received_by TEXT,
    attachment_url TEXT,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_purchase_receipts_order' 
                   AND table_name = 'purchase_receipts') THEN
        ALTER TABLE purchase_receipts 
            ADD CONSTRAINT fk_purchase_receipts_order 
            FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================
-- 4. إنشاء جدول فواتير الموردين
-- ============================================
CREATE TABLE IF NOT EXISTS supplier_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID,
    supplier_id UUID,  -- هذا يشير إلى account_id في جدول suppliers
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    total_amount DECIMAL(15,2),
    currency TEXT DEFAULT 'SAR',
    pdf_attachment_url TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
    -- Foreign key لـ purchase_orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_supplier_invoices_po' 
                   AND table_name = 'supplier_invoices') THEN
        ALTER TABLE supplier_invoices 
            ADD CONSTRAINT fk_supplier_invoices_po 
            FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL;
    END IF;
    
    -- Foreign key لـ suppliers (باستخدام account_id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_supplier_invoices_supplier' 
                   AND table_name = 'supplier_invoices') THEN
        ALTER TABLE supplier_invoices 
            ADD CONSTRAINT fk_supplier_invoices_supplier 
            FOREIGN KEY (supplier_id) REFERENCES suppliers(account_id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================
-- 5. إنشاء جدول مطابقة الفواتير
-- ============================================
CREATE TABLE IF NOT EXISTS invoice_matching (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    purchase_order_id UUID,
    supplier_invoice_id UUID,
    matching_status TEXT DEFAULT 'pending',
    discrepancy_notes TEXT,
    matched_by UUID,
    matched_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
    -- Foreign key لـ orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_invoice_matching_order' 
                   AND table_name = 'invoice_matching') THEN
        ALTER TABLE invoice_matching 
            ADD CONSTRAINT fk_invoice_matching_order 
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
    END IF;
    
    -- Foreign key لـ purchase_orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_invoice_matching_po' 
                   AND table_name = 'invoice_matching') THEN
        ALTER TABLE invoice_matching 
            ADD CONSTRAINT fk_invoice_matching_po 
            FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL;
    END IF;
    
    -- Foreign key لـ supplier_invoices
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_invoice_matching_invoice' 
                   AND table_name = 'invoice_matching') THEN
        ALTER TABLE invoice_matching 
            ADD CONSTRAINT fk_invoice_matching_invoice 
            FOREIGN KEY (supplier_invoice_id) REFERENCES supplier_invoices(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================
-- 6. تفعيل RLS على الجداول الجديدة
-- ============================================
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_matching ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. سياسات الأمان
-- ============================================
DROP POLICY IF EXISTS purchase_orders_select_policy ON purchase_orders;
DROP POLICY IF EXISTS purchase_orders_insert_policy ON purchase_orders;
DROP POLICY IF EXISTS purchase_orders_update_policy ON purchase_orders;

CREATE POLICY purchase_orders_select_policy ON purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY purchase_orders_insert_policy ON purchase_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY purchase_orders_update_policy ON purchase_orders FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS purchase_receipts_select_policy ON purchase_receipts;
DROP POLICY IF EXISTS purchase_receipts_insert_policy ON purchase_receipts;
CREATE POLICY purchase_receipts_select_policy ON purchase_receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY purchase_receipts_insert_policy ON purchase_receipts FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS supplier_invoices_select_policy ON supplier_invoices;
DROP POLICY IF EXISTS supplier_invoices_insert_policy ON supplier_invoices;
CREATE POLICY supplier_invoices_select_policy ON supplier_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY supplier_invoices_insert_policy ON supplier_invoices FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS invoice_matching_select_policy ON invoice_matching;
DROP POLICY IF EXISTS invoice_matching_insert_policy ON invoice_matching;
DROP POLICY IF EXISTS invoice_matching_update_policy ON invoice_matching;
CREATE POLICY invoice_matching_select_policy ON invoice_matching FOR SELECT TO authenticated USING (true);
CREATE POLICY invoice_matching_insert_policy ON invoice_matching FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY invoice_matching_update_policy ON invoice_matching FOR UPDATE TO authenticated USING (true);

-- ============================================
-- 8. Triggers لتحديث updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER update_purchase_orders_updated_at 
    BEFORE UPDATE ON purchase_orders 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_supplier_invoices_updated_at ON supplier_invoices;
CREATE TRIGGER update_supplier_invoices_updated_at 
    BEFORE UPDATE ON supplier_invoices 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 9. دالة تحديث lifecycle_stage تلقائيًا
-- ============================================
CREATE OR REPLACE FUNCTION update_order_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
    -- من مرحلة عرض السعر إلى المشتريات
    IF NEW.status IN ('confirmed', 'in_progress') AND OLD.lifecycle_stage = 'quotation' THEN
        NEW.lifecycle_stage := 'procurement';
        NEW.procurement_status := 'pending_purchase_orders';
    END IF;
    
    -- من المشتريات إلى المالية
    IF NEW.procurement_status = 'fully_received' AND OLD.procurement_status != 'fully_received' THEN
        NEW.lifecycle_stage := 'finance';
        NEW.finance_status := 'pending_invoice_matching';
    END IF;
    
    -- من المالية إلى الإغلاق
    IF NEW.collection_status = 'collected' AND OLD.collection_status != 'collected' THEN
        NEW.lifecycle_stage := 'closed';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_lifecycle ON orders;
CREATE TRIGGER trigger_update_lifecycle
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_order_lifecycle();

-- ============================================
-- 10. دالة إضافة أمر شراء
-- ============================================
CREATE OR REPLACE FUNCTION add_purchase_order(
    p_order_id UUID,
    p_supplier_id UUID,
    p_po_number TEXT,
    p_po_date DATE,
    p_total_amount DECIMAL(15,2),
    p_currency TEXT DEFAULT 'SAR'
)
RETURNS UUID AS $$
DECLARE
    v_po_id UUID;
BEGIN
    INSERT INTO purchase_orders (order_id, supplier_id, po_number, po_date, total_amount, currency)
    VALUES (p_order_id, p_supplier_id, p_po_number, p_po_date, p_total_amount, p_currency)
    RETURNING id INTO v_po_id;
    
    -- تحديث إجمالي أوامر الشراء في الطلب
    UPDATE orders
    SET total_purchase_orders_value = COALESCE(total_purchase_orders_value, 0) + p_total_amount
    WHERE id = p_order_id;
    
    -- تحديث حالة المشتريات
    UPDATE orders
    SET procurement_status = 'purchase_orders_issued'
    WHERE id = p_order_id 
      AND procurement_status = 'pending_purchase_orders';
    
    RETURN v_po_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. دالة تسجيل استلام مشتريات
-- ============================================
CREATE OR REPLACE FUNCTION record_purchase_receipt(
    p_purchase_order_id UUID,
    p_receipt_date DATE,
    p_received_quantity DECIMAL(15,2),
    p_delivered_by TEXT DEFAULT NULL,
    p_received_by TEXT DEFAULT NULL,
    p_attachment_url TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_receipt_id UUID;
    v_order_id UUID;
    v_po_total DECIMAL(15,2);
    v_total_received DECIMAL(15,2);
BEGIN
    -- إضافة سجل الاستلام
    INSERT INTO purchase_receipts (
        purchase_order_id, receipt_date, received_quantity, 
        delivered_by, received_by, attachment_url, notes
    )
    VALUES (
        p_purchase_order_id, p_receipt_date, p_received_quantity,
        p_delivered_by, p_received_by, p_attachment_url, p_notes
    )
    RETURNING id INTO v_receipt_id;
    
    -- جلب order_id وإجمالي الكمية من أمر الشراء
    SELECT order_id, total_amount INTO v_order_id, v_po_total
    FROM purchase_orders 
    WHERE id = p_purchase_order_id;
    
    -- حساب إجمالي الكميات المستلمة
    SELECT COALESCE(SUM(received_quantity), 0) INTO v_total_received
    FROM purchase_receipts
    WHERE purchase_order_id = p_purchase_order_id;
    
    -- إذا تم استلام كل الكمية، تحديث حالة الطلب
    IF v_total_received >= v_po_total THEN
        UPDATE orders
        SET procurement_status = 'fully_received'
        WHERE id = v_order_id;
    END IF;
    
    RETURN v_receipt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 12. صلاحيات التنفيذ
-- ============================================
GRANT EXECUTE ON FUNCTION add_purchase_order TO authenticated;
GRANT EXECUTE ON FUNCTION record_purchase_receipt TO authenticated;
GRANT EXECUTE ON FUNCTION update_order_lifecycle TO authenticated;
GRANT EXECUTE ON FUNCTION update_updated_at_column TO authenticated;

-- ============================================
-- 13. إضافة فهارس لتحسين الأداء
-- ============================================
CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_id ON purchase_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_purchase_order_id ON purchase_receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_purchase_order_id ON supplier_invoices(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier_id ON supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoice_matching_order_id ON invoice_matching(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_lifecycle_stage ON orders(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_orders_procurement_status ON orders(procurement_status);