// components/materials/DeleteMaterialDialog.tsx

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, Trash2, Database } from 'lucide-react';
import { 
  useMaterialDependencies, 
  getTableDisplayName 
} from '@/hooks/useMaterialDependencies';


interface DeleteMaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variantId: string | null;
  variantName: string;
  onConfirmDelete: () => Promise<void>;
}

export function DeleteMaterialDialog({
  open,
  onOpenChange,
  variantId,
  variantName,
  onConfirmDelete,
}: DeleteMaterialDialogProps) {
  const { data: dependencies, isLoading, refetch } = useMaterialDependencies(variantId);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const hasReferences = dependencies && dependencies.length > 0;
  const totalRecords = dependencies?.reduce((sum, dep) => sum + dep.record_count, 0) || 0;

  // Refetch when dialog opens
  useEffect(() => {
    if (open && variantId) {
      refetch();
    }
  }, [open, variantId, refetch]);

  const handleConfirm = async () => {
    setIsDeleting(true);
    await onConfirmDelete();
    setIsDeleting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle>Delete Material</DialogTitle>
          </div>
          
          <DialogDescription className="pt-4 space-y-4">
            {/* References section - always visible with loading or data */}
            <div className="space-y-2">
              <p className="font-medium text-foreground">
                "{variantName}" is referenced in:
              </p>
              
              <div className="space-y-1.5 min-h-[100px]">
                {isLoading ? (
                  // Loading skeleton - shows immediately
                  <div className="space-y-3">
                    <div className="flex items-center justify-between animate-pulse">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                    </div>
                    <div className="flex items-center justify-between animate-pulse">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-14"></div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Checking database references...</span>
                    </div>
                  </div>
                ) : hasReferences ? (
                  // Show actual references
                  <>
                    {dependencies?.map(dep => (
                      <div key={dep.table_name} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {getTableDisplayName(dep.table_name)}
                        </span>
                        <Badge variant="destructive" className="font-mono">
                          {dep.record_count} record{dep.record_count !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    ))}
                    
                    <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30 mt-3">
                      <p className="text-sm text-amber-700 dark:text-amber-500 font-medium">
                        ⚠️ Warning: Deleting this material will remove it from {totalRecords} record(s)!
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This may cause data inconsistency in quotations, orders, or supply units.
                      </p>
                    </div>
                  </>
                ) : (
                  // No references found
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Database className="h-4 w-4" />
                    <span>No references found</span>
                  </div>
                )}
              </div>
            </div>

            {/* Confirmation message - always shown after loading or if no references */}
            {!isLoading && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <p className="font-medium text-foreground">
                  Are you sure you want to delete "{variantName}"?
                </p>
                <p className="text-sm text-muted-foreground">
                  This action cannot be undone. The material will be permanently removed from the registry.
                </p>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting || isLoading}
            className="gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete Permanently
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}