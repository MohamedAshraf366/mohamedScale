import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface AxisDefinition {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

interface AxisSelectorProps {
  axes: AxisDefinition[];
  /** Set of "axisKey:optionValue" that are currently EXCLUDED */
  excluded: Set<string>;
  onToggle: (axisKey: string, optionValue: string) => void;
  /** Compact mode for inline usage */
  compact?: boolean;
}

/**
 * Renders grouped axis checkboxes. Checking = included, unchecking = excluded.
 * Used in both the Add Material flow and the List View bulk selection.
 */
export function AxisSelector({ axes, excluded, onToggle, compact }: AxisSelectorProps) {
  if (axes.length === 0) return null;

  return (
    <div className={cn('space-y-3', compact && 'space-y-2')}>
      {axes.map((axis) => (
        <div
          key={axis.key}
          className={cn(
            'rounded-lg border p-3',
            compact ? 'p-2' : 'p-3'
          )}
        >
          <Label className={cn('font-medium mb-2 block', compact ? 'text-xs' : 'text-sm')}>
            {axis.label}
          </Label>
          <div className="flex flex-wrap gap-2">
            {axis.options.map((opt) => {
              const tag = `${axis.key}:${opt.value}`;
              const isIncluded = !excluded.has(tag);
              return (
                <label
                  key={opt.value}
                  className={cn(
                    'flex items-center gap-1.5 cursor-pointer rounded-md border px-2.5 py-1.5 transition-colors',
                    isIncluded
                      ? 'bg-primary/10 border-primary/30 text-foreground'
                      : 'bg-muted/30 border-border text-muted-foreground line-through opacity-60'
                  )}
                >
                  <Checkbox
                    checked={isIncluded}
                    onCheckedChange={() => onToggle(axis.key, opt.value)}
                    className="h-3.5 w-3.5"
                  />
                  <span className={cn('text-sm', compact && 'text-xs')}>{opt.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Count how many combos survive after exclusions */
export function countIncludedCombos(
  axes: AxisDefinition[],
  excluded: Set<string>,
): number {
  let count = 1;
  for (const axis of axes) {
    const included = axis.options.filter(
      (opt) => !excluded.has(`${axis.key}:${opt.value}`)
    ).length;
    count *= included;
  }
  return count;
}
