import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SoftDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityName: string;
  onConfirm: (reason: string) => void;
  isLoading?: boolean;
}

export function SoftDeleteDialog({
  open,
  onOpenChange,
  entityType,
  entityName,
  onConfirm,
  isLoading = false,
}: SoftDeleteDialogProps) {
  const [reason, setReason] = useState("");

  const isValid = reason.trim().length >= 10;

  const handleConfirm = () => {
    if (isValid) {
      onConfirm(reason.trim());
      setReason("");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) setReason(""); onOpenChange(v); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {entityType}</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark <strong>{entityName}</strong> as deleted. It will no longer appear in lists but can be recovered by an admin.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="delete-reason" className="text-sm">
            Reason for deletion <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="delete-reason"
            placeholder="Explain why this is being deleted (min 10 characters)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
          {reason.length > 0 && reason.length < 10 && (
            <p className="text-xs text-destructive">
              At least 10 characters required ({10 - reason.length} more)
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading || !isValid}
            className={cn("bg-destructive text-destructive-foreground hover:bg-destructive/90")}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
