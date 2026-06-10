import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Package, Ruler, DollarSign, Trash2, Star, ArrowLeft, Camera } from 'lucide-react';
import type { MaterialGroup } from './MaterialCard';
import type { SpecDefinition } from './SpecFilterBar';
import { cn } from '@/lib/utils';
import { resolveUom, uomSourceLabel } from '@/lib/resolve-inherited';
import { useRef } from 'react';

interface MaterialDetailViewProps {
  material: MaterialGroup;
  specDefinitions: SpecDefinition[];
  onBack: () => void;
  onDeleteVariant?: (variantId: string, variantName: string) => void; 
  onToggleVariantCore?: (variantId: string, isCore: boolean) => void;
  onChangeImage?: (materialNo: number, file: File) => void;
}

function getSpecLabel(specDefs: SpecDefinition[], key: string, value: unknown): string {
  const def = specDefs.find((d) => d.key === key);
  if (!def) return String(value);
  const opt = def.options.find((o) => o.value === String(value));
  return opt?.label_en || String(value);
}

export function MaterialDetailView({
  material,
  specDefinitions,
  onBack,
  onDeleteVariant,
  onToggleVariantCore,
  onChangeImage,
}: MaterialDetailViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const specEntries = Object.entries(material.specs || {}).filter(
    ([key]) => key !== 'size_cm' && key !== 'product_family'
  );

  const activeVariants = material.variants.filter((v) => v.status !== 'invalid');
  const coreCount = activeVariants.filter((v) => v.is_core).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate">{material.name}</h3>
          <p className="font-mono text-xs text-muted-foreground">{material.code_prefix}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Left: Image + specs */}
        <div className="space-y-4">
          <div className="relative aspect-square rounded-lg bg-muted overflow-hidden flex items-center justify-center group">
            {material.image_url ? (
              <img
                src={material.image_url}
                alt={material.name}
                className="object-cover w-full h-full"
              />
            ) : (
              <Package className="h-16 w-16 text-muted-foreground/30" />
            )}
            <button
              className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 rounded-md p-2 hover:bg-background"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onChangeImage?.(material.material_no, file);
                e.target.value = '';
              }}
            />
          </div>

          {/* Specs card */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h4 className="text-sm font-medium">Specifications</h4>
              {specEntries.map(([key, value]) => {
                const def = specDefinitions.find((d) => d.key === key);
                return (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">{def?.label_en || key}</span>
                    <Badge variant="outline" className="text-xs">
                      {getSpecLabel(specDefinitions, key, value)}
                    </Badge>
                  </div>
                );
              })}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Active Variants</span>
                <span className="text-sm font-medium">{activeVariants.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Core Variants</span>
                <span className="text-sm font-medium">{coreCount}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Variants table */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">
            Size Variants ({activeVariants.length})
          </h4>
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Size</th>
                  <th className="text-left px-3 py-2 font-medium">Code</th>
                  <th className="text-left px-3 py-2 font-medium">UOM</th>
                  <th className="text-left px-3 py-2 font-medium">Price Range</th>
                  <th className="text-left px-3 py-2 font-medium w-12">Core</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {activeVariants
                  .sort((a, b) => {
                    if (a.is_core && !b.is_core) return -1;
                    if (!a.is_core && b.is_core) return 1;
                    return a.variant_no - b.variant_no;
                  })
                  .map((variant) => {
                    const priceRange =
                      variant.market_price_min_sar && variant.market_price_max_sar
                        ? `${variant.market_price_min_sar}–${variant.market_price_max_sar}`
                        : variant.market_price_min_sar
                        ? `${variant.market_price_min_sar}+`
                        : '—';
                    const variantIsCore = variant.is_core === true;

                    return (
                      <tr key={variant.id} className="border-t border-border/50">
                        <td className="px-3 py-2 flex items-center gap-1">
                          <Ruler className="h-3 w-3 text-muted-foreground" />
                          {variant.size_cm ? `${variant.size_cm} cm` : `#${variant.variant_no}`}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                          {variant.code || '—'}
                        </td>
                        <td className="px-3 py-2">
                          {/*
                            UOM is **always** inherited from subcategory (then category).
                            Per-material overrides are no longer stored (DB trigger strips them).
                          */}
                          {(() => {
                            const r = resolveUom(
                              { uom: null },
                              { default_uom: material.subcategory_default_uom ?? null },
                              { default_uom: material.category_default_uom ?? null },
                            );
                            return <span>{r.uom}</span>;
                          })()}
                        </td>
                        <td className="px-3 py-2">
                          {priceRange !== '—' ? (
                            <span className="flex items-center gap-1 text-primary">
                              <DollarSign className="h-3 w-3" />
                              {priceRange} SAR
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => onToggleVariantCore?.(variant.id, !variantIsCore)}
                            className="p-1 hover:scale-110 transition-transform"
                          >
                            <Star className={cn(
                              'h-4 w-4 transition-colors',
                              variantIsCore ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/30 hover:text-amber-400'
                            )} />
                          </button>
                        </td>
                        <td className="px-3 py-1">
                          <Button
  variant="ghost"
  size="sm"
  className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
  onClick={() => onDeleteVariant?.(variant.id, `${material.name} (${variant.size_cm || variant.variant_no} cm)`)}
>
  <Trash2 className="h-3 w-3" />
</Button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
