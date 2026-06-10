import { Badge } from '@/components/ui/badge';
import type { Subcategory } from '@/hooks/useMaterialsRegistry';

interface Props {
  subcategory: Subcategory;
}

/**
 * Compact structural summary of a subcategory: which spec axes it has
 * (with option count) and the variant axis options (e.g. sizes).
 * Sits next to the areas/domains badges as a glance-only overview.
 */
export function SubcategorySpecMetrics({ subcategory }: Props) {
  const specs = subcategory.spec_definitions || [];
  const variantDef = subcategory.variant_definitions;

  if (specs.length === 0 && !variantDef) return null;

  return (
    <Badge variant="outline" className="gap-1.5 text-xs font-normal">
      {specs.map((s, i) => (
        <span key={s.key} className="flex items-center gap-1">
          {i > 0 && <span className="text-muted-foreground/60">·</span>}
          <span className="text-muted-foreground">{s.label_en}</span>
          <span className="font-mono">{s.options.length}</span>
        </span>
      ))}
      {variantDef && (
        <>
          {specs.length > 0 && <span className="text-muted-foreground/60">·</span>}
          <span className="text-muted-foreground">{variantDef.label_en}</span>
          <span className="font-mono">
            {(variantDef.options || []).join(', ')}
          </span>
        </>
      )}
    </Badge>
  );
}
