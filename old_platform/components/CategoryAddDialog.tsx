import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Package, Hammer, Wrench, Zap, Droplet, 
  Layers, Box, Grid3x3, CircleDot, Square,
  Circle, Triangle, Diamond, Hexagon, Star,
  Cpu, Truck, Home, Building, Factory
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CategoryAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'category' | 'subcategory';
  categoryContext?: string; // For adding subcategory, which category it belongs to
  onSuccess: () => void;
}

const ICON_OPTIONS = [
  { name: 'Package', icon: Package },
  { name: 'Hammer', icon: Hammer },
  { name: 'Wrench', icon: Wrench },
  { name: 'Zap', icon: Zap },
  { name: 'Droplet', icon: Droplet },
  { name: 'Layers', icon: Layers },
  { name: 'Box', icon: Box },
  { name: 'Grid3x3', icon: Grid3x3 },
  { name: 'CircleDot', icon: CircleDot },
  { name: 'Square', icon: Square },
  { name: 'Circle', icon: Circle },
  { name: 'Triangle', icon: Triangle },
  { name: 'Diamond', icon: Diamond },
  { name: 'Hexagon', icon: Hexagon },
  { name: 'Star', icon: Star },
  { name: 'Cpu', icon: Cpu },
  { name: 'Truck', icon: Truck },
  { name: 'Home', icon: Home },
  { name: 'Building', icon: Building },
  { name: 'Factory', icon: Factory },
];

export default function CategoryAddDialog({
  open,
  onOpenChange,
  type,
  categoryContext,
  onSuccess,
}: CategoryAddDialogProps) {
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Package');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setLoading(true);
    try {
      if (type === 'category') {
        // For categories, save to categories table
        const { error: categoryError } = await supabase
          .from('categories')
          .insert([{ name: name.trim(), icon: selectedIcon }]);

        if (categoryError) throw categoryError;

        toast.success(`Category "${name.trim()}" created successfully!`);
      } else {
        // For subcategories, create a placeholder material
        const materialData: any = {
          name: `${name.trim()} - Placeholder`,
          category: categoryContext,
          subcategory: name.trim(),
          uom: 'piece',
        };

        const { error } = await supabase
          .from('materials')
          .insert([materialData]);

        if (error) throw error;

        toast.success(`Subcategory "${name.trim()}" created successfully!`);
      }

      setName('');
      setSelectedIcon('Package');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(`Error creating ${type}:`, error);
      toast.error(`Failed to create ${type}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Add New {type === 'category' ? 'Category' : 'Subcategory'}
          </DialogTitle>
          <DialogDescription>
            {type === 'category'
              ? 'Create a new category for organizing materials.'
              : `Add a new subcategory under ${categoryContext}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              {type === 'category' ? 'Category' : 'Subcategory'} Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Enter ${type} name`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAdd();
                }
              }}
            />
          </div>

          {type === 'category' && (
            <div className="space-y-2">
              <Label htmlFor="icon">Category Icon</Label>
              <Select value={selectedIcon} onValueChange={setSelectedIcon}>
                <SelectTrigger id="icon">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const IconComponent = ICON_OPTIONS.find(opt => opt.name === selectedIcon)?.icon;
                        return IconComponent ? <IconComponent className="h-4 w-4" /> : null;
                      })()}
                      <span>{selectedIcon}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((option) => (
                    <SelectItem key={option.name} value={option.name}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        <span>{option.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={loading}>
            {loading ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
