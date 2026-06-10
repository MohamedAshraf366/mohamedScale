// components/materials/DeleteMaterialConfirmDialog.tsx
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
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, XCircle } from 'lucide-react';
import { useMaterialDependencies, getTableDisplayName } from '@/hooks/useMaterialDependencies';
import { Skeleton } from '@/components/ui/skeleton';

interface DeleteMaterialConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variantId: string | null;
  variantName: string;
  onConfirmDelete: () => Promise<void>;
}

export function DeleteMaterialConfirmDialog({
  open,
  onOpenChange,
  variantId,
  variantName,
  onConfirmDelete,
}: DeleteMaterialConfirmDialogProps) {
  const { data: dependencies, isLoading } = useMaterialDependencies(variantId);
  const hasReferences = dependencies && dependencies.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            {hasReferences ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            )}
            <AlertDialogTitle>
              {hasReferences ? "Cannot Delete Material" : "Confirm Deletion"}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            {hasReferences ? (
              <>
                Material <span className="font-mono font-medium text-foreground">"{variantName}"</span> is referenced in:
                
                <div className="mt-3 space-y-2">
                  {isLoading ? (
                    <>
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-5 w-3/4" />
                    </>
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

                <p className="mt-4 text-sm font-medium text-destructive">
                  Please delete or reassign these references first.
                </p>
              </>
            ) : (
              <>
                Are you sure you want to delete <span className="font-medium">{variantName}</span>?
                <br />
                <span className="text-sm text-muted-foreground">
                  This action cannot be undone.
                </span>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {!hasReferences && (
            <AlertDialogAction
              onClick={onConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}