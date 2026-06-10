/**
 * @deprecated This sheet uses a legacy flow without domains.
 * Use ScopeSelectorSheet instead for domain-driven cycle creation.
 */
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewCycleSheet({ open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full">
        <SheetHeader>
          <SheetTitle>New Unlock Cycle</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="text-sm">
            This flow has been replaced. Please use the <strong>New Cycle</strong> button on the Supply Cycles page, which uses domain-based scope selection.
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
