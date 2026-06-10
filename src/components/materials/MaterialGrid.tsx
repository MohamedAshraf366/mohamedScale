import { useState, useMemo } from 'react';
import { MaterialCard, type MaterialGroup } from './MaterialCard';
import { MaterialDetailPanel } from './MaterialDetailPanel';
import { SpecFilterBar, type SpecDefinition } from './SpecFilterBar';
import { Package } from 'lucide-react';

interface MaterialGridProps {
  materials: MaterialGroup[];
  specDefinitions: SpecDefinition[];
  onMarkInvalid?: (materialNo: number) => void;
  onReactivate?: (materialNo: number) => void;
  onMarkVariantInvalid?: (variantId: string) => void;
  onReactivateVariant?: (variantId: string) => void;
  onToggleVariantCore?: (variantId: string, isCore: boolean) => void;
  onChangeImage?: (materialNo: number, file: File) => void;
}

export function MaterialGrid({
  materials,
  specDefinitions,
  onMarkInvalid,
  onReactivate,
  onMarkVariantInvalid,
  onReactivateVariant,
  onToggleVariantCore,
  onChangeImage,
}: MaterialGridProps) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialGroup | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      for (const [key, value] of Object.entries(filters)) {
        if (!value) continue;
        if (String(m.specs[key]) !== value) return false;
      }
      return true;
    });
  }, [materials, filters]);

  const handleFilterChange = (key: string, value: string | null) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value) {
        next[key] = value;
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const handleCardClick = (material: MaterialGroup) => {
    setSelectedMaterial(material);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-4">
      <SpecFilterBar
        specDefinitions={specDefinitions}
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearAll={() => setFilters({})}
      />

      {filteredMaterials.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredMaterials.map((material) => (
            <MaterialCard
              key={material.material_no}
              material={material}
              specDefinitions={specDefinitions}
              onClick={() => handleCardClick(material)}
              onMarkInvalid={onMarkInvalid}
              onReactivate={onReactivate}
              onChangeImage={onChangeImage}
            />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No materials match the current filters</p>
        </div>
      )}

      <MaterialDetailPanel
        material={selectedMaterial}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        specDefinitions={specDefinitions}
        onMarkVariantInvalid={onMarkVariantInvalid}
        onReactivateVariant={onReactivateVariant}
        onToggleVariantCore={onToggleVariantCore}
      />
    </div>
  );
}
