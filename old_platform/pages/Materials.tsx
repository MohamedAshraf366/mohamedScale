import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, Search, ArrowUpDown, ArrowUp, ArrowDown, Filter, ChevronDown, ChevronRight, 
  Pencil, Trash2, MoreVertical, Box, Package, Bolt, Wine, Boxes, Hammer, Layers, 
  FileText, Cable, Wrench, Zap, Droplet, Grid3x3, CircleDot, Square, Circle, 
  Triangle, Diamond, Hexagon, Star, Cpu, Truck, Home, Building, Factory, GitCompare, History 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import MaterialDialog from '@/components/MaterialDialog';
import SupplierComparisonDialog from '@/components/SupplierComparisonDialog';
import PriceHistoryDialog from '@/components/PriceHistoryDialog';
import CategoryEditDialog from '@/components/CategoryEditDialog';
import CategoryDeleteDialog from '@/components/CategoryDeleteDialog';
import CategoryAddDialog from '@/components/CategoryAddDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTranslation } from 'react-i18next';

interface Material {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  uom: string;
  moq: string | null;
  spec_ref: string | null;
  short_desc: string | null;
  long_desc: string | null;
  transportation_type: string | null;
  delivery_time_days: number | null;
  fast_moving_score: number | null;
  datasheet_url: string | null;
  image_url: string | null;
  main_supplier_id: string | null;
  suppliers?: { name: string };
  scale_price: number | null;
  market_price_min: number | null;
  market_price_avg: number | null;
  market_price_max: number | null;
  cumulative_order_quantity: number | null;
  updated_at: string | null;
}

const Materials = () => {
  const { t } = useTranslation();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categoryIcons, setCategoryIcons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [subcategoryFilters, setSubcategoryFilters] = useState<string[]>([]);
  const [uomFilters, setUomFilters] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<keyof Material | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryAddDialogOpen, setCategoryAddDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  
  // Navigation state
  const [viewLevel, setViewLevel] = useState<'categories' | 'subcategories' | 'items'>('categories');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);

  // Edit/Delete dialogs
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{ type: 'category' | 'subcategory'; name: string; categoryContext?: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'category' | 'subcategory'; name: string; categoryContext?: string; count: number } | null>(null);
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState(false);
  const [comparisonMaterialId, setComparisonMaterialId] = useState<string | undefined>(undefined);
  const [priceHistoryDialogOpen, setPriceHistoryDialogOpen] = useState(false);
  const [priceHistoryMaterialId, setPriceHistoryMaterialId] = useState<string | undefined>(undefined);
  const [materialToDelete, setMaterialToDelete] = useState<Material | null>(null);
  const [materialDeleteDialogOpen, setMaterialDeleteDialogOpen] = useState(false);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Refs to track undo timeouts
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const deletedMaterialsRef = useRef<Material[]>([]);

  const restoreMaterials = async (materialsToRestore: Material[]) => {
    try {
      // Prepare materials for insertion (remove the suppliers relation field)
      const insertData = materialsToRestore.map(({ suppliers, ...material }) => material);
      
      const { error } = await supabase
        .from('materials')
        .insert(insertData);
      
      if (error) throw error;
      
      fetchMaterials();
      toast({
        title: "Restored",
        description: `${materialsToRestore.length} material${materialsToRestore.length > 1 ? 's' : ''} restored successfully.`,
      });
    } catch (error) {
      console.error('Error restoring materials:', error);
      toast({
        title: "Error",
        description: "Failed to restore materials.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMaterial = async () => {
    if (!materialToDelete) return;
    
    const deletedMaterial = materialToDelete;
    
    try {
      const { error } = await supabase
        .from('materials')
        .delete()
        .eq('id', deletedMaterial.id);
      
      if (error) throw error;
      
      fetchMaterials();
      setMaterialDeleteDialogOpen(false);
      setMaterialToDelete(null);
      
      // Store for potential undo
      deletedMaterialsRef.current = [deletedMaterial];
      
      // Clear any existing timeout
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
      
      toast({
        title: "Material deleted",
        description: `"${deletedMaterial.name}" has been deleted.`,
        action: (
          <ToastAction altText="Undo" onClick={() => {
            if (undoTimeoutRef.current) {
              clearTimeout(undoTimeoutRef.current);
            }
            restoreMaterials([deletedMaterial]);
          }}>
            Undo
          </ToastAction>
        ),
      });
      
      // Clear the stored material after 5 seconds
      undoTimeoutRef.current = setTimeout(() => {
        deletedMaterialsRef.current = [];
      }, 5000);
      
    } catch (error) {
      console.error('Error deleting material:', error);
      toast({
        title: "Error",
        description: "Failed to delete material. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedMaterialIds.size === 0) return;
    
    const count = selectedMaterialIds.size;
    const deletedItems = materials.filter(m => selectedMaterialIds.has(m.id));
    
    try {
      const { error } = await supabase
        .from('materials')
        .delete()
        .in('id', Array.from(selectedMaterialIds));
      
      if (error) throw error;
      
      fetchMaterials();
      setBulkDeleteDialogOpen(false);
      setSelectedMaterialIds(new Set());
      
      // Store for potential undo
      deletedMaterialsRef.current = deletedItems;
      
      // Clear any existing timeout
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
      
      toast({
        title: "Materials deleted",
        description: `${count} material${count > 1 ? 's have' : ' has'} been deleted.`,
        action: (
          <ToastAction altText="Undo" onClick={() => {
            if (undoTimeoutRef.current) {
              clearTimeout(undoTimeoutRef.current);
            }
            restoreMaterials(deletedItems);
          }}>
            Undo
          </ToastAction>
        ),
      });
      
      // Clear the stored materials after 5 seconds
      undoTimeoutRef.current = setTimeout(() => {
        deletedMaterialsRef.current = [];
      }, 5000);
      
    } catch (error) {
      console.error('Error bulk deleting materials:', error);
      toast({
        title: "Error",
        description: "Failed to delete materials. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleMaterialSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedMaterialIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedMaterialIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedMaterialIds.size === filteredMaterials.length) {
      setSelectedMaterialIds(new Set());
    } else {
      setSelectedMaterialIds(new Set(filteredMaterials.map(m => m.id)));
    }
  };

  useEffect(() => {
    fetchMaterials();
    fetchCategoryIcons();

    // Set up realtime subscriptions for materials and categories
    const materialsChannel = supabase
      .channel('materials-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'materials'
        },
        () => {
          fetchMaterials();
        }
      )
      .subscribe();

    const categoriesChannel = supabase
      .channel('categories-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories'
        },
        () => {
          fetchCategoryIcons();
          fetchMaterials(); // Also refresh materials to update category counts
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(materialsChannel);
      supabase.removeChannel(categoriesChannel);
    };
  }, []);

  const fetchMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select(`
          *,
          suppliers:main_supplier_id (name)
        `)
        .order('name');

      if (error) throw error;
      setMaterials(data || []);
    } catch (error) {
      console.error('Error fetching materials:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoryIcons = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('name, icon');

      if (error) throw error;
      
      const iconMap: Record<string, string> = {};
      data?.forEach(cat => {
        iconMap[cat.name] = cat.icon;
      });
      setCategoryIcons(iconMap);
    } catch (error) {
      console.error('Error fetching category icons:', error);
    }
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleSort = (column: keyof Material) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (column: keyof Material) => {
    if (sortBy !== column) return <ArrowUpDown className="h-3 w-3" />;
    return sortOrder === 'asc' ? 
      <ArrowUp className="h-3 w-3" /> : 
      <ArrowDown className="h-3 w-3" />;
  };

  // Get unique values for filters
  const uniqueCategories = Array.from(new Set(materials.map(m => m.category))).sort();
  const uniqueSubcategories = Array.from(new Set(materials.map(m => m.subcategory).filter(Boolean))).sort() as string[];
  const uniqueUoms = Array.from(new Set(materials.map(m => m.uom))).sort();

  const toggleFilter = (value: string, filters: string[], setFilters: (filters: string[]) => void) => {
    if (filters.includes(value)) {
      setFilters(filters.filter(f => f !== value));
    } else {
      setFilters([...filters, value]);
    }
  };

  let filteredMaterials = materials.filter((material) => {
    const matchesSearch =
      material.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      material.subcategory?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilters.length === 0 || categoryFilters.includes(material.category);
    const matchesSubcategory = subcategoryFilters.length === 0 || (material.subcategory && subcategoryFilters.includes(material.subcategory));
    const matchesUom = uomFilters.length === 0 || uomFilters.includes(material.uom);
    return matchesSearch && matchesCategory && matchesSubcategory && matchesUom;
  });

  // Apply sorting
  if (sortBy) {
    filteredMaterials = [...filteredMaterials].sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });
  }

  const PREDEFINED_CATEGORIES = [
    'Blocks',
    'Cements',
    'Fittings',
    'Glass',
    'Aluminum',
    'Steel',
    'Insulation',
    'Gypsum Board',
    'Cables & Wiring',
  ];

  // Get all unique categories from both materials and categories table
  const allCategories = Array.from(new Set([
    ...PREDEFINED_CATEGORIES,
    ...materials.map(m => m.category),
    ...Object.keys(categoryIcons) // Include all categories from the categories table
  ])).sort();

  const CATEGORIES = allCategories;

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Blocks': 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      'Cements': 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
      'Fittings': 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      'Glass': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400',
      'Aluminum': 'bg-slate-100 text-slate-800 dark:bg-slate-900/20 dark:text-slate-400',
      'Steel': 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900/20 dark:text-zinc-400',
      'Insulation': 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
      'Gypsum Board': 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      'Cables & Wiring': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    };
    return colors[category] || 'bg-muted text-muted-foreground';
  };

  const getCategoryIcon = (category: string) => {
    // Icon map with all available icons
    const iconMap: Record<string, any> = {
      'Package': Package, 'Hammer': Hammer, 'Wrench': Wrench, 'Zap': Zap,
      'Droplet': Droplet, 'Layers': Layers, 'Box': Box, 'Grid3x3': Grid3x3,
      'CircleDot': CircleDot, 'Square': Square, 'Circle': Circle, 'Triangle': Triangle,
      'Diamond': Diamond, 'Hexagon': Hexagon, 'Star': Star, 'Cpu': Cpu,
      'Truck': Truck, 'Home': Home, 'Building': Building, 'Factory': Factory,
      'Bolt': Bolt, 'Wine': Wine, 'Boxes': Boxes, 'FileText': FileText, 'Cable': Cable,
    };

    // Check if category has custom icon
    if (categoryIcons[category]) {
      return iconMap[categoryIcons[category]] || Box;
    }

    // Fallback to predefined icons
    const defaultIcons: Record<string, any> = {
      'Blocks': Box,
      'Cements': Package,
      'Fittings': Bolt,
      'Glass': Wine,
      'Aluminum': Boxes,
      'Steel': Hammer,
      'Insulation': Layers,
      'Gypsum Board': FileText,
      'Cables & Wiring': Cable,
    };
    return defaultIcons[category] || Box;
  };

  // Get subcategories for selected category
  const getSubcategoriesForCategory = (category: string) => {
    const subcats = materials
      .filter(m => m.category === category && m.subcategory)
      .map(m => m.subcategory as string);
    return Array.from(new Set(subcats)).sort();
  };

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category);
    setViewLevel('subcategories');
  };

  const handleSubcategoryClick = (subcategory: string) => {
    setSelectedSubcategory(subcategory);
    setCategoryFilters([selectedCategory!]);
    setSubcategoryFilters([subcategory]);
    setViewLevel('items');
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setCategoryFilters([]);
    setSubcategoryFilters([]);
    setViewLevel('categories');
  };

  const handleBackToSubcategories = () => {
    setSelectedSubcategory(null);
    setSubcategoryFilters([]);
    setViewLevel('subcategories');
  };

  const FilterPopover = ({ 
    title, 
    values, 
    selectedValues, 
    onChange 
  }: { 
    title: string; 
    values: string[]; 
    selectedValues: string[]; 
    onChange: (value: string) => void;
  }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2">
          <Filter className={`h-3 w-3 ${selectedValues.length > 0 ? 'text-primary' : ''}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3 bg-background" align="start">
        <div className="space-y-2">
          <div className="font-medium text-sm">{title}</div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {values.map((value) => (
              <div key={value} className="flex items-center space-x-2">
                <Checkbox
                  id={`${title}-${value}`}
                  checked={selectedValues.includes(value)}
                  onCheckedChange={() => onChange(value)}
                />
                <label
                  htmlFor={`${title}-${value}`}
                  className="text-sm cursor-pointer flex-1"
                >
                  {value}
                </label>
              </div>
            ))}
          </div>
          {selectedValues.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-xs"
              onClick={() => selectedValues.forEach(onChange)}
            >
              Clear All
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-lg text-muted-foreground">{t('materials.loading')}</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">{t('materials.title')}</h1>
            <p className="text-muted-foreground">
              {viewLevel === 'categories' && t('materials.description')}
              {viewLevel === 'subcategories' && t('materials.browseSubcategories', { category: selectedCategory })}
              {viewLevel === 'items' && `${selectedCategory} - ${selectedSubcategory}`}
            </p>
          </div>
          <Button 
            className="gap-2" 
            onClick={() => {
              if (viewLevel === 'items') {
                setDialogOpen(true);
              } else {
                setCategoryAddDialogOpen(true);
              }
            }}
          >
            <Plus className="h-4 w-4" />
            {viewLevel === 'categories' ? t('materials.addCategory') : viewLevel === 'subcategories' ? t('materials.addSubcategory') : t('materials.addMaterial')}
          </Button>
        </div>

        {/* Search Bar for Categories View */}
        {viewLevel === 'categories' && (
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('materials.searchMaterials')}
              value={categorySearchQuery}
              onChange={(e) => setCategorySearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        )}

        {/* Breadcrumb Navigation */}
        {viewLevel !== 'categories' && (
          <div className="flex items-center gap-2 text-sm">
            <button 
              onClick={handleBackToCategories}
              className="text-primary hover:underline"
            >
              {t('materials.categories')}
            </button>
            {viewLevel === 'subcategories' && (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="text-foreground font-medium">{selectedCategory}</span>
              </>
            )}
            {viewLevel === 'items' && (
              <>
                <span className="text-muted-foreground">/</span>
                <button 
                  onClick={handleBackToSubcategories}
                  className="text-primary hover:underline"
                >
                  {selectedCategory}
                </button>
                <span className="text-muted-foreground">/</span>
                <span className="text-foreground font-medium">{selectedSubcategory}</span>
              </>
            )}
          </div>
        )}

        {/* Categories View */}
        {viewLevel === 'categories' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {CATEGORIES.filter(category => {
              if (!categorySearchQuery) return true;
              const searchLower = categorySearchQuery.toLowerCase();
              const categoryMatches = category.toLowerCase().includes(searchLower);
              const materialsInCategory = materials.filter(m => m.category === category);
              const materialNameMatches = materialsInCategory.some(m => 
                m.name.toLowerCase().includes(searchLower) ||
                m.short_desc?.toLowerCase().includes(searchLower) ||
                m.long_desc?.toLowerCase().includes(searchLower)
              );
              return categoryMatches || materialNameMatches;
            }).map((category) => {
              const materialCount = materials.filter(m => m.category === category).length;
              return (
                <div
                  key={category}
                  className="group relative aspect-square p-6 rounded-lg border-2 bg-card hover:border-primary transition-all duration-200 hover:shadow-lg flex flex-col"
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditTarget({ type: 'category', name: category });
                          setEditDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ type: 'category', name: category, count: materialCount });
                          setDeleteDialogOpen(true);
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <button
                    onClick={() => handleCategoryClick(category)}
                    className="flex-1 flex flex-col justify-between space-y-3 w-full text-left"
                  >
                    <div className="flex items-start justify-between">
                      <Badge className={getCategoryColor(category)}>
                        {category}
                      </Badge>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex flex-col items-center justify-center gap-3">
                      {(() => {
                        const Icon = getCategoryIcon(category);
                        return <Icon className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />;
                      })()}
                      <div className="text-center">
                        <h3 className="font-semibold text-base mb-1">{category}</h3>
                        <p className="text-sm text-muted-foreground">
                          {materialCount} {materialCount === 1 ? 'item' : 'items'}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Subcategories View */}
        {viewLevel === 'subcategories' && selectedCategory && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {getSubcategoriesForCategory(selectedCategory).map((subcategory) => {
              const materialCount = materials.filter(
                m => m.category === selectedCategory && m.subcategory === subcategory
              ).length;
              return (
                <div
                  key={subcategory}
                  className="group relative aspect-square p-6 rounded-lg border-2 bg-card hover:border-primary transition-all duration-200 hover:shadow-lg flex flex-col"
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditTarget({ type: 'subcategory', name: subcategory, categoryContext: selectedCategory });
                          setEditDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ type: 'subcategory', name: subcategory, categoryContext: selectedCategory, count: materialCount });
                          setDeleteDialogOpen(true);
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <button
                    onClick={() => handleSubcategoryClick(subcategory)}
                    className="flex-1 flex flex-col justify-between space-y-3 w-full text-left"
                  >
                    <div className="flex items-start justify-between">
                      <Badge variant="outline">{subcategory}</Badge>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base mb-1">{subcategory}</h3>
                      <p className="text-sm text-muted-foreground">
                        {materialCount} {materialCount === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Items View */}
        {viewLevel === 'items' && (
          <>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search materials..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {selectedMaterialIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete ({selectedMaterialIds.size})
                </Button>
              )}
            </div>

            <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={filteredMaterials.length > 0 && selectedMaterialIds.size === filteredMaterials.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors font-medium"
                    >
                      Name {getSortIcon('name')}
                    </button>
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleSort('category')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors font-medium"
                    >
                      Category {getSortIcon('category')}
                    </button>
                    <FilterPopover
                      title="Filter Category"
                      values={uniqueCategories}
                      selectedValues={categoryFilters}
                      onChange={(value) => toggleFilter(value, categoryFilters, setCategoryFilters)}
                    />
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleSort('subcategory')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors font-medium"
                    >
                      Subcategory {getSortIcon('subcategory')}
                    </button>
                    <FilterPopover
                      title="Filter Subcategory"
                      values={uniqueSubcategories}
                      selectedValues={subcategoryFilters}
                      onChange={(value) => toggleFilter(value, subcategoryFilters, setSubcategoryFilters)}
                    />
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleSort('uom')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors font-medium"
                    >
                      UoM {getSortIcon('uom')}
                    </button>
                    <FilterPopover
                      title="Filter UoM"
                      values={uniqueUoms}
                      selectedValues={uomFilters}
                      onChange={(value) => toggleFilter(value, uomFilters, setUomFilters)}
                    />
                  </div>
                </TableHead>
                <TableHead>Main Supplier</TableHead>
                <TableHead>
                  <div className="flex items-center gap-1 justify-end">
                    <button 
                      onClick={() => handleSort('fast_moving_score')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors font-medium"
                    >
                      Fast-Moving Score {getSortIcon('fast_moving_score')}
                    </button>
                  </div>
                </TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMaterials.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <p className="text-muted-foreground">
                      {searchQuery || categoryFilters.length > 0 || subcategoryFilters.length > 0 || uomFilters.length > 0
                        ? 'No materials found matching your filters'
                        : 'No materials yet. Add your first material to get started.'}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredMaterials.map((material) => {
                  const isExpanded = expandedRows.has(material.id);
                  return (
                    <>
                      <TableRow 
                        key={material.id} 
                        className={`cursor-pointer hover:bg-muted/50 ${selectedMaterialIds.has(material.id) ? 'bg-muted/30' : ''}`}
                        onClick={() => toggleRow(material.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedMaterialIds.has(material.id)}
                            onCheckedChange={() => {
                              const newSelected = new Set(selectedMaterialIds);
                              if (newSelected.has(material.id)) {
                                newSelected.delete(material.id);
                              } else {
                                newSelected.add(material.id);
                              }
                              setSelectedMaterialIds(newSelected);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-medium">{material.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getCategoryColor(material.category)}>
                            {material.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {material.subcategory || '-'}
                        </TableCell>
                        <TableCell>{material.uom}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {material.suppliers?.name || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {material.fast_moving_score !== null ? (
                            <span className="font-medium">{material.fast_moving_score}</span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Price History"
                              onClick={() => {
                                setPriceHistoryMaterialId(material.id);
                                setPriceHistoryDialogOpen(true);
                              }}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Compare Suppliers"
                              onClick={() => {
                                setComparisonMaterialId(material.id);
                                setComparisonDialogOpen(true);
                              }}
                            >
                              <GitCompare className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Edit Material"
                              onClick={() => {
                                setSelectedMaterial(material);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              title="Delete Material"
                              onClick={() => {
                                setMaterialToDelete(material);
                                setMaterialDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      
                      {isExpanded && (
                        <TableRow key={`${material.id}-details`}>
                          <TableCell colSpan={8} className="bg-muted/30">
                            <div className="py-4 px-6 space-y-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">MOQ</p>
                                  <p className="text-sm">{material.moq || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Spec Reference</p>
                                  <p className="text-sm">{material.spec_ref || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Transportation Type</p>
                                  <p className="text-sm">{material.transportation_type || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Delivery Time</p>
                                  <p className="text-sm">
                                    {material.delivery_time_days ? `${material.delivery_time_days} days` : '-'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Scale Price</p>
                                  <p className="text-sm">{material.scale_price ? `$${material.scale_price}` : '-'}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Market Price (Min/Avg/Max)</p>
                                  <p className="text-sm">
                                    {material.market_price_min || material.market_price_avg || material.market_price_max
                                      ? `$${material.market_price_min || '-'} / $${material.market_price_avg || '-'} / $${material.market_price_max || '-'}`
                                      : '-'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Cumulative Order Qty</p>
                                  <p className="text-sm">{material.cumulative_order_quantity || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                                  <p className="text-sm">
                                    {material.updated_at ? new Date(material.updated_at).toLocaleDateString() : '-'}
                                  </p>
                                </div>
                              </div>
                              
                              {material.short_desc && (
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground mb-1">Short Description</p>
                                  <p className="text-sm">{material.short_desc}</p>
                                </div>
                              )}
                              
                              {material.long_desc && (
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground mb-1">Long Description</p>
                                  <p className="text-sm whitespace-pre-wrap">{material.long_desc}</p>
                                </div>
                              )}
                              
                              <div className="grid grid-cols-2 gap-4">
                                {material.datasheet_url && (
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-1">Datasheet</p>
                                    <a 
                                      href={material.datasheet_url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-sm text-primary hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      View Datasheet
                                    </a>
                                  </div>
                                )}
                                {material.image_url && (
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-1">Image</p>
                                    <a 
                                      href={material.image_url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-sm text-primary hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      View Image
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
          </>
        )}

        <MaterialDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setSelectedMaterial(null);
          }}
          onSuccess={() => {
            fetchMaterials();
            fetchCategoryIcons();
          }}
          material={selectedMaterial}
          prefilledCategory={selectedCategory || undefined}
          prefilledSubcategory={selectedSubcategory || undefined}
        />


        <CategoryAddDialog
          open={categoryAddDialogOpen}
          onOpenChange={setCategoryAddDialogOpen}
          type={viewLevel === 'categories' ? 'category' : 'subcategory'}
          categoryContext={viewLevel === 'subcategories' ? selectedCategory || undefined : undefined}
          onSuccess={() => {
            fetchMaterials();
            fetchCategoryIcons();
          }}
        />

        {editTarget && (
          <CategoryEditDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            type={editTarget.type}
            currentName={editTarget.name}
            categoryContext={editTarget.categoryContext}
            onSuccess={() => {
              fetchMaterials();
              fetchCategoryIcons();
            }}
          />
        )}

        {deleteTarget && (
          <CategoryDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            type={deleteTarget.type}
            name={deleteTarget.name}
            categoryContext={deleteTarget.categoryContext}
            materialCount={deleteTarget.count}
            onSuccess={() => {
              fetchMaterials();
              fetchCategoryIcons();
            }}
          />
        )}

        <SupplierComparisonDialog
          open={comparisonDialogOpen}
          onOpenChange={(open) => {
            setComparisonDialogOpen(open);
            if (!open) setComparisonMaterialId(undefined);
          }}
          preselectedMaterialId={comparisonMaterialId}
        />

        <PriceHistoryDialog
          open={priceHistoryDialogOpen}
          onOpenChange={(open) => {
            setPriceHistoryDialogOpen(open);
            if (!open) setPriceHistoryMaterialId(undefined);
          }}
          preselectedMaterialId={priceHistoryMaterialId}
        />

        <AlertDialog open={materialDeleteDialogOpen} onOpenChange={setMaterialDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Material</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{materialToDelete?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setMaterialToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteMaterial} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedMaterialIds.size} Materials</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedMaterialIds.size} selected materials? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default Materials;
