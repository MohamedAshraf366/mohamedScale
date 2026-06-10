import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

interface CloseOpportunitySectionProps {
  hasQuotationSent: boolean;
  onClose: (status: "won" | "lost", reason?: string) => void;
  isLoading?: boolean;
}

export function CloseOpportunitySection({
  hasQuotationSent,
  onClose,
  isLoading,
}: CloseOpportunitySectionProps) {
  const [closeDialog, setCloseDialog] = useState<"won" | "lost" | null>(null);
  const [lostReason, setLostReason] = useState("");

  const handleConfirm = () => {
    if (closeDialog === "won") {
      onClose("won");
    } else if (closeDialog === "lost") {
      onClose("lost", lostReason.trim() || undefined);
    }
    setCloseDialog(null);
    setLostReason("");
  };

  return (
    <>
      <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium text-sm">Close Opportunity</h3>
        </div>

        {!hasQuotationSent && (
          <Alert variant="default" className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
            <AlertDescription className="text-xs">
              A quotation must be sent before marking as Won.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950"
            onClick={() => setCloseDialog("won")}
            disabled={!hasQuotationSent || isLoading}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Mark as Won
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={() => setCloseDialog("lost")}
            disabled={isLoading}
          >
            <XCircle className="h-4 w-4 mr-1" />
            Mark as Lost
          </Button>
        </div>
      </div>

      {/* Won Confirmation Dialog */}
      <AlertDialog open={closeDialog === "won"} onOpenChange={() => setCloseDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Won?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the opportunity as won and close it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-green-600 hover:bg-green-700"
            >
              Mark as Won
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lost Confirmation Dialog with Reason */}
      <AlertDialog open={closeDialog === "lost"} onOpenChange={() => setCloseDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Lost?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the opportunity as lost and close it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="lost-reason" className="text-sm font-medium">
              Reason for Loss (optional)
            </Label>
            <Textarea
              id="lost-reason"
              placeholder="e.g., Price too high, Went with competitor, Project cancelled..."
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              className="mt-2"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Mark as Lost
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
