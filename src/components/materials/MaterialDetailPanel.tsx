import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Package, Ruler, DollarSign, Ban, RotateCcw, Star } from 'lucide-react';
import type { MaterialGroup } from './MaterialCard';
import type { SpecDefinition } from './SpecFilterBar';

interface MaterialDetailPanelProps {
  material: MaterialGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specDefinitions: SpecDefinition[];
  onMarkVariantInvalid?: (variantId: string) => void;
  onReactivateVariant?: (variantId: string) => void;
  onToggleVariantCore?: (variantId: string, isCore: boolean) => void;
}

function getSpecLabel(specDefs: SpecDefinition[], key: string, value: unknown): string {
  const def = specDefs.find((d) => d.key === key);
  if (!def) return String(value);
  const opt = def.options.find((o) => o.value === String(value));
  return opt?.label_en || String(value);
}

export function MaterialDetailPanel({
  material,
  open,
  onOpenChange,
  specDefinitions,
  onMarkVariantInvalid,
  onReactivateVariant,
  onToggleVariantCore,
}: MaterialDetailPanelProps) {
  if (!material) return null;

  const specEntries = Object.entries(material.specs || {}).filter(
    ([key]) => key !== 'size_cm' && key !== 'product_family'
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {material.is_core && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
            {material.name}
          </SheetTitle>
          <SheetDescription className="font-mono text-xs">
            {material.code_prefix}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Image */}
          {material.image_url && (
            <div className="rounded-lg overflow-hidden bg-muted">
              <img
                src={material.image_url}
                alt={material.name}
                className="w-full object-cover max-h-60"
              />
            </div>
          )}

          {/* Specs */}
          <div>
            <h4 className="text-sm font-medium mb-2">Specifications</h4>
            <div className="flex flex-wrap gap-2">
              {specEntries.map(([key, value]) => {
                const def = specDefinitions.find((d) => d.key === key);
                return (
                  <div key={key} className="bg-muted rounded-md px-3 py-1.5">
                    <span className="text-xs text-muted-foreground">
                      {def?.label_en || key}
                    </span>
                    <p className="text-sm font-medium">
                      {getSpecLabel(specDefinitions, key, value)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Variants table */}
          <div>
            <h4 className="text-sm font-medium mb-3">
              Size Variants ({material.variant_count})
            </h4>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Size</th>
                    <th className="text-left px-3 py-2 font-medium">Code</th>
                    <th className="text-left px-3 py-2 font-medium">UOM</th>
                    <th className="text-left px-3 py-2 font-medium">Price Range</th>
                    <th className="text-left px-3 py-2 font-medium">Core</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {material.variants
                    .sort((a, b) => {
                      // Core first, then by variant_no
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
                      const isInvalid = variant.status === 'invalid';
                      const variantIsCore = variant.is_core === true;

                      return (
                        <tr key={variant.id} className={`border-t border-border/50 ${isInvalid ? 'opacity-50' : ''}`}>
                          <td className="px-3 py-2 flex items-center gap-1">
                            <Ruler className="h-3 w-3 text-muted-foreground" />
                            {variant.size_cm || variant.variant_no} cm
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                            {variant.code || '—'}
                          </td>
                          <td className="px-3 py-2">{variant.uom}</td>
                          <td className="px-3 py-2">
                            {priceRange !== '—' && (
                              <span className="flex items-center gap-1 text-primary">
                                <DollarSign className="h-3 w-3" />
                                {priceRange} SAR
                              </span>
                            )}
                            {priceRange === '—' && <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-2">
                            {variantIsCore ? (
                              <Badge
                                className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20 cursor-pointer"
                                onClick={() => onToggleVariantCore?.(variant.id, false)}
                              >
                                <Star className="h-2.5 w-2.5 mr-0.5 fill-amber-500" /> Core
                              </Badge>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] text-muted-foreground px-1"
                                onClick={() => onToggleVariantCore?.(variant.id, true)}
                              >
                                Set
                              </Button>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant={isInvalid ? 'destructive' : 'default'}
                              className="text-xs"
                            >
                              {variant.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-1">
                            {isInvalid ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => onReactivateVariant?.(variant.id)}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Reactivate
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                                onClick={() => onMarkVariantInvalid?.(variant.id)}
                              >
                                <Ban className="h-3.5 w-3.5" />
                                Invalid
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
