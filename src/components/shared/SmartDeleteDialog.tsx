import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, ShieldAlert, Pause, Ban, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusSuggestion {
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
}

interface SmartDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: "customer" | "project" | "opportunity";
  entityName: string;
  onConfirm: (reason: string) => void;
  onStatusChange?: (status: string) => void;
  isLoading?: boolean;
}

const ENTITY_SUGGESTIONS: Record<string, { suggestions: Array<{ label: string; description: string; icon: React.ReactNode; status: string }> }> = {
  customer: {
    suggestions: [
      { label: "Mark as Inactive", description: "Customer is no longer active but may return", icon: <Pause className="h-4 w-4" />, status: "inactive" },
      { label: "Mark as Blacklisted", description: "Block this customer from future business", icon: <Ban className="h-4 w-4" />, status: "blacklisted" },
    ],
  },
  project: {
    suggestions: [
      { label: "Mark as Paused", description: "Project is temporarily on hold", icon: <Pause className="h-4 w-4" />, status: "Paused" },
      { label: "Mark as Completed", description: "Project has been finished", icon: <ShieldAlert className="h-4 w-4" />, status: "Completed" },
    ],
  },
  opportunity: {
    suggestions: [
      { label: "Mark as Lost", description: "Deal was not won — record the reason", icon: <XCircle className="h-4 w-4" />, status: "lost" },
      { label: "Put On Hold", description: "Pause this opportunity for now", icon: <Pause className="h-4 w-4" />, status: "on_hold" },
    ],
  },
};

export function SmartDeleteDialog({
  open,
  onOpenChange,
  entityType,
  entityName,
  onConfirm,
  onStatusChange,
  isLoading = false,
}: SmartDeleteDialogProps) {
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [reason, setReason] = useState("");

  const isValid = reason.trim().length >= 10;
  const suggestions = ENTITY_SUGGESTIONS[entityType]?.suggestions || [];

  const handleConfirm = () => {
    if (isValid) {
      onConfirm(reason.trim());
      setReason("");
      setShowDeleteForm(false);
    }
  };

  const handleStatusChange = (status: string) => {
    onStatusChange?.(status);
    onOpenChange(false);
    setShowDeleteForm(false);
    setReason("");
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setShowDeleteForm(false);
      setReason("");
    }
    onOpenChange(v);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Delete {entityType}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Before deleting <strong>{entityName}</strong>, consider updating its status instead. Deletion is only for records entered by mistake.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!showDeleteForm ? (
          <div className="space-y-3 py-2">
            <p className="text-sm font-medium text-muted-foreground">Instead of deleting, you can:</p>
            <div className="space-y-2">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion.status}
                  type="button"
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4"
                  onClick={() => handleStatusChange(suggestion.status)}
                  disabled={!onStatusChange}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-muted-foreground">{suggestion.icon}</div>
                    <div className="text-left">
                      <p className="font-medium text-sm">{suggestion.label}</p>
                      <p className="text-xs text-muted-foreground">{suggestion.description}</p>
                    </div>
                  </div>
                </Button>
              ))}
            </div>

            <Separator />

            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer underline-offset-2 hover:underline"
              onClick={() => setShowDeleteForm(true)}
            >
              This was entered by mistake — I want to delete it
            </button>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive font-medium">⚠️ Permanent removal from active views</p>
              <p className="text-xs text-muted-foreground mt-1">
                This will hide <strong>{entityName}</strong> from all lists. Only admins can recover deleted records.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-reason" className="text-sm">
                Reason for deletion <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="delete-reason"
                placeholder="e.g., Duplicate entry, entered wrong customer name..."
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
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          {showDeleteForm && (
            <Button
              onClick={handleConfirm}
              disabled={isLoading || !isValid}
              variant="destructive"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
