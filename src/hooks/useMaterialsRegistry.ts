import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SpecDefinition } from '@/components/materials/SpecFilterBar';
import { composeMaterialNameFromCode } from '@/lib/composeMaterialName';
import { parseSpecsFromCode } from '@/lib/coding-system';

export interface MaterialVariant {
  id: string;
  code: string | null;
  name: string;
  name_en: string | null;
  name_ar: string | null;
  variant_no: number;
  /** Per-variant UoM override. NULL = inherit from subcategory → category. Use resolveUom() to display. */
  uom: string | null;
  specs: Record<string, unknown>;
  status: string;
  is_core: boolean;
  market_price_min_sar: number | null;
  market_price_max_sar: number | null;
  image_url: string | null;
}

export interface Material {
  material_no: number;
  name: string;
  code?: string,
  status?: 'active' | 'deleted';
  variants: MaterialVariant[];
}

export interface VariantDefinition {
  key: string;
  label_en: string;
  label_ar?: string;
  options: string[];
}

export interface InheritableDefaults {
  default_uom: string | null;
  default_moq: number | null;
  default_lead_time_days: number | null;
  default_delivery_time_days: number | null;
  default_order_window_days: number | null;
  default_order_cutoff_local: string | null;
}

export interface Subcategory extends InheritableDefaults {
  id: string;
  subcategory_no: number;
  name_en: string;
  name_ar: string | null;
  description_en: string | null;
  status: string;
  materials: Material[];
  spec_definitions: SpecDefinition[];
  variant_definitions: VariantDefinition | null;
  domain_axis: string | null;
}

export interface Category extends InheritableDefaults {
  id: string;
  code2: string;
  name_en: string;
  name_ar: string | null;
  description_en: string | null;
  status: string;
  subcategories: Subcategory[];
}

export function useMaterialsRegistry() {

  return useQuery({
    queryKey: ['materials-registry'],
    queryFn: async (): Promise<Category[]> => {
      // ✅ فقط الـ Categories اللي status = 'active'
      const { data: categories, error: catError } = await supabase
        .from('material_categories')
        .select('*')
        .eq('status', 'active')  // ← إضافة هذه
        .order('code2');
      if (catError) throw catError;

      // ✅ فقط الـ Subcategories اللي status = 'active'
      const { data: subcategories, error: subError } = await supabase
        .from('material_subcategories')
        .select('*, spec_definitions')
        .eq('status', 'active')  // ← إضافة هذه
        .order('subcategory_no');
      if (subError) throw subError;

      // ✅ جميع المواد (سنقوم بتصفيتها لاحقاً حسب status)
      const { data: materials, error: matError } = await supabase
        .from('materials')
        .select('*')
        .order('material_no, variant_no');
      if (matError) throw matError;

      const categoryMap = new Map<string, Category>();

      for (const cat of categories || []) {
        categoryMap.set(cat.id, {
          id: cat.id,
          code2: cat.code2,
          name_en: cat.name_en,
          name_ar: cat.name_ar,
          description_en: cat.description_en,
          default_uom: cat.default_uom,
          default_moq: cat.default_moq,
          default_lead_time_days: cat.default_lead_time_days,
          default_delivery_time_days: cat.default_delivery_time_days,
          default_order_window_days: cat.default_order_window_days,
          default_order_cutoff_local: cat.default_order_cutoff_local,
          status: cat.status,
          subcategories: [],
        });
      }

      const subcategoryMap = new Map<string, Subcategory>();
      for (const sub of subcategories || []) {
        const rawSub = sub as any;
        const subcat: Subcategory = {
          id: sub.id,
          subcategory_no: sub.subcategory_no,
          name_en: sub.name_en,
          name_ar: sub.name_ar,
          description_en: sub.description_en,
          default_uom: sub.default_uom,
          default_moq: sub.default_moq,
          default_lead_time_days: sub.default_lead_time_days,
          default_delivery_time_days: sub.default_delivery_time_days,
          default_order_window_days: sub.default_order_window_days,
          default_order_cutoff_local: sub.default_order_cutoff_local,
          status: sub.status,
          materials: [],
          spec_definitions: Array.isArray(rawSub.spec_definitions) ? rawSub.spec_definitions : [],
          variant_definitions: rawSub.variant_definitions && typeof rawSub.variant_definitions === 'object' && rawSub.variant_definitions.key
            ? rawSub.variant_definitions
            : null,
          domain_axis: rawSub.domain_axis || null,
        };
        subcategoryMap.set(sub.id, subcat);

        const parentCat = categoryMap.get(sub.category_id);
        if (parentCat) {
          parentCat.subcategories.push(subcat);
        }
      }

      const materialGroupMap = new Map<string, Material>();

      for (const mat of materials || []) {
        if (!mat.subcategory_id) continue;
        
        // ✅ تخطي المواد المحذوفة
        if (mat.status === 'deleted') continue;

        const groupKey = `${mat.subcategory_id}-${mat.material_no}`;

        const parentSub = subcategoryMap.get(mat.subcategory_id);
        
        // ✅ إذا كان الـ Subcategory غير موجود (محذوف)، تخطي
        if (!parentSub) continue;

        if (!materialGroupMap.has(groupKey)) {
          const baseCode = mat.code ? mat.code.replace(/\.\d+$/, '') : null;
          const computedGroupName = parentSub
            ? composeMaterialNameFromCode(baseCode, parentSub, 'en')
            : (mat.name || '').replace(/\s*—\s*\d+\s*\w+$/i, '').trim();

          materialGroupMap.set(groupKey, {
            material_no: mat.material_no ?? 0,
            name: computedGroupName || (mat.name || '').replace(/\s*—\s*\d+\s*\w+$/i, '').trim(),
            variants: [],
          });

          parentSub.materials.push(materialGroupMap.get(groupKey)!);
        }

        const materialGroup = materialGroupMap.get(groupKey)!;
        const rawMat = mat as any;

        const derivedSpecs = parentSub ? parseSpecsFromCode(mat.code, parentSub as any) : {};
        const computedVariantName = parentSub
          ? composeMaterialNameFromCode(mat.code, parentSub, 'en')
          : mat.name;
        const computedVariantNameAr = parentSub
          ? composeMaterialNameFromCode(mat.code, parentSub, 'ar')
          : mat.name_ar;

        // ✅ فقط المتغيرات النشطة
        if (mat.status !== 'deleted') {
          materialGroup.variants.push({
            id: mat.id,
            code: mat.code,
            name: computedVariantName || mat.name,
            name_en: computedVariantName || mat.name_en,
            name_ar: computedVariantNameAr || mat.name_ar,
            variant_no: mat.variant_no,
            uom: mat.uom,
            specs: derivedSpecs,
            status: mat.status,
            is_core: rawMat.is_core ?? false,
            market_price_min_sar: mat.market_price_min_sar,
            market_price_max_sar: mat.market_price_max_sar,
            image_url: rawMat.image_url || null,
          });
        }
      }

      // ✅ تصفية الـ Subcategories التي ليس لها مواد نشطة (اختياري)
      return Array.from(categoryMap.values())
        .map((category) => ({
          ...category,
          subcategories: category.subcategories
            .filter(sub => {
              // يمكنك إما إبقاء الـ Subcategory حتى لو بدون مواد، أو حذفه
              // keep subcategory even if no materials? 
              return true; // ← يبقي الـ Subcategory حتى لو بدون مواد
            })
        }))
        .filter(category => category.subcategories.length > 0); // ← فقط الـ Categories اللي عندها Subcategories
    },
  });
}