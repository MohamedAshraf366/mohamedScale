import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AvailableMaterial {
  id: string;
  material_no: number;
  name: string;
  name_ar?: string | null;
  code: string;
  uom: string;
  is_core: boolean;
  status: 'active' | 'deleted';
  has_active_quote: boolean;      // هل لها Quote نشط؟
  quote_status?: string | null;    // حالة الـ Quote إن وجد
  quote_id?: string | null;        // ID الـ Quote إن وجد
  disabled_reason?: string | null; // سبب عدم التوفر
}

export function useAvailableSupplierMaterials(subcategoryId?: string) {
  return useQuery({
    queryKey: ['available-supplier-materials', subcategoryId],
    queryFn: async () => {
      // الخطوة 1: جلب جميع المواد من جدول materials
      let query = supabase
        .from('materials')
        .select(`
          id,
          material_no,
          name,
          name_ar,
          code,
          uom,
          is_core,
          status,
          subcategory_id
        `)
        .in('status', ['active', 'deleted']); // نجلب النشطة والمحذوفة
      
      if (subcategoryId) {
        query = query.eq('subcategory_id', subcategoryId);
      }
      
      const { data: materials, error: materialsError } = await query;
      if (materialsError) throw materialsError;
      
      if (!materials || materials.length === 0) {
        return [];
      }
      
      // الخطوة 2: جلب الـ supplier_materials المرتبطة بهذه المواد
      const { data: supplierMaterials, error: smError } = await supabase
        .from('supplier_materials')
        .select(`
          id,
          material_id,
          status,
          supplier_quote:supplier_quotes(
            id,
            status,
            submitted_at
          )
        `)
        .in('material_id', materials.map(m => m.id))
        .order('created_at', { ascending: false });
      
      if (smError) throw smError;
      
      // الخطوة 3: تجميع الـ supplier_materials لكل material_id
      const materialQuotesMap = new Map<string, typeof supplierMaterials>();
      supplierMaterials?.forEach(sm => {
        if (!materialQuotesMap.has(sm.material_id)) {
          materialQuotesMap.set(sm.material_id, []);
        }
        materialQuotesMap.get(sm.material_id)?.push(sm);
      });
      
      // الخطوة 4: بناء قائمة المواد المتاحة مع تحديد المعطل منها
      const availableMaterials: AvailableMaterial[] = materials.map(material => {
        const quotes = materialQuotesMap.get(material.id) || [];
        
        // البحث عن Quote نشط (غير مرفوض وغير محذوف)
        const activeQuote = quotes.find(q => 
          q.supplier_quote?.status !== 'rejected' && 
          q.supplier_quote?.status !== 'deleted' &&
          q.status !== 'rejected'
        );
        
        const hasActiveQuote = !!activeQuote;
        const quoteStatus = activeQuote?.supplier_quote?.status;
        const quoteId = activeQuote?.supplier_quote?.id;
        
        let disabledReason: string | null = null;
        
        // حالة 1: المادة محذوفة من الـ Registry
        if (material.status === 'deleted') {
          disabledReason = '❗ هذه المادة تم حذفها من سجل المواد';
        } 
        // حالة 2: المادة لها Quote نشط بالفعل
        else if (hasActiveQuote) {
          const statusText = quoteStatus === 'approved' ? 'معتمدة' 
            : quoteStatus === 'under_review' ? 'قيد المراجعة' 
            : quoteStatus === 'negotiating' ? 'تفاوض'
            : 'نشطة';
          disabledReason = `⚠️ هذه المادة لها عرض سعر ${statusText} بالفعل`;
        }
        
        return {
          id: material.id,
          material_no: material.material_no,
          name: material.name,
          name_ar: material.name_ar,
          code: material.code,
          uom: material.uom,
          is_core: material.is_core,
          status: material.status as 'active' | 'deleted',
          has_active_quote: hasActiveQuote,
          quote_status: quoteStatus,
          quote_id: quoteId,
          disabled_reason: disabledReason,
        };
      });
      
      return availableMaterials;
    },
    enabled: !!subcategoryId, // يتم التشغيل فقط عند وجود subcategoryId
  });
}