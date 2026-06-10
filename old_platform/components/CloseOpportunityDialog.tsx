import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle } from 'lucide-react';

interface CloseOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityName: string;
  onClose: (result: 'Won' | 'Lost') => void;
}

export const CloseOpportunityDialog = ({
  open,
  onOpenChange,
  opportunityName,
  onClose,
}: CloseOpportunityDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Close Opportunity</DialogTitle>
          <DialogDescription>
            How did {opportunityName} end?
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-6">
          <Button
            variant="outline"
            className="h-24 flex flex-col gap-2 border-green-500/50 hover:bg-green-500/10 hover:border-green-500"
            onClick={() => onClose('Won')}
          >
            <CheckCircle className="h-8 w-8 text-green-500" />
            <span className="font-semibold text-green-600">Won</span>
          </Button>
          <Button
            variant="outline"
            className="h-24 flex flex-col gap-2 border-red-500/50 hover:bg-red-500/10 hover:border-red-500"
            onClick={() => onClose('Lost')}
          >
            <XCircle className="h-8 w-8 text-red-500" />
            <span className="font-semibold text-red-600">Lost</span>
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
