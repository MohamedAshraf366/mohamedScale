import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Package, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MaterialStepPicker, type PickedMaterial } from "@/components/shared/MaterialStepPicker";

export interface MaterialItem {
  material_id: string;
  name: string;
  quantity?: number;
  uom?: string;
}

interface MaterialsQuoteSectionProps {
  materials: MaterialItem[];
  onChange: (materials: MaterialItem[]) => void;
  deliveryDate?: Date | null;
  onDeliveryDateChange?: (date: Date | null) => void;
  showQuantity?: boolean;
  showDeliveryDate?: boolean;
  title?: string;
}

export function MaterialsQuoteSection({
  materials,
  onChange,
  deliveryDate,
  onDeliveryDateChange,
  showQuantity = true,
  showDeliveryDate = true,
  title = "Materials / Quote Preparation",
}: MaterialsQuoteSectionProps) {
  const [showPicker, setShowPicker] = useState(false);

  const addMaterial = (picked: PickedMaterial) => {
    // Prevent duplicates
    if (materials.some(m => m.material_id === picked.id)) return;
    onChange([
      ...materials,
      { material_id: picked.id, name: picked.name, uom: picked.uom, quantity: undefined },
    ]);
  };

  const removeMaterial = (materialId: string) => {
    onChange(materials.filter((m) => m.material_id !== materialId));
  };

  const updateMaterial = (materialId: string, updates: Partial<MaterialItem>) => {
    onChange(
      materials.map((m) =>
        m.material_id === materialId ? { ...m, ...updates } : m
      )
    );
  };

  const excludeIds = materials.map(m => m.material_id);

  return (
    <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-sm">{title}</h3>
        </div>
        <Button
          type="button"
          variant={showPicker ? "secondary" : "outline"}
          size="sm"
          className="text-xs"
          onClick={() => setShowPicker(!showPicker)}
        >
          {showPicker ? "Hide Picker" : "+ Add Material"}
        </Button>
      </div>

      {/* Inline Step Picker */}
      {showPicker && (
        <div className="rounded-md border p-3 bg-background">
          <MaterialStepPicker
            excludeIds={excludeIds}
            onSelect={(m) => addMaterial(m)}
            onBulkSelect={(picked) => {
              const newMats = picked.filter(p => !materials.some(m => m.material_id === p.id));
              onChange([
                ...materials,
                ...newMats.map(p => ({ material_id: p.id, name: p.name, uom: p.uom, quantity: undefined })),
              ]);
            }}
          />
        </div>
      )}

      {/* Items Table */}
      {materials.length > 0 && (
        <div className="rounded-md border bg-background overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-semibold text-xs">ITEM DETAILS</TableHead>
                {showQuantity && (
                  <TableHead className="font-semibold text-xs w-28 text-center">QUANTITY</TableHead>
                )}
                <TableHead className="font-semibold text-xs w-16 text-center">UOM</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((m) => (
                <TableRow key={m.material_id} className="group">
                  <TableCell className="py-2">
                    <span className="text-sm font-medium">{m.name}</span>
                  </TableCell>
                  {showQuantity && (
                    <TableCell className="py-2">
                      <Input
                        type="number"
                        placeholder="0"
                        value={m.quantity || ""}
                        onChange={(e) =>
                          updateMaterial(m.material_id, {
                            quantity: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        className="h-8 text-sm text-center w-24"
                      />
                    </TableCell>
                  )}
                  <TableCell className="py-2 text-center">
                    <span className="text-xs text-muted-foreground">{m.uom || "unit"}</span>
                  </TableCell>
                  <TableCell className="py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeMaterial(m.material_id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delivery Date for full quote */}
      {showDeliveryDate && onDeliveryDateChange && (
        <div className="flex items-center justify-between pt-3 border-t">
          <Label className="text-sm font-medium">Est. Delivery Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "w-48 justify-start text-sm",
                  !deliveryDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                {deliveryDate ? format(deliveryDate, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={deliveryDate || undefined}
                onSelect={(date) => onDeliveryDateChange(date || null)}
                disabled={(date) => date < new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {materials.length === 0 && !showPicker && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No materials added yet. Click "+ Add Material" to add items.
        </p>
      )}
    </div>
  );
}
