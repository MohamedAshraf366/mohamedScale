import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { 
  SupplierIssue, 
  useResolveIssue,
  getSeverityColor,
  getIssueTypeLabel,
  getFinalOutcomeLabel,
  FinalOutcome,
} from '@/hooks/useSupplierIssues';
import { format } from 'date-fns';

interface IssueResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: SupplierIssue | null;
}

const finalOutcomeOptions: { value: FinalOutcome; label: string }[] = [
  { value: 'refund_issued', label: 'Refund Issued' },
  { value: 'replacement_sent', label: 'Replacement Sent' },
  { value: 'warning_issued', label: 'Warning Issued' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'no_action', label: 'No Action Taken' },
  { value: 'other', label: 'Other' },
];

const IssueResolutionDialog = ({
  open,
  onOpenChange,
  issue,
}: IssueResolutionDialogProps) => {
  const resolveIssue = useResolveIssue();
  
  const [supplierJustification, setSupplierJustification] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [finalOutcome, setFinalOutcome] = useState<FinalOutcome | ''>('');
  const [error, setError] = useState('');

  if (!issue) return null;

  const isCritical = issue.severity === 'critical';

  const handleResolve = async () => {
    setError('');

    if (isCritical && !supplierJustification.trim()) {
      setError('Critical issues require supplier justification before resolution');
      return;
    }

    if (!finalOutcome) {
      setError('Please select a final outcome before resolving');
      return;
    }

    await resolveIssue.mutateAsync({
      id: issue.id,
      severity: issue.severity,
      supplierJustification: supplierJustification.trim() || undefined,
      resolutionNotes: resolutionNotes.trim() || undefined,
      finalOutcome: finalOutcome,
    });

    setSupplierJustification('');
    setResolutionNotes('');
    setFinalOutcome('');
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSupplierJustification('');
      setResolutionNotes('');
      setFinalOutcome('');
      setError('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Resolve Issue
          </DialogTitle>
          <DialogDescription>
            Record resolution details before marking as resolved
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Issue Summary */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className={getSeverityColor(issue.severity)}>
                {issue.severity}
              </Badge>
              <Badge variant="outline">
                {getIssueTypeLabel(issue.issue_type)}
              </Badge>
            </div>
            <p className="font-medium">{issue.supplier?.name}</p>
            <p className="text-sm text-muted-foreground">{issue.description}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Reported: {format(new Date(issue.created_at), 'MMM d, yyyy HH:mm')}
            </p>
          </div>

          {/* Final Outcome (Required) */}
          <div className="space-y-2">
            <Label htmlFor="outcome" className="flex items-center gap-2">
              Final Outcome
              <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">
                Required
              </Badge>
            </Label>
            <Select value={finalOutcome} onValueChange={(v) => setFinalOutcome(v as FinalOutcome)}>
              <SelectTrigger>
                <SelectValue placeholder="Select final outcome..." />
              </SelectTrigger>
              <SelectContent>
                {finalOutcomeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              What action was taken to resolve this issue?
            </p>
          </div>

          {/* Supplier Justification (Required for Critical) */}
          <div className="space-y-2">
            <Label htmlFor="justification" className="flex items-center gap-2">
              Supplier Response
              {isCritical && (
                <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">
                  Required
                </Badge>
              )}
            </Label>
            <Textarea
              id="justification"
              value={supplierJustification}
              onChange={(e) => setSupplierJustification(e.target.value)}
              placeholder="What was the supplier's explanation for this issue?"
              rows={3}
              maxLength={1000}
            />
            {isCritical && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Critical issues must have supplier response recorded
              </p>
            )}
          </div>

          {/* Resolution Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Resolution Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Additional notes about how this was resolved..."
              rows={2}
              maxLength={1000}
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleResolve}
            disabled={resolveIssue.isPending || !finalOutcome}
            className="bg-green-600 hover:bg-green-700"
          >
            {resolveIssue.isPending ? 'Resolving...' : 'Mark as Resolved'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default IssueResolutionDialog;