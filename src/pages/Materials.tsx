import { useState, useMemo } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout';
import { useMaterialsRegistry, type Category } from '@/hooks/useMaterialsRegistry';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Layers, FolderOpen, Box, Plus, MapPin, LayoutGrid, Settings2, Sparkles, X, Star } from 'lucide-react';
import { MaterialListView } from '@/components/materials/MaterialListView';
import { MaterialDetailView } from '@/components/materials/MaterialDetailView';
import { AddMaterialSheet } from '@/components/materials/AddMaterialSheet';
import { ConfigureSubcategorySheet } from '@/components/materials/ConfigureSubcategorySheet';
import { SubcategorySpecMetrics } from '@/components/materials/SubcategorySpecMetrics';
import { useSupplyDomainsBySubcategory } from '@/hooks/useSupplyDomains';
import { useSubcategoryAreas } from '@/hooks/useSubcategoryAreas';
import type { MaterialGroup } from '@/components/materials/MaterialCard';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { DeleteMaterialDialog } from '@/components/materials/DeleteMaterialDialog';
import { parseSizeFromCode } from '@/lib/coding-system';

// Convert Material hierarchy into flat MaterialGroup array — only active (non-deleted) materials
function buildMaterialGroups(category: Category, subcategoryId: string): MaterialGroup[] {
  const sub = category.subcategories.find((s) => s.id === subcategoryId);
  if (!sub) return [];

  const activeMaterials = sub.materials.filter(mat => mat.status !== 'deleted');

  return activeMaterials.map((mat) => {
    const firstVariant = mat.variants[0];
    const activeVariants = mat.variants.filter(v => v.status !== 'deleted');

    if (activeVariants.length === 0) return null;

    const codePrefix = firstVariant?.code
      ? firstVariant.code.substring(0, firstVariant.code.lastIndexOf('.'))
      : `MAT.${category.code2}.${String(sub.subcategory_no).padStart(2, '0')}.${String(mat.material_no).padStart(3, '0')}`;

    const anyCore = activeVariants.some((v) => v.is_core);

    return {
      material_no: mat.material_no,
      name: mat.name,
      name_ar: firstVariant?.name_ar,
      code_prefix: codePrefix,
      specs: firstVariant?.specs || {},
      image_url: activeVariants.find((v) => v.image_url)?.image_url || null,
      status: mat.status,
      is_core: anyCore,
      variant_count: activeVariants.length,
      subcategory_default_uom: sub.default_uom,
      category_default_uom: category.default_uom,
      variants: activeVariants.map((v) => ({
        id: v.id,
        variant_no: v.variant_no,
        name: v.name,
        size_cm: parseSizeFromCode(v.code),
        code: v.code,
        uom: v.uom,
        status: v.status,
        is_core: v.is_core,
        market_price_min_sar: v.market_price_min_sar,
        market_price_max_sar: v.market_price_max_sar,
      })),
    };
  }).filter(Boolean) as MaterialGroup[];
}

// Stats — count ONLY active (non-deleted) materials and variants
function RegistryStats({ categories }: { categories: Category[] }) {
  const totalSubcategories = categories.reduce((acc, c) => acc + c.subcategories.length, 0);

  let totalVariants = 0;
  let totalCore = 0;

  for (const cat of categories) {
    for (const sub of cat.subcategories) {
      for (const mat of sub.materials) {
        if (mat.status === 'deleted') continue;
        for (const v of mat.variants) {
          if (v.status === 'deleted') continue;
          totalVariants++;
          if (v.is_core) totalCore++;
        }
      }
    }
  }

  const stats = [
    { label: 'Categories', value: categories.length, icon: Layers, color: 'text-primary bg-primary/10' },
    { label: 'Subcategories', value: totalSubcategories, icon: FolderOpen, color: 'text-blue-500 bg-blue-500/10' },
    { label: 'Active Variants', value: totalVariants, icon: Box, color: 'text-emerald-500 bg-emerald-500/10' },
    { label: 'Core', value: totalCore, icon: Star, color: 'text-amber-600 bg-amber-500/10' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const Materials = () => {
  const { data: categories, isLoading, error } = useMaterialsRegistry();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [setupSheetOpen, setSetupSheetOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<string>('');
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialGroup | null>(null);
  const [groupByAxes, setGroupByAxes] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [variantToDelete, setVariantToDelete] = useState<{ id: string; name: string } | null>(null);
  
  // Delete confirmation dialog states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<'category' | 'subcategory' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; stats: any } | null>(null);

  const activeCategory = useMemo(() => {
    if (!categories?.length) return null;
    const catId = activeCategoryId || categories[0].id;
    return categories.find((c) => c.id === catId) || categories[0];
  }, [categories, activeCategoryId]);

  const activeSubcategory = useMemo(() => {
    if (!activeCategory?.subcategories.length) return null;
    const subId = activeSubcategoryId || activeCategory.subcategories[0]?.id;
    return activeCategory.subcategories.find((s) => s.id === subId) || activeCategory.subcategories[0];
  }, [activeCategory, activeSubcategoryId]);

  const materialGroups = useMemo(() => {
    if (!activeCategory || !activeSubcategory) return [];
    const groups = buildMaterialGroups(activeCategory, activeSubcategory.id);
    return [...groups].sort((a, b) => {
      if (a.is_core && !b.is_core) return -1;
      if (!a.is_core && b.is_core) return 1;
      return 0;
    });
  }, [activeCategory, activeSubcategory]);

  const specDefinitions = activeSubcategory?.spec_definitions || [];

  // ==================== HELPER FUNCTIONS FOR STATS ====================

  // جلب إحصائيات الـ Subcategory قبل الحذف
  const getSubcategoryStats = async (subcategoryId: string) => {
    const { count: materialsCount, error } = await supabase
      .from('materials')
      .select('*', { count: 'exact', head: true })
      .eq('subcategory_id', subcategoryId)
      .eq('status', 'active');
    
    if (error) {
      console.error('Error getting materials count:', error);
      return { materialsCount: 0 };
    }
    
    return { materialsCount: materialsCount || 0 };
  };

  // جلب إحصائيات الـ Category قبل الحذف
  const getCategoryStats = async (categoryId: string) => {
    // جلب الـ Subcategories
    const { data: subcategories, error: subError } = await supabase
      .from('material_subcategories')
      .select('id')
      .eq('category_id', categoryId)
      .eq('status', 'active');
    
    if (subError) {
      console.error('Error getting subcategories:', subError);
      return { subcategoriesCount: 0, materialsCount: 0 };
    }
    
    const subcategoryIds = subcategories?.map(s => s.id) || [];
    
    // جلب عدد المواد
    let materialsCount = 0;
    if (subcategoryIds.length > 0) {
      const { count, error: matError } = await supabase
        .from('materials')
        .select('*', { count: 'exact', head: true })
        .in('subcategory_id', subcategoryIds)
        .eq('status', 'active');
      
      if (!matError) {
        materialsCount = count || 0;
      }
    }
    
    return {
      subcategoriesCount: subcategoryIds.length,
      materialsCount: materialsCount
    };
  };

  // ==================== DELETE FUNCTIONS ====================

  const handleDeleteVariant = async (variantId: string, variantName: string) => {
    setVariantToDelete({ id: variantId, name: variantName });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteVariant = async () => {
    if (!variantToDelete) return;
    
    try {
      const { error: materialUpdateError } = await supabase
        .from('materials')
        .update({ status: 'deleted', updated_by: user?.id || null })
        .eq('id', variantToDelete.id);
        
      if (materialUpdateError) throw materialUpdateError;

      const { error: supplierMaterialUpdateError } = await supabase
        .from('supplier_materials')
        .update({ 
          status: 'deleted',
          is_current: false,
          updated_by: user?.id || null,
          updated_at: new Date().toISOString()
        })
        .eq('material_id', variantToDelete.id);
        
      if (supplierMaterialUpdateError) {
        console.error("Error updating supplier materials:", supplierMaterialUpdateError);
      }

      toast.success(`Variant "${variantToDelete.name}" deleted successfully`);
      
      queryClient.invalidateQueries({ queryKey: ['materials-registry'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-quotes'] });
      
      if (selectedMaterial) {
        setSelectedMaterial({
          ...selectedMaterial,
          variants: selectedMaterial.variants.filter((v) => v.id !== variantToDelete.id),
          variant_count: selectedMaterial.variant_count - 1,
        });
      }
      
      setDeleteDialogOpen(false);
      setVariantToDelete(null);
      
    } catch (err: unknown) {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // حذف Subcategory - فتح Dialog تأكيد
  const handleDeleteSubcategory = async (subcategoryId: string, subcategoryName: string) => {
    const stats = await getSubcategoryStats(subcategoryId);
    setDeleteTarget({
      id: subcategoryId,
      name: subcategoryName,
      stats: { materialsCount: stats.materialsCount }
    });
    setDeleteType('subcategory');
    setDeleteConfirmOpen(true);
  };

  // حذف Category - فتح Dialog تأكيد
  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    const stats = await getCategoryStats(categoryId);
    setDeleteTarget({
      id: categoryId,
      name: categoryName,
      stats: { 
        subcategoriesCount: stats.subcategoriesCount,
        materialsCount: stats.materialsCount 
      }
    });
    setDeleteType('category');
    setDeleteConfirmOpen(true);
  };

  // تأكيد الحذف الفعلي
  const confirmDelete = async () => {
    if (!deleteTarget || !deleteType) return;
    
    try {
      if (deleteType === 'subcategory') {
        // حذف Subcategory
        await supabase
          .from('materials')
          .update({ status: 'deleted', updated_by: user?.id || null, updated_at: new Date().toISOString() })
          .eq('subcategory_id', deleteTarget.id)
          .eq('status', 'active');
        
        await supabase
          .from('material_subcategories')
          .update({ status: 'deleted', updated_by: user?.id || null, updated_at: new Date().toISOString() })
          .eq('id', deleteTarget.id)
          .eq('status', 'active');
        
        toast.success(`Subcategory "${deleteTarget.name}" deleted successfully`);
        
      } else if (deleteType === 'category') {
        // حذف Category
        const { data: subcategories } = await supabase
          .from('material_subcategories')
          .select('id')
          .eq('category_id', deleteTarget.id)
          .eq('status', 'active');
        
        const subIds = subcategories?.map(s => s.id) || [];
        
        if (subIds.length > 0) {
          await supabase
            .from('materials')
            .update({ status: 'deleted', updated_by: user?.id || null, updated_at: new Date().toISOString() })
            .in('subcategory_id', subIds)
            .eq('status', 'active');
          
          await supabase
            .from('material_subcategories')
            .update({ status: 'deleted', updated_by: user?.id || null, updated_at: new Date().toISOString() })
            .in('id', subIds)
            .eq('status', 'active');
        }
        
        await supabase
          .from('material_categories')
          .update({ status: 'deleted', updated_by: user?.id || null, updated_at: new Date().toISOString() })
          .eq('id', deleteTarget.id)
          .eq('status', 'active');
        
        toast.success(`Category "${deleteTarget.name}" deleted successfully`);
      }
      
      queryClient.invalidateQueries({ queryKey: ['materials-registry'] });
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
      setDeleteType(null);
      
    } catch (err: unknown) {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleBulkVariantAction = async (variantIds: string[], action: 'delete' | 'core' | 'uncore') => {
    try {
      if (action === 'delete') {
        await supabase
          .from('materials')
          .update({ status: 'deleted', updated_by: user?.id || null })
          .in('id', variantIds)
          .eq('status', 'active');
        toast.success(`${variantIds.length} variant(s) deleted`);
      } else {
        const isCore = action === 'core';
        await supabase
          .from('materials')
          .update({ is_core: isCore, updated_by: user?.id || null })
          .in('id', variantIds);
        toast.success(`${variantIds.length} variant(s) updated`);
      }
      queryClient.invalidateQueries({ queryKey: ['materials-registry'] });
    } catch {
      toast.error('Failed to update materials');
    }
  };

  const handleVariantCoreChange = async (variantId: string, isCore: boolean) => {
    try {
      await supabase
        .from('materials')
        .update({ is_core: isCore, updated_by: user?.id || null })
        .eq('id', variantId);
      toast.success(isCore ? 'Marked as Core' : 'Core removed');
      queryClient.invalidateQueries({ queryKey: ['materials-registry'] });
    } catch {
      toast.error('Failed to update core status');
    }
  };

  const handleChangeImage = async (materialNo: number, file: File) => {
    if (!activeSubcategory) return;
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${activeSubcategory.id}/${materialNo}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('material-images')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('material-images')
        .getPublicUrl(path);

      const imageUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      await supabase
        .from('materials')
        .update({ image_url: imageUrl, updated_by: user?.id || null })
        .eq('subcategory_id', activeSubcategory.id)
        .eq('material_no', materialNo);
      
      toast.success('Image updated');
      queryClient.invalidateQueries({ queryKey: ['materials-registry'] });
    } catch {
      toast.error('Failed to upload image');
    }
  };

  return (
    <ProtectedRoute>
      <AppLayout title="Materials">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Materials Registry</h1>
              <p className="text-sm text-muted-foreground">
                Browse and manage materials by category, specs, and size variants
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <a href="/materials/addons">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Add-ons
                </a>
              </Button>
              <Button onClick={() => setAddSheetOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Material
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="space-y-2">
                          <Skeleton className="h-6 w-12" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-destructive">Failed to load materials registry</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error instanceof Error ? error.message : 'Unknown error'}
                </p>
              </CardContent>
            </Card>
          ) : categories && categories.length > 0 ? (
            <>
              <RegistryStats categories={categories} />

              {/* Category Tabs with X delete button */}
              <Tabs
                value={activeCategory?.id || ''}
                onValueChange={(id) => {
                  setActiveCategoryId(id);
                  setActiveSubcategoryId('');
                  setSelectedMaterial(null);
                }}
              >
                <TabsList className="flex-wrap">
                  {categories.map((cat) => (
                    <TabsTrigger key={cat.id} value={cat.id} className="group">
                      <span className="font-mono mr-1.5">{cat.code2}</span>
                      {cat.name_en}
                      <button
                        className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id, cat.name_en); }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </TabsTrigger>
                  ))}
                </TabsList>

                {categories.map((cat) => (
                  <TabsContent key={cat.id} value={cat.id}>
                    {cat.subcategories.length > 0 ? (
                      <Tabs
                        value={activeSubcategory?.id || ''}
                        onValueChange={(id) => {
                          setActiveSubcategoryId(id);
                          setSelectedMaterial(null);
                        }}
                      >
                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                          <TabsList className="flex-wrap">
                            {cat.subcategories.map((sub) => {
                              const activeVariantCount = sub.materials.reduce(
                                (acc, m) => acc + m.variants.filter((v) => v.status === 'active').length,
                                0
                              );
                              return (
                                <TabsTrigger key={sub.id} value={sub.id} className="group">
                                  {sub.name_en}
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    {activeVariantCount}
                                  </Badge>
                                  <button
                                    className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteSubcategory(sub.id, sub.name_en); }}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </TabsTrigger>
                              );
                            })}
                          </TabsList>
                          {activeSubcategory && (
                            <>
                              <SubcategorySpecMetrics subcategory={activeSubcategory} />
                              <SubcategorySetupChip
                                subcategoryId={activeSubcategory.id}
                                domainAxis={(activeSubcategory as any).domain_axis || null}
                                specDefinitions={activeSubcategory.spec_definitions || []}
                                onOpen={() => setSetupSheetOpen(true)}
                              />
                            </>
                          )}
                        </div>

                        {cat.subcategories.map((sub) => (
                          <TabsContent key={sub.id} value={sub.id} className="space-y-4">
                            {selectedMaterial ? (
                              <MaterialDetailView
                                material={selectedMaterial}
                                specDefinitions={specDefinitions}
                                onBack={() => setSelectedMaterial(null)}
                                onDeleteVariant={handleDeleteVariant} 
                                onToggleVariantCore={handleVariantCoreChange}
                                onChangeImage={handleChangeImage}
                              />
                            ) : (
                              <>
                                {activeSubcategory && (
                                  <SubcategorySetupBanner
                                    subcategoryId={activeSubcategory.id}
                                    onOpen={() => setSetupSheetOpen(true)}
                                  />
                                )}
                                <MaterialListView
                                  materials={materialGroups}
                                  specDefinitions={specDefinitions}
                                  variantAxis={activeSubcategory?.variant_definitions ? {
                                    key: (activeSubcategory.variant_definitions as any).key,
                                    label: (activeSubcategory.variant_definitions as any).label_en,
                                  } : null}
                                  onDeleteVariant={handleDeleteVariant}
                                  onToggleCoreVariant={handleVariantCoreChange}
                                  onBulkVariantAction={handleBulkVariantAction}
                                  onSelectMaterial={setSelectedMaterial}
                                  groupByAxes={groupByAxes}
                                  onGroupByChange={setGroupByAxes}
                                />
                              </>
                            )}
                          </TabsContent>
                        ))}
                      </Tabs>
                    ) : (
                      <div className="py-12 text-center text-muted-foreground">
                        <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
                        <p>No subcategories defined for this category</p>
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Layers className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-1">No materials registered</h3>
                <p className="text-sm text-muted-foreground">
                  The materials registry is empty.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {categories && (
          <AddMaterialSheet
            open={addSheetOpen}
            onOpenChange={setAddSheetOpen}
            categories={categories}
          />
        )}

        {activeSubcategory && (
          <ConfigureSubcategorySheet
            open={setupSheetOpen}
            onOpenChange={setSetupSheetOpen}
            subcategoryId={activeSubcategory.id}
            initial={{
              name_en: activeSubcategory.name_en,
              name_ar: (activeSubcategory as any).name_ar || null,
              spec_definitions: activeSubcategory.spec_definitions || [],
              variant_definitions: (activeSubcategory as any).variant_definitions || null,
              domain_axis: (activeSubcategory as any).domain_axis || null,
            }}
          />
        )}
        
        {/* Delete Confirmation Dialog for Variant */}
        {variantToDelete && (
          <DeleteMaterialDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            variantId={variantToDelete.id}
            variantName={variantToDelete.name}
            onConfirmDelete={confirmDeleteVariant}
          />
        )}

        {/* Delete Confirmation Dialog for Category/Subcategory */}
        {deleteConfirmOpen && deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-background rounded-lg shadow-lg w-full max-w-md mx-4">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">Delete {deleteType === 'category' ? 'Category' : 'Subcategory'}</h2>
                <button
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="p-1 hover:bg-muted rounded-full transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Content */}
              <div className="p-4 space-y-4">
                <p className="text-sm">
                  Are you sure you want to delete <span className="font-semibold">"{deleteTarget.name}"</span>?
                </p>
                
                {/* Warning for referenced items */}
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-destructive">This will also delete:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    {deleteType === 'category' && (
                      <>
                        <li>{deleteTarget.stats.subcategoriesCount} subcategor{deleteTarget.stats.subcategoriesCount === 1 ? 'y' : 'ies'}</li>
                        <li>{deleteTarget.stats.materialsCount} material{deleteTarget.stats.materialsCount !== 1 ? 's' : ''}</li>
                      </>
                    )}
                    {deleteType === 'subcategory' && (
                      <li>{deleteTarget.stats.materialsCount} material{deleteTarget.stats.materialsCount !== 1 ? 's' : ''}</li>
                    )}
                  </ul>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  This action cannot be undone. The {deleteType === 'category' ? 'category' : 'subcategory'} will be permanently removed from the registry.
                </p>
              </div>
              
              {/* Footer */}
              <div className="flex items-center justify-end gap-2 p-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirmOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={confirmDelete}
                >
                  Delete Permanently
                </Button>
              </div>
            </div>
          </div>
        )}
      </AppLayout>
    </ProtectedRoute>
  );
};

// Subcategory Setup status chip
function SubcategorySetupChip({
  subcategoryId,
  domainAxis,
  specDefinitions,
  onOpen,
}: {
  subcategoryId: string;
  domainAxis: string | null;
  specDefinitions: { key: string; label_en: string; options: { value: string }[] }[];
  onOpen: () => void;
}) {
  const { data: domains } = useSupplyDomainsBySubcategory(subcategoryId);
  const { data: areas } = useSubcategoryAreas(subcategoryId);
  const activeDomains = domains?.filter(d => d.status === 'active').length || 0;
  const areaCount = areas?.length || 0;

  const axisLabel = domainAxis
    ? specDefinitions.find(s => s.key === domainAxis)?.label_en || domainAxis
    : null;

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="gap-1.5 text-xs font-normal">
        <MapPin className="h-3 w-3" />
        {areaCount} area{areaCount === 1 ? '' : 's'}
        <span className="text-muted-foreground/60">·</span>
        <LayoutGrid className="h-3 w-3" />
        {activeDomains} domain{activeDomains === 1 ? '' : 's'}
        {axisLabel && (
          <>
            <span className="text-muted-foreground/60">·</span>
            <span className="text-muted-foreground">by {axisLabel}</span>
          </>
        )}
      </Badge>
      <Button variant="outline" size="sm" onClick={onOpen}>
        <Settings2 className="h-3.5 w-3.5 mr-1" />
        Configure
      </Button>
    </div>
  );
}

// Empty-state banner
function SubcategorySetupBanner({
  subcategoryId,
  onOpen,
}: {
  subcategoryId: string;
  onOpen: () => void;
}) {
  const { data: areas } = useSubcategoryAreas(subcategoryId);
  const { data: domains } = useSupplyDomainsBySubcategory(subcategoryId);

  const hasAreas = (areas?.length || 0) > 0;
  const hasDomains = (domains?.filter(d => d.status === 'active').length || 0) > 0;

  if (hasAreas && hasDomains) return null;

  return (
    <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-3 flex items-center gap-3">
      <Sparkles className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">No supply setup yet</p>
        <p className="text-xs text-muted-foreground">
          Define geographic areas and grouping to generate supply domains for this subcategory.
        </p>
      </div>
      <Button size="sm" onClick={onOpen}>
        <Settings2 className="h-3.5 w-3.5 mr-1" />
        Configure subcategory
      </Button>
    </div>
  );
}

export default Materials;