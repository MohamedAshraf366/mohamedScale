import { useState } from 'react';
import { supabase } from '@/lib/supabase';
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
import { toast } from 'sonner';

interface CategoryDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'category' | 'subcategory';
  name: string;
  categoryContext?: string; // For subcategory deletes
  materialCount: number;
  onSuccess: () => void;
}

export default function CategoryDeleteDialog({
  open,
  onOpenChange,
  type,
  name,
  categoryContext,
  materialCount,
  onSuccess,
}: CategoryDeleteDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      if (type === 'category') {
        // Delete all materials with this category
        const { error } = await supabase
          .from('materials')
          .delete()
          .eq('category', name);

        if (error) throw error;
        toast.success(`Deleted category "${name}" and ${materialCount} material(s)`);
      } else {
        // Delete all materials with this subcategory in the given category
        const { error } = await supabase
          .from('materials')
          .delete()
          .eq('category', categoryContext)
          .eq('subcategory', name);

        if (error) throw error;
        toast.success(`Deleted subcategory "${name}" and ${materialCount} material(s)`);
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      toast.error(`Failed to delete ${type}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the {type} <strong>"{name}"</strong> and all{' '}
            <strong>{materialCount}</strong> material{materialCount !== 1 ? 's' : ''} associated with it.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
