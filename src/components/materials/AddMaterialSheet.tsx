import { useState, useMemo, useEffect } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Lock, Unlock, Settings2, Star, Package, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import type { SpecDefinition } from './SpecFilterBar';
import type { Category, InheritableDefaults } from '@/hooks/useMaterialsRegistry';
import { AddCategoryDialog } from './AddCategoryDialog';
import { AddSubcategoryDialog } from './AddSubcategoryDialog';
import { AxisSelector, countIncludedCombos, type AxisDefinition } from './AxisSelector';
import { cn } from '@/lib/utils';

const NEW_ITEM = '__new__';

const UOM_OPTIONS = [
  { value: 'unit', label: 'Unit' },
  { value: 'piece', label: 'Piece' }, 
  { value: 'm3', label: 'm³' },
  { value: 'ton', label: 'Ton' },
  { value: 'kg', label: 'kg' },
  { value: 'm2', label: 'm²' },
  { value: 'm', label: 'm' },
];

function uomLabel(val: string | null) {
  return UOM_OPTIONS.find((o) => o.value === val)?.label ?? val ?? '—';
}

function InheritedField({
  label,
  inheritedValue,
  inheritedDisplay,
  overriding,
  children,
}: {
  label: string;
  inheritedValue: string | number | null;
  inheritedDisplay?: string;
  overriding: boolean;
  children: React.ReactNode;
}) {
  const display = inheritedDisplay ?? (inheritedValue != null ? String(inheritedValue) : '—');
  if (!overriding) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1.5">
          <Lock className="h-3 w-3 text-muted-foreground" />
          {label}
        </Label>
        <div className="h-9 flex items-center px-3 rounded-md border bg-muted/40 text-sm">
          <span className="font-medium">{display}</span>
          <span className="ml-auto text-[10px] text-muted-foreground">from category/subcategory</span>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1.5">
        <Unlock className="h-3 w-3 text-primary" />
        {label}
      </Label>
      {children}
    </div>
  );
}

interface VariantDefinition {
  key: string;
  label_en: string;
  label_ar?: string;
  options: string[];
}

interface AddMaterialSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
}

function buildMaterialName(
  subcategoryName: string,
  specLabels: string[],
  variantLabel: string,
): string {
  const parts = [subcategoryName];
  if (specLabels.length > 0) parts.push(specLabels.join(', '));
  if (variantLabel) parts.push(variantLabel);
  return parts.join(': ');
}

export interface GeneratedCombo {
  id: string; // unique key for selection
  name: string;
  code:string,
  specs: Record<string, string>;
  specDigits: string;
  specLabels: string[];
  variantLabel: string;
  variantNo: number;
  materialNo: number;
  isCore: boolean;
  isDeleted: boolean;
}

/* ─── Recursive group structure for combo preview ─── */
interface ComboGroupNode {
  label: string;
  axisKey: string;
  items: GeneratedCombo[];
  children: ComboGroupNode[];
}

function buildComboGroups(
  items: GeneratedCombo[],
  axes: { key: string; label: string; getLabel: (val: string) => string }[],
  depth: number = 0,
): ComboGroupNode[] {
  // ✅ إضافة التحقق من وجود items وقابليتها للتكرار
  if (!items || !Array.isArray(items) || items.length === 0) return [];
  if (depth >= axes.length || axes.length === 0) return [];
  
  const axis = axes[depth];
  const buckets = new Map<string, GeneratedCombo[]>();
  
  for (const item of items) {
    if (!item) continue; // ✅ تخطي العناصر غير المعرفة
    const val = item.specs[axis.key] || item.variantLabel || 'Other';
    if (!buckets.has(val)) buckets.set(val, []);
    buckets.get(val)!.push(item);
  }
  
  const groups: ComboGroupNode[] = [];
  for (const [val, groupItems] of buckets) {
    groups.push({
      label: axis.getLabel(val),
      axisKey: axis.key,
      items: groupItems,
      children: buildComboGroups(groupItems, axes, depth + 1),
    });
  }
  return groups;
}

export function AddMaterialSheet({
  open,
  onOpenChange,
  categories,
}: AddMaterialSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('');
  const [uom, setUom] = useState('unit');
  const [submitting, setSubmitting] = useState(false);

  // Axis exclusions
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  // Per-combo overrides
  const [comboCore, setComboCore] = useState<Set<string>>(new Set());
  const [comboDeleted, setComboDeleted] = useState<Set<string>>(new Set());
  const [comboSelected, setComboSelected] = useState<Set<string>>(new Set());

  // Grouping axes selection for combo preview
  const [comboGroupByAxes, setComboGroupByAxes] = useState<string[]>([]);

  // Override state
  const [overrideDefaults, setOverrideDefaults] = useState(false);
  const [defaultMoq, setDefaultMoq] = useState<number | null>(null);
  const [defaultLeadTimeDays, setDefaultLeadTimeDays] = useState<number | null>(null);
  const [defaultDeliveryTimeDays, setDefaultDeliveryTimeDays] = useState<number | null>(null);
  const [defaultOrderWindowDays, setDefaultOrderWindowDays] = useState<number | null>(null);
  const [defaultOrderCutoffLocal, setDefaultOrderCutoffLocal] = useState('');

  // Dialog states
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewSubcategory, setShowNewSubcategory] = useState(false);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const selectedSubcategory = selectedCategory?.subcategories.find(
    (s) => s.id === selectedSubcategoryId
  );

  const effectiveDefaults: InheritableDefaults = useMemo(() => {
    const cat = selectedCategory;
    const sub = selectedSubcategory;
    return {
      default_uom: sub?.default_uom ?? cat?.default_uom ?? null,
      default_moq: sub?.default_moq ?? cat?.default_moq ?? null,
      default_lead_time_days: sub?.default_lead_time_days ?? cat?.default_lead_time_days ?? null,
      default_delivery_time_days: sub?.default_delivery_time_days ?? cat?.default_delivery_time_days ?? null,
      default_order_window_days: sub?.default_order_window_days ?? cat?.default_order_window_days ?? null,
      default_order_cutoff_local: sub?.default_order_cutoff_local ?? cat?.default_order_cutoff_local ?? null,
    };
  }, [selectedCategory, selectedSubcategory]);

  const specDefinitions: SpecDefinition[] = (selectedSubcategory as any)?.spec_definitions || [];
  const variantDefinition: VariantDefinition | null = (selectedSubcategory as any)?.variant_definitions && (selectedSubcategory as any)?.variant_definitions?.key
    ? (selectedSubcategory as any)?.variant_definitions
    : null;

  const axes: AxisDefinition[] = useMemo(() => {
    const result: AxisDefinition[] = [];
    for (const spec of specDefinitions) {
      result.push({
        key: spec.key,
        label: spec.label_en,
        options: spec.options.map((o) => ({ value: o.value, label: o.label_en })),
      });
    }
    if (variantDefinition && variantDefinition.options?.length > 0) {
      result.push({
        key: variantDefinition.key,
        label: variantDefinition.label_en,
        options: variantDefinition.options.map((o) => ({ value: o, label: o })),
      });
    }
    return result;
  }, [specDefinitions, variantDefinition]);

  const totalCombos = useMemo(() => {
    let count = 1;
    for (const axis of axes) count *= axis.options.length;
    return count;
  }, [axes]);

  const includedCombos = useMemo(() => countIncludedCombos(axes, excluded), [axes, excluded]);

// Generate full combo list
const generatedCombos: GeneratedCombo[] = useMemo(() => {
  if (!selectedSubcategory || axes.length === 0) return [];

  const categoryCode2 = selectedCategory?.code2 || '??';
  const subcatPad = String(selectedSubcategory.subcategory_no).padStart(2, '0');

  type SpecCombo = { specs: Record<string, string>; specDigits: string; specLabels: string[] };
  let specCombos: SpecCombo[] = [{ specs: {}, specDigits: '', specLabels: [] }];

  for (const spec of specDefinitions) {
    if (spec.options.length === 0) continue;
    const next: SpecCombo[] = [];
    for (const combo of specCombos) {
      for (const opt of spec.options) {
        if (excluded.has(`${spec.key}:${opt.value}`)) continue;
        next.push({
          specs: { ...combo.specs, [spec.key]: opt.value },
          specDigits: combo.specDigits + opt.code_digit,
          specLabels: [...combo.specLabels, opt.label_en],
        });
      }
    }
    specCombos = next;
  }

  const variantKey = variantDefinition?.key || 'size';
  const allVariantOptions = variantDefinition?.options || [];
  const includedVariants = allVariantOptions.filter(
    (v) => !excluded.has(`${variantKey}:${v}`)
  );
  const variants = includedVariants.length > 0
  ? includedVariants.map((v, i) => ({ 
      label: v, 
      no: parseInt(v) || (i + 1)  // استخدم القيمة العددية من الـ label إذا كانت رقماً
    }))
  : [{ label: '', no: 1 }];

  const combos: GeneratedCombo[] = [];
  let materialNo = 1;
  for (const combo of specCombos) {
    for (const variant of variants) {
      const id = `${combo.specDigits || '0'}-${variant.no}`;
      const variantNoPad = String(variant.no).padStart(2, '0');
      const code = `MAT.${categoryCode2}.${subcatPad}.${combo.specDigits || '0'}.${variantNoPad}`;
      
      combos.push({
        id,
        code,  // ✅ الآن code معرف بشكل صحيح
        // Computed by DB trigger on insert; kept locally for preview UI only.
        name: buildMaterialName(selectedSubcategory.name_en, combo.specLabels, variant.label),
        specs: { ...combo.specs, ...(variant.label ? { [variantKey]: variant.label } : {}) },
        specDigits: combo.specDigits,
        specLabels: combo.specLabels,
        variantLabel: variant.label,
        variantNo: variant.no,
        materialNo,
        isCore: comboCore.has(id),
        isDeleted: comboDeleted.has(id),
      });
    }
    materialNo++;
  }
  return combos;
}, [selectedSubcategory, selectedCategory, specDefinitions, variantDefinition, excluded, axes, comboCore, comboDeleted]);

 const existingComboIds = useMemo(() => {
  if (!selectedSubcategory) return new Set<string>();

  const ids = new Set<string>();

  selectedSubcategory.materials?.forEach((mat: any) => {
    mat?.variants?.forEach((v: any) => {
      if (v?.status !== 'active') return;

      if (v?.code) {
        ids.add(String(v.code).trim().toUpperCase());
      }
    });
  });

  console.log(
    'ALL existing codes:',
    Array.from(ids)
  );

  return ids;
}, [selectedSubcategory]);


const activeCombos = generatedCombos.filter((c) => !c.isDeleted && !existingComboIds.has(String(c.code).trim().toUpperCase()));
const existingCount = generatedCombos.filter((c) => !c.isDeleted && existingComboIds.has(String(c.code).trim().toUpperCase())).length;

useEffect(() => {
  console.log('=== DEBUGGING ===');
  console.log('Total generated combos:', generatedCombos.length);
  console.log('Existing codes from DB:', Array.from(existingComboIds).slice(0, 3));
  console.log('Generated codes sample:', generatedCombos.slice(0, 3).map(c => c.code));
  
  // أوجد التوافيق التي تعتبر "جديدة" ولكن قد تكون موجودة
  const falsePositives = generatedCombos.filter(c => {
    const exists = existingComboIds.has(c.code);
    if (!exists) {
      console.log('Missing code:', c.code);
      console.log('  Specs:', c.specs);
      console.log('  SpecDigits:', c.specDigits);
      console.log('  VariantNo:', c.variantNo);
    }
    return !exists;
  });
  console.log('Codes considered "new":', falsePositives.map(c => c.code));
}, [generatedCombos, existingComboIds]);

const deletedExistingCount = useMemo(() => {
  // بعد تعريف activeCombos و existingCount، أضف هذا:
  if (!selectedSubcategory) return 0;
  let count = 0;
  for (const mat of selectedSubcategory.materials) {
    for (const v of mat.variants) {
      if (v.status === 'deleted') {
        let specDigits = '';
        for (const spec of specDefinitions) {
          const val = v.specs?.[spec.key];
          if (val != null) {
            const opt = spec.options.find((o) => o.value === String(val));
            if (opt) specDigits += opt.code_digit;
          }
        }
        const comboId = `${specDigits || '0'}-${v.variant_no}`;
        // تحقق إذا كان هذا التوافق موجود في الـ generatedCombos
        if (generatedCombos.some(c => c.id === comboId)) {
          count++;
        }
      }
    }
  }
  return count;
}, [selectedSubcategory, specDefinitions, generatedCombos]);
// أضف هذا بعد deletedExistingCount
const { combosToCreate, combosToRestore } = useMemo(() => {
  const toCreate: GeneratedCombo[] = [];
  const toRestore: GeneratedCombo[] = [];

  if (!selectedSubcategory) return { combosToCreate: toCreate, combosToRestore: toRestore };

  for (const combo of activeCombos) {
    let isDeleted = false;
    for (const mat of selectedSubcategory.materials) {
      for (const v of mat.variants) {
        if (v.status !== 'deleted') continue;
        
        let specDigits = '';
        for (const spec of specDefinitions) {
          const val = v.specs?.[spec.key];
          if (val != null) {
            const opt = spec.options.find((o) => o.value === String(val));
            if (opt) specDigits += opt.code_digit;
          }
        }
        const comboId = `${specDigits || '0'}-${v.variant_no}`;
        if (comboId === combo.id) {
          isDeleted = true;
          break;
        }
      }
      if (isDeleted) break;
    }
    
    if (isDeleted) {
      toRestore.push(combo);
    } else {
      toCreate.push(combo);
    }
  }

  return { combosToCreate: toCreate, combosToRestore: toRestore };
}, [activeCombos, selectedSubcategory, specDefinitions]);

  // All available grouping axes (specs + size/variant)
  const allComboAxes = useMemo(() => {
    const result: { key: string; label: string; getLabel: (val: string) => string }[] = [];
    for (const spec of specDefinitions) {
      result.push({
        key: spec.key,
        label: spec.label_en,
        getLabel: (val: string) => {
          const opt = spec.options.find((o) => o.value === val);
          return opt?.label_en || val;
        },
      });
    }
    if (variantDefinition) {
      result.push({
        key: variantDefinition.key,
        label: variantDefinition.label_en,
        getLabel: (val: string) => val,
      });
    }
    return result;
  }, [specDefinitions, variantDefinition]);

  // Filter to only user-selected axes
  const activeComboGroupAxes = useMemo(() => {
    if (comboGroupByAxes.length === 0) return allComboAxes; // default: all
    return comboGroupByAxes
      .map((key) => allComboAxes.find((a) => a.key === key))
      .filter(Boolean) as typeof allComboAxes;
  }, [comboGroupByAxes, allComboAxes]);

  const comboGroups = useMemo(() => {
    if (activeComboGroupAxes.length === 0) return null;
    return buildComboGroups(activeCombos, activeComboGroupAxes);
  }, [activeCombos, activeComboGroupAxes]);

  const handleCategoryChange = (catId: string) => {
    if (catId === NEW_ITEM) {
      setShowNewCategory(true);
      return;
    }
    setSelectedCategoryId(catId);
    setSelectedSubcategoryId('');
    setExcluded(new Set());
    setComboCore(new Set());
    setComboDeleted(new Set());
    setComboSelected(new Set());
    setComboGroupByAxes([]);
    setOverrideDefaults(false);
  };

  const handleSubcategoryChange = (subId: string) => {
    if (subId === NEW_ITEM) {
      setShowNewSubcategory(true);
      return;
    }
    setSelectedSubcategoryId(subId);
    setExcluded(new Set());
    setComboCore(new Set());
    setComboDeleted(new Set());
    setComboSelected(new Set());
    setComboGroupByAxes([]);
    setOverrideDefaults(false);
    const sub = selectedCategory?.subcategories.find((s) => s.id === subId);
    const effectiveUom = sub?.default_uom ?? selectedCategory?.default_uom ?? 'unit';
    setUom(effectiveUom);
  };

  const handleAxisToggle = (axisKey: string, optionValue: string) => {
    const tag = `${axisKey}:${optionValue}`;
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  // Combo selection
  const toggleComboSelect = (id: string) => {
    setComboSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroupSelect = (ids: string[]) => {
    setComboSelected((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const selectAll = () => {
    const allIds = activeCombos.map((c) => c.id);
    setComboSelected((prev) => {
      if (prev.size === allIds.length) return new Set();
      return new Set(allIds);
    });
  };

  // Bulk actions on selected combos
  const bulkMarkCore = () => {
    setComboCore((prev) => {
      const next = new Set(prev);
      comboSelected.forEach((id) => next.add(id));
      return next;
    });
    setComboSelected(new Set());
  };

  const bulkRemoveCore = () => {
    setComboCore((prev) => {
      const next = new Set(prev);
      comboSelected.forEach((id) => next.delete(id));
      return next;
    });
    setComboSelected(new Set());
  };

  const bulkDelete = () => {
    setComboDeleted((prev) => {
      const next = new Set(prev);
      comboSelected.forEach((id) => next.add(id));
      return next;
    });
    setComboSelected(new Set());
  };

  const handleSubmit = async () => {
  if (!selectedSubcategoryId) {
    toast.error('Please select a subcategory');
    return;
  }

  const combosToProcess = activeCombos.filter(c => comboSelected.has(c.id));
  
  if (combosToProcess.length === 0) {
    toast.error('Please select at least one variant to add');
    return;
  }

  setSubmitting(true);
  try {
    let restoredCount = 0;
    let createdCount = 0;

    for (const combo of combosToProcess) {
      const { data: existingMaterial } = await supabase
        .from('materials')
        .select('id, status')
        .eq('code', combo.code.trim().toUpperCase())
        .maybeSingle();

      if (existingMaterial) {
        if (existingMaterial.status === 'deleted') {
          // ✅ استعادة - تحديث جميع الحقول
          const { error: restoreError } = await supabase
            .from('materials')
            .update({ 
              status: 'active', 
              updated_by: user?.id || null,
              updated_at: new Date().toISOString(),
              is_core: combo.isCore,
              name: combo.name,
              name_en: combo.name,
              name_ar: combo.name,  // ✅ إضافة الاسم العربي
            })
            .eq('id', existingMaterial.id);
          
          if (!restoreError) restoredCount++;
        }
      } else {
        const categoryCode2 = selectedCategory?.code2 || '??';
        const subcatNo = selectedSubcategory?.subcategory_no || 0;
        const subcatPad = String(subcatNo).padStart(2, '0');
        
        const overrideFields = overrideDefaults ? {
          default_moq: defaultMoq,
          default_lead_time_days: defaultLeadTimeDays,
          default_delivery_time_days: defaultDeliveryTimeDays,
          default_order_window_days: defaultOrderWindowDays,
          default_order_cutoff_local: defaultOrderCutoffLocal || null,
        } : {};

        const { data: existingMats } = await supabase
          .from('materials')
          .select('material_no')
          .eq('subcategory_id', selectedSubcategoryId)
          .eq('status', 'active')
          .order('material_no', { ascending: false })
          .limit(1);

        const startMaterialNo = existingMats && existingMats.length > 0
          ? (existingMats[0].material_no || 0) + 1
          : 1;

        const variantNoPad = String(combo.variantNo).padStart(2, '0');
        const code = `MAT.${categoryCode2}.${subcatPad}.${combo.specDigits || '0'}.${variantNoPad}`;
        
        // ✅ بناء الاسم الكامل
        const nameEn = buildMaterialName(
          selectedSubcategory.name_en,
          combo.specLabels,
          combo.variantLabel
        );
        
        const nameAr = buildMaterialName(
          selectedSubcategory.name_ar || selectedSubcategory.name_en,
          combo.specLabels,
          combo.variantLabel
        );

        // ✅ إنشاء جديد مع جميع الحقول
        const { error: createError } = await supabase
          .from('materials')
          .insert({
            subcategory_id: selectedSubcategoryId,
            material_no: startMaterialNo,
            variant_no: combo.variantNo,
            code: code,
            name: nameEn,
            name_en: nameEn,
            name_ar: nameAr,
            uom: uom,
            status: 'active',
            is_core: combo.isCore,
            specs: combo.specs,
            created_by: user?.id || null,
            created_at: new Date().toISOString(),
            ...overrideFields,
          } as any);
        
        if (!createError) createdCount++;
      }
    }

    if (restoredCount > 0) {
      toast.success(`${restoredCount} variant(s) restored successfully`);
    }
    if (createdCount > 0) {
      toast.success(`Added ${createdCount} new variant(s)`);
    }

    queryClient.invalidateQueries({ queryKey: ['materials-registry'] });
    resetForm();
    onOpenChange(false);
  } catch (error) {
    console.error('Submission error:', error);
    toast.error(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    setSubmitting(false);
  }
};

  const resetForm = () => {
    setSelectedCategoryId('');
    setSelectedSubcategoryId('');
    setExcluded(new Set());
    setComboCore(new Set());
    setComboDeleted(new Set());
    setComboSelected(new Set());
    setComboGroupByAxes([]);
    setUom('unit');
    setOverrideDefaults(false);
    setDefaultMoq(null);
    setDefaultLeadTimeDays(null);
    setDefaultDeliveryTimeDays(null);
    setDefaultOrderWindowDays(null);
    setDefaultOrderCutoffLocal('');
  };

  const hasComboSelection = comboSelected.size > 0;
// ✅ حساب المواد المحددة للإنشاء والاستعادة
const selectedCombosToCreate = useMemo(() => {
  return combosToCreate.filter(c => comboSelected.has(c.id));
}, [combosToCreate, comboSelected]);

const selectedCombosToRestore = useMemo(() => {
  return combosToRestore.filter(c => comboSelected.has(c.id));
}, [combosToRestore, comboSelected]);
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Material
            </SheetTitle>
            <SheetDescription>
              Select category &amp; subcategory. Variations are auto-generated from specs × sizes.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={selectedCategoryId} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.code2} — {cat.name_en}
                    </SelectItem>
                  ))}
                  <SelectSeparator />
                  <SelectItem value={NEW_ITEM} className="text-primary font-medium">
                    <span className="flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> New Category
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Subcategory */}
            {selectedCategory && (
              <div className="space-y-2">
                <Label>Subcategory</Label>
                <Select value={selectedSubcategoryId} onValueChange={handleSubcategoryChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subcategory" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedCategory.subcategories.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.subcategory_no} — {sub.name_en}
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                    <SelectItem value={NEW_ITEM} className="text-primary font-medium">
                      <span className="flex items-center gap-1.5">
                        <Plus className="h-3.5 w-3.5" /> New Subcategory
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Generated variations */}
            {selectedSubcategoryId && axes.length > 0 && (
              <>

                {/* Combo management table */}
                {activeCombos.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
  <Label className="text-sm font-medium">
    New Variations ({activeCombos.length})
    {existingCount > 0 && (
      <span className="text-muted-foreground font-normal ml-1">
        · {existingCount} already exist (active)
      </span>
    )}
    {deletedExistingCount > 0 && (
      <span className="text-amber-600 font-normal ml-1">
        · {deletedExistingCount} deleted - will be restored
      </span>
    )}
  </Label>
  {/* إضافة مؤشر لما سيحدث عند الإرسال */}
  <div className="text-[10px] text-muted-foreground">
    {combosToRestore.length > 0 && `${combosToRestore.length} to restore, `}
    {combosToCreate.length > 0 && `${combosToCreate.length} to create`}
  </div>
</div>

                      {/* Grouping switches */}
                      {allComboAxes.length > 1 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-muted-foreground">Group:</span>
                          <Button
                            variant={comboGroupByAxes.length === 0 ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-6 text-[10px] px-2"
                            onClick={() => setComboGroupByAxes([])}
                          >
                            All
                          </Button>
                          {allComboAxes.map((axis) => {
                            const isActive = comboGroupByAxes.includes(axis.key);
                            const idx = comboGroupByAxes.indexOf(axis.key);
                            return (
                              <Button
                                key={axis.key}
                                variant={isActive ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-6 text-[10px] px-2"
                                onClick={() => {
                                  setComboGroupByAxes((prev) => {
                                    if (prev.includes(axis.key)) return prev.filter((k) => k !== axis.key);
                                    return [...prev, axis.key];
                                  });
                                }}
                              >
                                {axis.label}
                                {isActive && (
                                  <Badge variant="outline" className="ml-1 text-[8px] h-3 px-0.5">
                                    {idx + 1}
                                  </Badge>
                                )}
                              </Button>
                            );
                          })}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] px-2 text-muted-foreground"
                            onClick={() => setComboGroupByAxes(allComboAxes.map((a) => a.key))}
                          >
                            None (flat)
                          </Button>
                        </div>
                      )}

                      {/* Bulk actions */}
                      {/* Bulk actions */}
{hasComboSelection && (
  <div className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-lg">
    <Badge variant="secondary" className="text-[10px]">
      {comboSelected.size} selected
    </Badge>
    <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={bulkMarkCore}>
      <Star className="h-3 w-3" /> Core
    </Button>
    <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 text-muted-foreground" onClick={bulkRemoveCore}>
      <Star className="h-3 w-3" /> Uncore
    </Button>
    <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 text-destructive" onClick={bulkDelete}>
      <Trash2 className="h-3 w-3" /> Remove
    </Button>
  </div>
)}

                      <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted sticky top-0 z-10">
                            <tr>
                              <th className="w-8 px-2 py-1.5">
                                <Checkbox
                                  checked={comboSelected.size === activeCombos.length && activeCombos.length > 0}
                                  onCheckedChange={selectAll}
                                  className="h-3 w-3"
                                />
                              </th>
                              <th className="text-left px-2 py-1.5 font-medium">Name</th>
                              <th className="text-left px-2 py-1.5 font-medium w-10">Core</th>
                              <th className="w-8 px-2 py-1.5"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {comboGroups && comboGroups.length > 0
                              ? comboGroups.map((group) => (
                                  <ComboGroupRow
                                    key={`${group.axisKey}:${group.label}`}
                                    group={group}
                                    depth={0}
                                    selected={comboSelected}
                                    coreSet={comboCore}
                                    onToggleSelect={toggleComboSelect}
                                    onToggleGroupSelect={toggleGroupSelect}
                                    onToggleCore={(id) => {
                                      setComboCore((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(id)) next.delete(id);
                                        else next.add(id);
                                        return next;
                                      });
                                    }}
                                    onDelete={(id) => {
                                      setComboDeleted((prev) => {
                                        const next = new Set(prev);
                                        next.add(id);
                                        return next;
                                      });
                                    }}
                                  />
                                ))
                              : activeCombos.map((combo) => (
                                  <ComboItemRow
                                    key={combo.id}
                                    combo={combo}
                                    isSelected={comboSelected.has(combo.id)}
                                    onToggleSelect={() => toggleComboSelect(combo.id)}
                                    onToggleCore={() => {
                                      setComboCore((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(combo.id)) next.delete(combo.id);
                                        else next.add(combo.id);
                                        return next;
                                      });
                                    }}
                                    onDelete={() => {
                                      setComboDeleted((prev) => {
                                        const next = new Set(prev);
                                        next.add(combo.id);
                                        return next;
                                      });
                                    }}
                                  />
                                ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Show deleted count */}
                      {comboDeleted.size > 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{comboDeleted.size} variation(s) removed</span>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-5 text-xs p-0"
                            onClick={() => setComboDeleted(new Set())}
                          >
                            Restore all
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {selectedSubcategoryId && <Separator />}

            {/* Defaults + submit */}
            {selectedSubcategoryId && (
              <>
                {/* Inherited Defaults */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Operational Defaults</Label>
                    {!overrideDefaults ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs text-muted-foreground h-7"
                        onClick={() => {
                          setOverrideDefaults(true);
                          setUom(effectiveDefaults.default_uom || 'unit');
                          setDefaultMoq(effectiveDefaults.default_moq);
                          setDefaultLeadTimeDays(effectiveDefaults.default_lead_time_days);
                          setDefaultDeliveryTimeDays(effectiveDefaults.default_delivery_time_days);
                          setDefaultOrderWindowDays(effectiveDefaults.default_order_window_days);
                          setDefaultOrderCutoffLocal(effectiveDefaults.default_order_cutoff_local || '');
                        }}
                      >
                        <Settings2 className="h-3 w-3" />
                        Override
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs text-primary h-7"
                        onClick={() => {
                          setOverrideDefaults(false);
                          setUom(effectiveDefaults.default_uom || 'unit');
                        }}
                      >
                        <Lock className="h-3 w-3" />
                        Reset to inherited
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <InheritedField
                      label="Unit of Measure"
                      inheritedValue={effectiveDefaults.default_uom}
                      inheritedDisplay={uomLabel(effectiveDefaults.default_uom)}
                      overriding={overrideDefaults}
                    >
                      <Select value={uom} onValueChange={setUom}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UOM_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </InheritedField>

                    <InheritedField label="Default MOQ" inheritedValue={effectiveDefaults.default_moq} overriding={overrideDefaults}>
                      <Input type="number" min={0} placeholder="e.g. 10" value={defaultMoq ?? ''} onChange={(e) => setDefaultMoq(e.target.value ? Number(e.target.value) : null)} />
                    </InheritedField>

                    <InheritedField label="Lead Time (days)" inheritedValue={effectiveDefaults.default_lead_time_days} overriding={overrideDefaults}>
                      <Input type="number" min={0} placeholder="e.g. 3" value={defaultLeadTimeDays ?? ''} onChange={(e) => setDefaultLeadTimeDays(e.target.value ? Number(e.target.value) : null)} />
                    </InheritedField>

                    <InheritedField label="Delivery Time (days)" inheritedValue={effectiveDefaults.default_delivery_time_days} overriding={overrideDefaults}>
                      <Input type="number" min={0} placeholder="e.g. 1" value={defaultDeliveryTimeDays ?? ''} onChange={(e) => setDefaultDeliveryTimeDays(e.target.value ? Number(e.target.value) : null)} />
                    </InheritedField>

                    <InheritedField label="Order Window (days)" inheritedValue={effectiveDefaults.default_order_window_days} overriding={overrideDefaults}>
                      <Input type="number" min={0} placeholder="e.g. 7" value={defaultOrderWindowDays ?? ''} onChange={(e) => setDefaultOrderWindowDays(e.target.value ? Number(e.target.value) : null)} />
                    </InheritedField>

                    <InheritedField label="Order Cutoff (local)" inheritedValue={effectiveDefaults.default_order_cutoff_local} overriding={overrideDefaults}>
                      <Input type="time" value={defaultOrderCutoffLocal} onChange={(e) => setDefaultOrderCutoffLocal(e.target.value)} />
                    </InheritedField>
                  </div>
                </div>

                {/* Submit */}
                <Button
  className="w-full"
  onClick={handleSubmit}
  disabled={submitting || !selectedSubcategoryId || comboSelected.size === 0}
>
  {submitting ? (
    <>
      <Loader2 className="h-4 w-4  animate-spin" />
      Submitting…
    </>
  ) : (
    <>
      <Plus className="h-4 w-4 " />
      Add {comboSelected.size} variant{comboSelected.size !== 1 ? 's' : ''}
      {selectedCombosToCreate.length > 0 && ` (${selectedCombosToCreate.length} new`}
      {selectedCombosToCreate.length > 0 && selectedCombosToRestore.length > 0 && `, `}
      {selectedCombosToCreate.length > 0 && selectedCombosToRestore.length === 0 && `)`}
      {comboCore.size > 0 && ` · ${comboCore.size} core`}
    </>
  )}
</Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AddCategoryDialog
        open={showNewCategory}
        onOpenChange={setShowNewCategory}
        onCreated={(id) => {
          setSelectedCategoryId(id);
          setSelectedSubcategoryId('');
        }}
      />

      {selectedCategory && (
        <AddSubcategoryDialog
          open={showNewSubcategory}
          onOpenChange={setShowNewSubcategory}
          categoryId={selectedCategoryId}
          categoryCode2={selectedCategory.code2}
          categoryName={selectedCategory.name_en}
          categoryDefaults={{
            default_uom: selectedCategory.default_uom,
            default_moq: selectedCategory.default_moq,
            default_lead_time_days: selectedCategory.default_lead_time_days,
            default_delivery_time_days: selectedCategory.default_delivery_time_days,
            default_order_window_days: selectedCategory.default_order_window_days,
            default_order_cutoff_local: selectedCategory.default_order_cutoff_local,
          }}
          onCreated={(id) => {
            setSelectedSubcategoryId(id);
            setExcluded(new Set());
          }}
        />
      )}
    </>
  );
}

/* ─── Combo group row (recursive) ─── */
function ComboGroupRow({
  group,
  depth,
  selected,
  coreSet,
  onToggleSelect,
  onToggleGroupSelect,
  onToggleCore,
  onDelete,
}: {
  group: ComboGroupNode;
  depth: number;
  selected: Set<string>;
  coreSet: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleGroupSelect: (ids: string[]) => void;
  onToggleCore: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const allIds = group.items.map((c) => c.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const hasChildren = group.children.length > 0;

  return (
    <>
      <tr
        className="bg-muted/30 hover:bg-muted/50 cursor-pointer border-t border-border/30"
        onClick={() => setOpen(!open)}
      >
        <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={allSelected}
            onCheckedChange={() => onToggleGroupSelect(allIds)}
            className="h-3 w-3"
          />
        </td>
        <td colSpan={3} className="px-2 py-1">
          <div className="flex items-center gap-1.5" style={{ paddingLeft: `${depth * 14}px` }}>
            {open ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
            <span className="font-medium text-xs">{group.label}</span>
            <Badge variant="secondary" className="text-[9px] h-3.5 px-1">
              {allIds.length}
            </Badge>
          </div>
        </td>
      </tr>
      {open && (
        hasChildren
          ? group.children.map((child) => (
              <ComboGroupRow
                key={`${child.axisKey}:${child.label}`}
                group={child}
                depth={depth + 1}
                selected={selected}
                coreSet={coreSet}
                onToggleSelect={onToggleSelect}
                onToggleGroupSelect={onToggleGroupSelect}
                onToggleCore={onToggleCore}
                onDelete={onDelete}
              />
            ))
          : group.items.map((combo) => (
              <ComboItemRow
                key={combo.id}
                combo={combo}
                isSelected={selected.has(combo.id)}
                onToggleSelect={() => onToggleSelect(combo.id)}
                onToggleCore={() => onToggleCore(combo.id)}
                onDelete={() => onDelete(combo.id)}
                indent={(depth + 1) * 14}
              />
            ))
      )}
    </>
  );
}

/* ─── Single combo row ─── */
function ComboItemRow({
  combo,
  isSelected,
  onToggleSelect,
  onToggleCore,
  onDelete,
  indent = 0,
}: {
  combo: GeneratedCombo;
  isSelected: boolean;
  onToggleSelect: () => void;
  onToggleCore: () => void;
  onDelete: () => void;
  indent?: number;
}) {
  return (
    <tr className={cn(
      'border-t border-border/20 hover:bg-muted/20 transition-colors',
      isSelected && 'bg-primary/5'
    )}>
      <td className="px-2 py-1">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          className="h-3 w-3"
        />
      </td>
      <td
        className="px-2 py-1 truncate max-w-[300px]"
        title={combo.name}
        style={indent > 0 ? { paddingLeft: `${indent + 8}px` } : undefined}
      >
        <span className="flex items-center gap-1.5">
          <Package className="h-3 w-3 text-muted-foreground/40 shrink-0" />
          <span className="truncate">{combo.name}</span>
          {combo.variantLabel && (
            <Badge variant="outline" className="text-[9px] h-3.5 px-1 shrink-0">
              {combo.variantLabel}
            </Badge>
          )}
        </span>
      </td>
      <td className="px-2 py-1">
        <button
          onClick={onToggleCore}
          className="p-0.5 hover:scale-110 transition-transform"
        >
          <Star className={cn(
            'h-3.5 w-3.5 transition-colors',
            combo.isCore ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/25 hover:text-amber-400'
          )} />
        </button>
      </td>
      <td className="px-2 py-1">
        <button
          onClick={onDelete}
          className="p-0.5 hover:scale-110 transition-transform text-muted-foreground/30 hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </td>
    </tr>
  );
}