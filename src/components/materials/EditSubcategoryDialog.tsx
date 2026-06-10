// components/materials/DeleteMaterialDialog.tsx
import { useState } from 'react';
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
import { AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { useMaterialDependencies, getTableDisplayName } from '@/hooks/useMaterialDependencies';

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
  const { data: dependencies, isLoading } = useMaterialDependencies(variantId);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const hasReferences = dependencies && dependencies.length > 0;

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
            {hasReferences ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            )}
            <DialogTitle>
              {hasReferences ? "Cannot Delete Material" : "Confirm Deletion"}
            </DialogTitle>
          </div>
          
          <DialogDescription className="pt-2">
            {hasReferences ? (
              <>
                <p className="font-medium text-foreground">
                  "{variantName}" is referenced in:
                </p>
                
                <div className="mt-3 space-y-2">
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Checking references...</span>
                    </div>
                  ) : (
                    dependencies?.map(dep => (
                      <div key={dep.table_name} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {getTableDisplayName(dep.table_name)}
                        </span>
                        <Badge variant="secondary" className="font-mono">
                          {dep.record_count} record{dep.record_count !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <p className="text-sm font-medium text-destructive">
                    ⚠️ Please delete or reassign these references first.
                  </p>
                </div>
              </>
            ) : (
              <>
                <p>
                  Are you sure you want to delete <span className="font-medium text-foreground">"{variantName}"</span>?
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  This action cannot be undone. The material will be permanently removed from the registry.
                </p>
              </>
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
          
          {!hasReferences && (
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Permanently'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}