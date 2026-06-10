import { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface Material {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
}

interface MaterialStepSelectorProps {
  value: string;
  onValueChange: (materialId: string, materialName?: string) => void;
  placeholder?: string;
}

const MaterialStepSelector = ({ value, onValueChange, placeholder = "Select material" }: MaterialStepSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  
  // Ref to prevent popover from reopening after selection
  const justSelectedRef = useRef(false);
  
  // Step state
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected material display
  const selectedMaterial = useMemo(() => 
    materials.find(m => m.id === value), 
    [materials, value]
  );

  // Fetch all materials on mount
  useEffect(() => {
    const fetchMaterials = async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, category, subcategory')
        .order('name');
      
      if (!error && data) {
        setMaterials(data);
        // Extract unique categories
        const uniqueCategories = [...new Set(data.map(m => m.category))].sort();
        setCategories(uniqueCategories);
      }
    };
    fetchMaterials();
  }, []);

  // Update subcategories when category changes
  useEffect(() => {
    if (selectedCategory) {
      const subs = [...new Set(
        materials
          .filter(m => m.category === selectedCategory && m.subcategory)
          .map(m => m.subcategory as string)
      )].sort();
      setSubcategories(subs);
    } else {
      setSubcategories([]);
    }
    setSelectedSubcategory('');
  }, [selectedCategory, materials]);

  // Filter materials based on selection and search
  const filteredMaterials = useMemo(() => {
    let filtered = materials;
    
    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(m => m.category === selectedCategory);
    }
    
    // Filter by subcategory
    if (selectedSubcategory) {
      filtered = filtered.filter(m => m.subcategory === selectedSubcategory);
    }
    
    // Search filter (matches name, can include numbers, Arabic, English)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(m => {
        const name = m.name.toLowerCase();
        return name.includes(query) || m.name.includes(searchQuery.trim());
      });
    }
    
    return filtered.slice(0, 20);
  }, [materials, selectedCategory, selectedSubcategory, searchQuery]);

  const handleSelect = (materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    
    
    // Set flag to prevent popover from reopening
    justSelectedRef.current = true;
    
    // Update parent state immediately - no delay
    onValueChange(materialId, material?.name);
    
    // Close popover and clear search
    setOpen(false);
    setSearchQuery('');
    
    // Reset flag after animation completes
    setTimeout(() => {
      justSelectedRef.current = false;
    }, 150);
  };
  
  // Debug log on render

  const handleOpenChange = (newOpen: boolean) => {
    // If we just selected something, ignore attempts to reopen
    if (newOpen && justSelectedRef.current) {
      return;
    }
    setOpen(newOpen);
  };

  const resetFilters = () => {
    setSelectedCategory('');
    setSelectedSubcategory('');
    setSearchQuery('');
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="flex-1 justify-between font-normal"
        >
          {selectedMaterial ? (
            <span className="truncate">{selectedMaterial.name}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[400px] p-0 bg-popover z-[9999]" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          // Prevent closing when clicking inside the dialog
          const target = e.target as HTMLElement;
          if (target.closest('[role="dialog"]')) {
            e.preventDefault();
          }
        }}
      >
        <div className="p-3 space-y-3 border-b">
          {/* Step 1: Category Selection - Native select */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Step 1: Category</Label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex h-9 w-full items-center rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="">Select category (e.g., Blocks, Steel)</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Step 2: Subcategory Selection - Native select */}
          {subcategories.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Step 2: Sub-Category</Label>
              <select
                value={selectedSubcategory}
                onChange={(e) => setSelectedSubcategory(e.target.value)}
                className="flex h-9 w-full items-center rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
              >
                <option value="">Select sub-category</option>
                {subcategories.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          )}

          {/* Step 3: Search Input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              {subcategories.length > 0 ? 'Step 3: Search' : 'Step 2: Search'}
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Type to search (e.g., 20, معزول, block)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 bg-background"
              />
            </div>
          </div>

          {/* Reset Filters */}
          {(selectedCategory || searchQuery) && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full h-7 text-xs"
              onClick={resetFilters}
            >
              <X className="h-3 w-3 mr-1" />
              Reset Filters
            </Button>
          )}
        </div>

        {/* Material List */}
        <div className="max-h-[200px] overflow-y-auto">
          {filteredMaterials.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {searchQuery ? 'No materials found. Try a different search.' : 'Select a category or search to find materials.'}
            </div>
          ) : (
            <div className="p-1">
              {filteredMaterials.map((material) => (
                <div
                  key={material.id}
                  role="button"
                  tabIndex={0}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelect(material.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelect(material.id);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent cursor-pointer text-left select-none",
                    value === material.id && "bg-accent"
                  )}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      value === material.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1 truncate">{material.name}</span>
                  {material.subcategory && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {material.subcategory}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="p-2 border-t text-xs text-muted-foreground text-center">
          {filteredMaterials.length > 0 && `Showing ${filteredMaterials.length} materials`}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default MaterialStepSelector;
