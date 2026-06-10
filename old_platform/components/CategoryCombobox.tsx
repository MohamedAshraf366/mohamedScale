import { useState, useEffect, useRef } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/lib/supabase';

interface CategoryComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  isLegacy?: boolean;
  legacyLabel?: string;
}

interface Category {
  id: string;
  name: string;
}

const CategoryCombobox = ({ 
  value, 
  onValueChange, 
  placeholder = "Select category",
  className,
  isLegacy,
  legacyLabel 
}: CategoryComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Ref to prevent popover from reopening after selection
  const justSelectedRef = useRef(false);

  // Fetch categories from Materials Library on mount
  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('materials')
          .select('category')
          .order('category');

        if (error) throw error;

        // Get unique categories (same source as Materials Library)
        const uniqueCategories = Array.from(
          new Set((data || []).map(m => m.category).filter(Boolean))
        ).sort();

        // Use category name as both id and name (text-based)
        const cats = uniqueCategories.map(cat => ({
          id: cat,
          name: cat
        }));

        setCategories(cats);
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const selectedCategory = categories.find(cat => cat.id === value);
  const displayValue = selectedCategory?.name || (isLegacy ? legacyLabel : null);

  const handleSelect = (categoryId: string) => {
    const newValue = categoryId === value ? '' : categoryId;
    
    // Set flag to prevent popover from reopening
    justSelectedRef.current = true;
    
    // Close first
    setOpen(false);
    
    // Delay the parent state update
    setTimeout(() => {
      onValueChange(newValue);
      setTimeout(() => {
        justSelectedRef.current = false;
      }, 100);
    }, 10);
  };

  const handleOpenChange = (newOpen: boolean) => {
    // If we just selected something, ignore attempts to reopen
    if (newOpen && justSelectedRef.current) {
      return;
    }
    setOpen(newOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            isLegacy && "border-amber-400",
            className
          )}
        >
          {displayValue ? (
            <span className={cn(isLegacy && "text-amber-600")}>
              {displayValue}{isLegacy && " (invalid)"}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[300px] p-0 bg-popover z-[9999]" 
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
        <Command>
          <CommandInput placeholder="Search categories..." />
          <CommandList>
            <CommandEmpty>
              {loading ? "Loading..." : "No categories found. Add materials to your library first."}
            </CommandEmpty>
            <CommandGroup>
              {categories.map((category) => (
                <CommandItem
                  key={category.id}
                  value={category.name}
                  onSelect={() => handleSelect(category.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === category.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {category.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default CategoryCombobox;
