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

interface CategoryEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'category' | 'subcategory';
  currentName: string;
  categoryContext?: string; // For subcategory edits
  onSuccess: () => void;
}

export default function CategoryEditDialog({
  open,
  onOpenChange,
  type,
  currentName,
  categoryContext,
  onSuccess,
}: CategoryEditDialogProps) {
  const [newName, setNewName] = useState(currentName);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!newName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    if (newName.trim() === currentName) {
      toast.error('No changes to save');
      return;
    }

    setLoading(true);
    try {
      if (type === 'category') {
        // Update all materials with this category
        const { error } = await supabase
          .from('materials')
          .update({ category: newName.trim() })
          .eq('category', currentName);

        if (error) throw error;
        toast.success(`Category renamed from "${currentName}" to "${newName.trim()}"`);
      } else {
        // Update all materials with this subcategory in the given category
        const { error } = await supabase
          .from('materials')
          .update({ subcategory: newName.trim() })
          .eq('category', categoryContext)
          .eq('subcategory', currentName);

        if (error) throw error;
        toast.success(`Subcategory renamed from "${currentName}" to "${newName.trim()}"`);
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(`Error updating ${type}:`, error);
      toast.error(`Failed to rename ${type}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {type === 'category' ? 'Category' : 'Subcategory'}</DialogTitle>
          <DialogDescription>
            This will rename the {type} for all materials currently using it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="newName">New Name</Label>
            <Input
              id="newName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`Enter new ${type} name`}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
