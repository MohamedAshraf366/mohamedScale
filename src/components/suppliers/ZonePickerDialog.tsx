import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ZoneMapSelector } from '@/components/shared/ZoneMapSelector';

interface ZonePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedZoneCodes: string[];
  onConfirm: (zoneCodes: string[]) => void;
}

export function ZonePickerDialog({ open, onOpenChange, selectedZoneCodes, onConfirm }: ZonePickerDialogProps) {
  const [localZones, setLocalZones] = useState<string[]>(selectedZoneCodes);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setLocalZones(selectedZoneCodes);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Delivery Zones</DialogTitle>
          <DialogDescription>
            Click zones on the map or use zone groups to select delivery areas.
            {localZones.length > 0 && ` (${localZones.length} selected)`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <ZoneMapSelector
            selectedZoneCodes={localZones}
            onSelectionChange={setLocalZones}
            showZoneGroups
            mapHeight="400px"
            layout="compact"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onConfirm(localZones); onOpenChange(false); }}>
            Confirm ({localZones.length} zones)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
