import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { MaterialStepPicker, type PickedMaterial } from '@/components/shared/MaterialStepPicker';

interface MaterialPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Single pick mode (for re-matching a line) */
  onSelect?: (material: PickedMaterial) => void;
  /** Multi pick mode (for adding new lines) */
  onBulkSelect?: (materials: PickedMaterial[]) => void;
  excludeIds?: string[];
  hideSupplierFilter?: boolean;
  showTargetPriceStatus?: boolean;
}

export function MaterialPickerDialog({
  open,
  onOpenChange,
  onSelect,
  onBulkSelect,
  excludeIds,
  hideSupplierFilter,
  showTargetPriceStatus,
}: MaterialPickerDialogProps) {
  const isMulti = !!onBulkSelect;

  const handleSingleSelect = (material: PickedMaterial) => {
    onSelect?.(material);
    onOpenChange(false);
  };

  const handleBulkSelect = (materials: PickedMaterial[]) => {
    onBulkSelect?.(materials);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pick Material{isMulti ? 's' : ''}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto">
          <MaterialStepPicker
            onSelect={isMulti ? undefined : handleSingleSelect}
            onBulkSelect={isMulti ? handleBulkSelect : undefined}
            multi={isMulti}
            excludeIds={excludeIds}
            hideSupplierFilter={hideSupplierFilter}
            showTargetPriceStatus={showTargetPriceStatus}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
