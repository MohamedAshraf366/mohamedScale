import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseSpecsFromCode } from '@/lib/coding-system';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, ChevronRight, ChevronLeft, Package, Filter, Plus, Truck, MapPin, Target } from 'lucide-react';
import { useZoneDeliveryAvailability } from '@/hooks/useZoneDeliveryAvailability';
import { cn } from '@/lib/utils';
import { resolveInherited } from '@/lib/resolve-inherited';
import { composeMaterialName } from '@/lib/composeMaterialName';

interface CategoryOption {
  id: string;
  code2: string;
  name_en: string;
  name_ar: string | null;
}

interface SubcategoryOption {
  id: string;
  name_en: string;
  name_ar: string | null;
  category_id: string;
  spec_definitions: SpecDefinition[] | null;
  default_moq: number | null;
}

interface SpecDefinition {
  key: string;
  label?: string;
  label_en?: string;
  label_ar?: string;
  type?: string;
  options?: Array<{
    value: string;
    label?: string;
    label_en?: string;
    label_ar?: string;
    code_digit?: string;
  }>;
}

interface MaterialOption {
  id: string;
  name: string;
  name_en: string | null;
  code: string | null;
  uom: string | null;
  specs: Record<string, unknown>;
  subcategory_id: string | null;
}

export interface PickedMaterial {
  id: string;
  name: string;
  code: string | null;
  uom: string;
  moq?: number | null;
}

interface SupplierForMaterial {
  supplier_account_id: string;
  supplier_name: string;
}

interface MaterialStepPickerProps {
  excludeIds?: string[];
  onSelect?: (material: PickedMaterial) => void;
  /** Called with all checked items on bulk add – avoids stale-state bug */
  onBulkSelect?: (materials: PickedMaterial[]) => void;
  multi?: boolean;
  className?: string;
  zoneCode?: string | null;
  hideSupplierFilter?: boolean;
  showTargetPriceStatus?: boolean;
  /** @deprecated */
  supplierCounts?: Record<string, number>;
}

type Step = 'category' | 'subcategory' | 'specs' | 'material';

// ─── Internal hook: fetch approved supplier_materials grouped by material_id ───
function useSupplierMaterialMap() {
  return useQuery({
    queryKey: ['supplier-material-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_materials')
        .select('material_id, supplier_account_id')
        .eq('is_current', true)
        .eq('status', 'approved');
      if (error) throw error;

      const supplierIds = [...new Set((data || []).map((row) => row.supplier_account_id))];
      const accountMap = new Map<string, string>();
      if (supplierIds.length > 0) {
        const { data: accounts } = await supabase
          .from('accounts')
          .select('id, display_name').is('deleted_at', null)
          .in('id', supplierIds);
        (accounts || []).forEach((account) => accountMap.set(account.id, account.display_name || 'Unknown'));
      }

      const map = new Map<string, { count: number; suppliers: SupplierForMaterial[] }>();
      for (const row of data || []) {
        if (!map.has(row.material_id)) {
          map.set(row.material_id, { count: 0, suppliers: [] });
        }

        const entry = map.get(row.material_id)!;
        if (!entry.suppliers.some((supplier) => supplier.supplier_account_id === row.supplier_account_id)) {
          entry.count++;
          entry.suppliers.push({
            supplier_account_id: row.supplier_account_id,
            supplier_name: accountMap.get(row.supplier_account_id) || 'Unknown',
          });
        }
      }

      return map;
    },
    staleTime: 60_000,
  });
}

export function MaterialStepPicker({
  excludeIds = [],
  onSelect,
  onBulkSelect,
  multi = false,
  className,
  zoneCode,
  hideSupplierFilter = false,
  showTargetPriceStatus = false,
}: MaterialStepPickerProps) {
  const [step, setStep] = useState<Step>('category');
  const [selectedCategory, setSelectedCategory] = useState<CategoryOption | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<SubcategoryOption | null>(null);
  const [specFilters, setSpecFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  // Supplier filters
  const [withSuppliersOnly, setWithSuppliersOnly] = useState(!hideSupplierFilter);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all');
  const [deliversToZoneOnly, setDeliversToZoneOnly] = useState(false);

  const { data: supplierMap } = useSupplierMaterialMap();

  // Target price map – only fetched when showTargetPriceStatus is true
  const { data: targetPriceSet } = useQuery({
    queryKey: ['target-price-material-set'],
    enabled: showTargetPriceStatus,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('target_prices')
        .select('material_id');
      if (error) throw error;
      return new Set((data || []).map(r => r.material_id));
    },
    staleTime: 60_000,
  });
  const {
    supplierMaterialIdSet,
    isFetched: hasZoneDeliveryData,
  } = useZoneDeliveryAvailability(zoneCode);

  const { data: smLinkData } = useQuery({
    queryKey: ['approved-sm-link-for-zone', zoneCode],
    enabled: !!zoneCode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_materials')
        .select('id, material_id, supplier_account_id')
        .eq('is_current', true)
        .eq('status', 'approved');
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const deliveryStats = useMemo(() => {
    if (!zoneCode || !smLinkData) return null;

    const map = new Map<string, { total: number; delivering: number }>();
    const byMaterial = new Map<string, Array<{ smId: string; supplierId: string }>>();

    for (const supplierMaterial of smLinkData) {
      if (!byMaterial.has(supplierMaterial.material_id)) {
        byMaterial.set(supplierMaterial.material_id, []);
      }
      byMaterial.get(supplierMaterial.material_id)!.push({
        smId: supplierMaterial.id,
        supplierId: supplierMaterial.supplier_account_id,
      });
    }

    for (const [materialId, entries] of byMaterial) {
      const uniqueSuppliers = new Set(entries.map((entry) => entry.supplierId));
      const deliveringSuppliers = new Set(
        entries
          .filter((entry) => supplierMaterialIdSet.has(entry.smId))
          .map((entry) => entry.supplierId)
      );

      map.set(materialId, {
        total: uniqueSuppliers.size,
        delivering: deliveringSuppliers.size,
      });
    }

    return map;
  }, [zoneCode, smLinkData, supplierMaterialIdSet]);

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['material-categories-picker'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_categories')
        .select('id, code2, name_en, name_ar')
        .eq('status', 'active')
        .order('code2');
      if (error) throw error;
      return data as CategoryOption[];
    },
  });

  // Fetch subcategories for selected category
  const { data: subcategories } = useQuery({
    queryKey: ['material-subcategories-picker', selectedCategory?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_subcategories')
        .select('id, name_en, name_ar, category_id, spec_definitions, default_moq, default_uom')
        .eq('category_id', selectedCategory!.id)
        .eq('status', 'active')
        .order('subcategory_no');
      if (error) throw error;
      return (data || []).map(d => ({
        ...d,
        spec_definitions: Array.isArray(d.spec_definitions) ? d.spec_definitions as unknown as SpecDefinition[] : null,
      })) as (SubcategoryOption & { default_uom: string | null })[];
    },
    enabled: !!selectedCategory?.id,
  });

  // Fetch materials for selected subcategory
  const { data: materials } = useQuery({
    queryKey: ['materials-picker', selectedSubcategory?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, name_en, code, uom, subcategory_id, default_moq')
        .eq('subcategory_id', selectedSubcategory!.id)
        .eq('status', 'active')
        .order('material_no, variant_no');
      if (error) throw error;
      const sub = selectedSubcategory as any;
      return (data || []).map(m => ({
        ...m,
        specs: parseSpecsFromCode(m.code, sub),
      })) as MaterialOption[];
    },
    enabled: !!selectedSubcategory?.id,
  });

  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);

  // Global search across all materials (active when globalSearch is non-empty)
  const trimmedGlobal = globalSearch.trim();
  const { data: globalResults } = useQuery({
    queryKey: ['materials-global-search', trimmedGlobal],
    enabled: trimmedGlobal.length >= 2,
    queryFn: async () => {
      const q = trimmedGlobal.replace(/[%,]/g, ' ');
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, name_en, name_ar, code, uom, subcategory_id, default_moq')
        .or(`name.ilike.%${q}%,name_en.ilike.%${q}%,name_ar.ilike.%${q}%,code.ilike.%${q}%`)
        .eq('status', 'active')
        .limit(100);
      if (error) throw error;
      // Global search: specs not hydrated (would require batched subcategory lookup).
      return (data || []).map(m => ({
        ...m,
        specs: {} as Record<string, unknown>,
      })) as MaterialOption[];
    },
    staleTime: 30_000,
  });

  // Unique supplier list for dropdown (from all materials in current view)
  const allSuppliers = useMemo(() => {
    if (!supplierMap) return [];
    const seen = new Map<string, string>();
    supplierMap.forEach(entry => {
      entry.suppliers.forEach(s => {
        if (!seen.has(s.supplier_account_id)) {
          seen.set(s.supplier_account_id, s.supplier_name);
        }
      });
    });
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [supplierMap]);

  // Apply spec + supplier filters to materials
  const filteredMaterials = useMemo(() => {
    if (!materials) return [];
    return materials.filter(m => {
      if (excludeSet.has(m.id)) return false;

      // Check spec filters
      for (const [key, value] of Object.entries(specFilters)) {
        if (!value) continue;
        const matSpec = String(m.specs[key] || '');
        if (matSpec !== value) return false;
      }

      // Supplier filters
      if (supplierMap) {
        const entry = supplierMap.get(m.id);
        if (withSuppliersOnly && (!entry || entry.count === 0)) return false;
        if (selectedSupplierId !== 'all') {
          if (!entry || !entry.suppliers.some(s => s.supplier_account_id === selectedSupplierId)) return false;
        }
      }

      // Zone delivery filter
      if (deliversToZoneOnly && zoneCode && deliveryStats) {
        const stats = deliveryStats.get(m.id);
        if (!stats || stats.delivering === 0) return false;
      }

      // Search filter
      if (search) {
        const q = search.toLowerCase();
        return (
          m.name?.toLowerCase().includes(q) ||
          m.name_en?.toLowerCase().includes(q) ||
          m.code?.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [materials, search, excludeSet, specFilters, supplierMap, withSuppliersOnly, selectedSupplierId, deliversToZoneOnly, zoneCode, deliveryStats]);

  const specDefs = selectedSubcategory?.spec_definitions || [];
  const hasSpecs = specDefs.length > 0;

  // Compute available values for each spec dropdown based on current filters
  const availableSpecValues = useMemo(() => {
    if (!materials || !hasSpecs) return {};
    const result: Record<string, Set<string>> = {};

    specDefs.forEach(def => {
      result[def.key] = new Set();
    });

    materials.filter(m => !excludeSet.has(m.id)).forEach(m => {
      specDefs.forEach(def => {
        let matches = true;
        for (const [key, value] of Object.entries(specFilters)) {
          if (!value || key === def.key) continue;
          if (String(m.specs[key] || '') !== value) { matches = false; break; }
        }
        if (matches) {
          const val = String(m.specs[def.key] || '');
          if (val) result[def.key].add(val);
        }
      });
    });

    return result;
  }, [materials, specFilters, specDefs, excludeSet, hasSpecs]);

  const handleCategorySelect = (cat: CategoryOption) => {
    setSelectedCategory(cat);
    setSelectedSubcategory(null);
    setSpecFilters({});
    setSearch('');
    setStep('subcategory');
  };

  const handleSubcategorySelect = (sub: SubcategoryOption) => {
    setSelectedSubcategory(sub);
    setSpecFilters({});
    setSearch('');
    const defs = sub.spec_definitions || [];
    if (defs.length > 0) {
      setStep('specs');
    } else {
      setStep('material');
    }
  };

  // Compute display name for a material: uses subcategory spec_definitions when
  // the material belongs to the currently selected subcategory; otherwise falls
  // back to the persisted DB name (used by global-search results).
  const displayName = (mat: MaterialOption): string => {
    if (
      selectedSubcategory &&
      mat.subcategory_id === selectedSubcategory.id &&
      selectedSubcategory.spec_definitions
    ) {
      const rawMat = mat as any;
      const computed = composeMaterialName(
        {
          specs: mat.specs,
          size_cm: rawMat.size_cm ?? null,
          variant_value: rawMat.size_cm ?? undefined,
        },
        {
          name_en: selectedSubcategory.name_en,
          name_ar: selectedSubcategory.name_ar,
          spec_definitions: selectedSubcategory.spec_definitions as any,
        },
        'en',
      );
      if (computed) return computed;
    }
    return mat.name;
  };

  const toPicked = (mat: MaterialOption): PickedMaterial => {
    const subUom = (selectedSubcategory as any)?.default_uom ?? null;
    return {
      id: mat.id,
      name: displayName(mat),
      code: mat.code,
      uom: resolveInherited<string>(
        'uom_like',
        [
          mat.uom ? { uom_like: mat.uom } : null,
          subUom ? { uom_like: subUom } : null,
        ],
        'unit',
      ),
      moq: resolveInherited<number | null>('default_moq', [mat as any, selectedSubcategory as any], null),
    };
  };

  const handleMaterialSelect = (mat: MaterialOption) => {
    onSelect?.(toPicked(mat));
  };

  const toggleChecked = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkAdd = () => {
    // Pull from whichever pool is active: global search results, filtered materials, or both
    const pool: MaterialOption[] = trimmedGlobal.length >= 2
      ? (globalResults || [])
      : (materials || []);
    const toAdd = pool.filter(m => checkedIds.has(m.id));
    const picked: PickedMaterial[] = toAdd.map(toPicked);
    if (onBulkSelect) {
      onBulkSelect(picked);
    } else if (onSelect) {
      picked.forEach(p => onSelect(p));
    }
    setCheckedIds(new Set());
  };

  const handleSelectAll = () => {
    const allIds = new Set(filteredMaterials.map(m => m.id));
    setCheckedIds(prev => {
      // If all are already checked, uncheck all
      const allChecked = filteredMaterials.every(m => prev.has(m.id));
      if (allChecked) return new Set();
      return allIds;
    });
  };

  const goBack = () => {
    if (step === 'material' && hasSpecs) {
      setStep('specs');
      setSearch('');
    } else if (step === 'material' || step === 'specs') {
      setStep('subcategory');
      setSelectedSubcategory(null);
      setSpecFilters({});
      setSearch('');
    } else if (step === 'subcategory') {
      setStep('category');
      setSelectedCategory(null);
      setSearch('');
    }
  };

  // Breadcrumb
  const breadcrumb = (
    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3 flex-wrap">
      <button
        type="button"
        className={cn('hover:text-foreground transition-colors', step === 'category' && 'text-foreground font-medium')}
        onClick={() => { setStep('category'); setSelectedCategory(null); setSelectedSubcategory(null); setSpecFilters({}); setSearch(''); }}
      >
        Category
      </button>
      {selectedCategory && (
        <>
          <ChevronRight className="h-3 w-3" />
          <button
            type="button"
            className={cn('hover:text-foreground transition-colors', step === 'subcategory' && 'text-foreground font-medium')}
            onClick={() => { setStep('subcategory'); setSelectedSubcategory(null); setSpecFilters({}); setSearch(''); }}
          >
            {selectedCategory.name_en}
          </button>
        </>
      )}
      {selectedSubcategory && (
        <>
          <ChevronRight className="h-3 w-3" />
          <button
            type="button"
            className={cn('hover:text-foreground transition-colors', (step === 'specs' || step === 'material') && 'text-foreground font-medium')}
            onClick={() => {
              if (hasSpecs) { setStep('specs'); setSearch(''); }
            }}
          >
            {selectedSubcategory.name_en}
          </button>
        </>
      )}
      {step === 'material' && hasSpecs && (
        <>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">Materials</span>
        </>
      )}
    </div>
  );

  // ─── Supplier filter bar (shown on material step) ───
  const supplierFilterBar = (
    <div className="flex items-center gap-3 flex-wrap py-1.5 px-1">
      <div className="flex items-center gap-2">
        <Switch
          id="with-suppliers"
          checked={withSuppliersOnly}
          onCheckedChange={setWithSuppliersOnly}
          className="scale-90"
        />
        <Label htmlFor="with-suppliers" className="text-xs font-medium cursor-pointer flex items-center gap-1">
          <Truck className="h-3 w-3" />
          With suppliers
        </Label>
      </div>

      {zoneCode && hasZoneDeliveryData && (
        <div className="flex items-center gap-2">
          <Switch
            id="delivers-to-zone"
            checked={deliversToZoneOnly}
            onCheckedChange={setDeliversToZoneOnly}
            className="scale-90"
          />
          <Label htmlFor="delivers-to-zone" className="text-xs font-medium cursor-pointer flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            Delivers to zone
          </Label>
        </div>
      )}

      <Select
        value={selectedSupplierId}
        onValueChange={setSelectedSupplierId}
      >
        <SelectTrigger className="h-7 text-xs w-[180px]">
          <SelectValue placeholder="All suppliers" />
        </SelectTrigger>
        <SelectContent className="bg-popover">
          <SelectItem value="all">All suppliers</SelectItem>
          {allSuppliers.map(s => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const isSearching = trimmedGlobal.length >= 2;
  const flatResults = (globalResults || []).filter(m => !excludeSet.has(m.id));

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search by name (English/Arabic) or code…"
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          className="h-9 pl-8 text-sm"
        />
      </div>

      {!isSearching && breadcrumb}

      {isSearching && (
        <div className="space-y-2">
          {multi && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-muted/50 border">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={flatResults.length > 0 && flatResults.every(m => checkedIds.has(m.id))}
                  onCheckedChange={() => {
                    const all = flatResults.every(m => checkedIds.has(m.id));
                    setCheckedIds(prev => {
                      const next = new Set(prev);
                      if (all) flatResults.forEach(m => next.delete(m.id));
                      else flatResults.forEach(m => next.add(m.id));
                      return next;
                    });
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  {checkedIds.size > 0
                    ? <span className="font-medium text-primary">{checkedIds.size} selected</span>
                    : `${flatResults.length} result${flatResults.length === 1 ? '' : 's'}`}
                </span>
              </div>
              {checkedIds.size > 0 && (
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCheckedIds(new Set())}>Clear</Button>
                  <Button type="button" size="sm" className="h-7 text-xs gap-1" onClick={handleBulkAdd}>
                    <Plus className="h-3 w-3" />
                    Add Selected
                  </Button>
                </div>
              )}
            </div>
          )}
          <ScrollArea className="h-[320px]">
            <div className="space-y-0.5">
              {flatResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No materials found</p>
              ) : flatResults.map(m => {
                const smEntry = supplierMap?.get(m.id);
                const supplierCount = smEntry?.count || 0;
                return (
                  <div
                    key={m.id}
                    className="w-full px-3 py-2 hover:bg-accent rounded-md flex items-center gap-2.5 cursor-pointer"
                    onClick={() => multi ? toggleChecked(m.id) : handleMaterialSelect(m)}
                  >
                    {multi && (
                      <Checkbox
                        checked={checkedIds.has(m.id)}
                        onCheckedChange={() => toggleChecked(m.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium block truncate">{displayName(m)}</span>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {m.code && <span className="text-xs text-muted-foreground font-mono">{m.code}</span>}
                        <span className="text-xs text-muted-foreground">{m.uom}</span>
                        <Badge variant={supplierCount > 0 ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0">
                          <Truck className="h-2.5 w-2.5 mr-0.5" />
                          {supplierCount} supplier{supplierCount !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {!isSearching && (<>

      {/* Step: Category */}
      {step === 'category' && (
        <div className="grid grid-cols-2 gap-2">
          {categories?.map(cat => (
            <button
              key={cat.id}
              type="button"
              className="flex items-center gap-2 p-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
              onClick={() => handleCategorySelect(cat)}
            >
              <Package className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{cat.name_en}</div>
                <div className="text-xs text-muted-foreground font-mono">{cat.code2}</div>
              </div>
              <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground shrink-0" />
            </button>
          ))}
          {(!categories || categories.length === 0) && (
            <p className="text-sm text-muted-foreground col-span-2 text-center py-4">No categories found</p>
          )}
        </div>
      )}

      {/* Step: Subcategory */}
      {step === 'subcategory' && (
        <div className="space-y-2">
          <Button type="button" variant="ghost" size="sm" onClick={goBack} className="h-7 text-xs -ml-2">
            <ChevronLeft className="h-3 w-3 mr-1" />
            Back
          </Button>
          <div className="grid grid-cols-1 gap-1.5">
            {subcategories?.map(sub => (
              <button
                key={sub.id}
                type="button"
                className="flex items-center gap-2 px-3 py-2.5 rounded-md hover:bg-accent transition-colors text-left"
                onClick={() => handleSubcategorySelect(sub)}
              >
                <span className="text-sm font-medium">{sub.name_en}</span>
                <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
              </button>
            ))}
            {(!subcategories || subcategories.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No subcategories found</p>
            )}
          </div>
        </div>
      )}

      {/* Step: Spec Filters */}
      {step === 'specs' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={goBack} className="h-7 text-xs shrink-0">
              <ChevronLeft className="h-3 w-3 mr-1" />
              Back
            </Button>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Filter by specifications
            </div>
          </div>

          <div className="space-y-3">
            {specDefs.map(def => {
              const defLabel = def.label_en || def.label || def.key;
              const availableValues = Array.from(availableSpecValues[def.key] || []).sort();
              return (
                <div key={def.key} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{defLabel}</label>
                  <Select
                    value={specFilters[def.key] || ''}
                    onValueChange={(val) => {
                      setSpecFilters(prev => ({ ...prev, [def.key]: val === '__clear__' ? '' : val }));
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder={`All ${defLabel}`} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="__clear__">All {defLabel}</SelectItem>
                      {def.options ? (
                        def.options
                          .filter(opt => availableValues.includes(opt.value))
                          .map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label_en || opt.label || opt.value}</SelectItem>
                          ))
                      ) : (
                        availableValues.map(val => (
                          <SelectItem key={val} value={val}>{val}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>

          <div className="pt-2">
            <Button
              type="button"
              className="w-full gap-2"
              onClick={() => { setSearch(''); setStep('material'); }}
            >
              Show Materials
              <Badge variant="secondary" className="text-xs">{filteredMaterials.length}</Badge>
            </Button>
          </div>
        </div>
      )}

      {/* Step: Material */}
      {step === 'material' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={goBack} className="h-7 text-xs shrink-0">
              <ChevronLeft className="h-3 w-3 mr-1" />
              Back
            </Button>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search materials..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 pl-8 text-sm"
                autoFocus
              />
            </div>
          </div>

          {/* Supplier filter bar */}
          {!hideSupplierFilter && supplierFilterBar}

          {/* Active spec filter badges */}
          {Object.entries(specFilters).some(([, v]) => v) && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(specFilters).filter(([, v]) => v).map(([key, value]) => {
                const def = specDefs.find(d => d.key === key);
                const defLabel = def?.label_en || def?.label || key;
                const optLabel = def?.options?.find(o => o.value === value)?.label_en || def?.options?.find(o => o.value === value)?.label || value;
                return (
                  <Badge key={key} variant="outline" className="text-xs gap-1 cursor-pointer" onClick={() => {
                    setSpecFilters(prev => ({ ...prev, [key]: '' }));
                  }}>
                    {defLabel}: {optLabel}
                    <span className="ml-0.5">×</span>
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Select All + Bulk action bar */}
          <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-muted/50 border">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={filteredMaterials.length > 0 && filteredMaterials.every(m => checkedIds.has(m.id))}
                onCheckedChange={handleSelectAll}
                className="shrink-0"
              />
              <span className="text-xs text-muted-foreground">
                {checkedIds.size > 0
                  ? <span className="font-medium text-primary">{checkedIds.size} selected</span>
                  : `Select all (${filteredMaterials.length})`
                }
              </span>
            </div>
            <div className="flex gap-2">
              {checkedIds.size > 0 && (
                <>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCheckedIds(new Set())}>
                    Clear
                  </Button>
                  <Button type="button" size="sm" className="h-7 text-xs gap-1" onClick={handleBulkAdd}>
                    <Plus className="h-3 w-3" />
                    Add Selected
                  </Button>
                </>
              )}
            </div>
          </div>

          <ScrollArea className="h-[240px]">
            <div className="space-y-0.5">
              {filteredMaterials.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No materials found</p>
              ) : (
                filteredMaterials.map(m => {
                  const smEntry = supplierMap?.get(m.id);
                  const supplierCount = smEntry?.count || 0;
                  const supplierNames = smEntry?.suppliers.map(s => s.supplier_name).join(', ') || '';

                  return (
                    <div
                      key={m.id}
                      className="w-full px-3 py-2 hover:bg-accent rounded-md flex items-center gap-2.5 transition-colors group cursor-pointer"
                      onClick={() => toggleChecked(m.id)}
                    >
                      <Checkbox
                        checked={checkedIds.has(m.id)}
                        onCheckedChange={() => toggleChecked(m.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1 text-left">
                        <span className="text-sm font-medium block truncate">{displayName(m)}</span>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {m.code && (
                            <span className="text-xs text-muted-foreground font-mono">{m.code}</span>
                          )}
                          <span className="text-xs text-muted-foreground">{m.uom}</span>
                          {/* Target price badge */}
                          {showTargetPriceStatus && targetPriceSet && (
                            <Badge
                              variant={targetPriceSet.has(m.id) ? "secondary" : "destructive"}
                              className={cn(
                                "text-[10px] px-1.5 py-0",
                                targetPriceSet.has(m.id) && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                              )}
                            >
                              <Target className="h-2.5 w-2.5 mr-0.5" />
                              {targetPriceSet.has(m.id) ? 'Target set' : 'No target'}
                            </Badge>
                          )}
                          <Badge
                            variant={supplierCount > 0 ? "secondary" : "outline"}
                            className="text-[10px] px-1.5 py-0"
                            title={supplierNames}
                          >
                            <Truck className="h-2.5 w-2.5 mr-0.5" />
                            {supplierCount} supplier{supplierCount !== 1 ? "s" : ""}
                          </Badge>
                          {/* Delivery zone tag */}
                          {zoneCode && deliveryStats && supplierCount > 0 && (() => {
                            const stats = deliveryStats.get(m.id);
                            const delivering = stats?.delivering || 0;
                            return (
                              <Badge
                                variant={delivering > 0 ? "secondary" : "destructive"}
                                className={cn(
                                  "text-[10px] px-1.5 py-0",
                                  delivering > 0 ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : ""
                                )}
                              >
                                <MapPin className="h-2.5 w-2.5 mr-0.5" />
                                {delivering} deliver{delivering !== 1 ? "" : "s"} to zone
                              </Badge>
                            );
                          })()}
                        </div>
                        {supplierCount > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={supplierNames}>
                            {supplierNames}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      )}
      </>)}
    </div>
  );
}
