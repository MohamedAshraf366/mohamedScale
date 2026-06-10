import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Package, MoreVertical, Ban, RotateCcw, ImageIcon, Camera, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SpecDefinition } from './SpecFilterBar';
import { useRef } from 'react';

export interface MaterialGroup {
  material_no: number;
  name: string;
  name_ar?: string | null;
  code_prefix: string;
  specs: Record<string, unknown>;
  image_url?: string | null;
  status: string; // 'active' | 'deleted' | 'invalid'
  is_core?: boolean;
  variant_count: number;
  /** عدد المتغيرات النشطة فقط */
  active_variant_count?: number;
  /** عدد المتغيرات المحذوفة فقط */
  deleted_variant_count?: number;
  /** Inherited UoM context — used by resolveUom() when a variant has no override. */
  subcategory_default_uom?: string | null;
  category_default_uom?: string | null;
  variants: Array<{
    id: string;
    variant_no: number;
    /** Per-variant computed display name (includes variant value & unit). */
    name?: string;
    size_cm: string | null;
    code: string | null;
    /** NULL = inherit from subcategory → category. Use resolveUom() to display. */
    uom: string | null;
    status: string; // 'active' | 'deleted'
    is_core?: boolean;
    market_price_min_sar: number | null;
    market_price_max_sar: number | null;
  }>;
}

interface MaterialCardProps {
  material: MaterialGroup;
  specDefinitions: SpecDefinition[];
  onClick: () => void;
  onMarkInvalid?: (materialNo: number) => void;
  onReactivate?: (materialNo: number) => void;
  onChangeImage?: (materialNo: number, file: File) => void;
}

function getSpecLabel(specDefs: SpecDefinition[], key: string, value: unknown): string {
  const def = specDefs.find((d) => d.key === key);
  if (!def) return String(value);
  const opt = def.options.find((o) => o.value === String(value));
  return opt?.label_en || String(value);
}

export function MaterialCard({
  material,
  specDefinitions,
  onClick,
  onMarkInvalid,
  onReactivate,
  onChangeImage,
}: MaterialCardProps) {
  const isInvalid = material.status === 'invalid';
  const isCore = material.is_core === true;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const specEntries = Object.entries(material.specs || {}).filter(
    ([key]) => key !== 'size_cm' && key !== 'product_family'
  );

  return (
    <Card
      className={cn(
        'group cursor-pointer transition-all hover:shadow-md hover:border-primary/30',
        isInvalid && 'opacity-60 border-dashed'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Image / placeholder */}
        <div className="relative aspect-[4/3] rounded-md bg-muted overflow-hidden flex items-center justify-center">
          {material.image_url ? (
            <img
              src={material.image_url}
              alt={material.name}
              className="object-cover w-full h-full"
            />
          ) : (
            <Package className="h-10 w-10 text-muted-foreground/40" />
          )}

          {/* Actions menu */}
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="secondary" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <Camera className="h-4 w-4 mr-2" />
                  Change Image
                </DropdownMenuItem>
                {isInvalid ? (
                  <DropdownMenuItem onClick={() => onReactivate?.(material.material_no)}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => onMarkInvalid?.(material.material_no)}
                    className="text-destructive"
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Mark Invalid
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {isInvalid && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Badge variant="destructive" className="text-xs">
                Invalid Combination
              </Badge>
            </div>
          )}
        </div>

        {/* Code */}
        <div className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded truncate">
          {material.code_prefix}
        </div>

        {/* Name */}
        <div className="truncate font-medium text-sm" title={material.name}>
          {isCore && <Star className="h-3 w-3 text-amber-500 inline mr-1 fill-amber-500" />}
          {material.name}
        </div>

        {/* Spec badges */}
        <div className="flex flex-wrap gap-1">
          {specEntries.map(([key, value]) => (
            <Badge key={key} variant="outline" className="text-xs font-normal">
              {getSpecLabel(specDefinitions, key, value)}
            </Badge>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{material.variant_count} size{material.variant_count !== 1 ? 's' : ''}</span>
          <Badge variant={isInvalid ? 'destructive' : 'default'} className="text-xs">
            {material.status}
          </Badge>
        </div>
        {/* Hidden file input for image upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onChangeImage?.(material.material_no, file);
            e.target.value = '';
          }}
        />
      </CardContent>
    </Card>
  );
}
