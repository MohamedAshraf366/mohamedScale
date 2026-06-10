/**
 * Phase 2b — read-only cell that shows the inherited (resolved) value
 * with a small pencil that toggles into an editable override input.
 */

import { useState } from 'react';
import { Edit2, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props<T extends string | number> {
  inherited: T | null;
  overrideValue: T | null;
  onOverride: (value: T | null) => void;
  formatInherited: (v: T | null) => string;
  inputType?: 'text' | 'number';
  inputClassName?: string;
  disabled?: boolean;
}

export function OverrideCell<T extends string | number>({
  inherited,
  overrideValue,
  onOverride,
  formatInherited,
  inputType = 'text',
  inputClassName,
  disabled,
}: Props<T>) {
  const [editing, setEditing] = useState(false);
  const hasOverride = overrideValue != null && overrideValue !== '';

  if (disabled) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (editing || hasOverride) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type={inputType}
          value={overrideValue ?? ''}
          autoFocus={editing}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') onOverride(null);
            else onOverride((inputType === 'number' ? Number(v) : v) as T);
          }}
          onBlur={() => setEditing(false)}
          className={cn(inputClassName)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground"
          title="Reset to inherited default"
          onClick={() => {
            onOverride(null);
            setEditing(false);
          }}
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 group">
      <span className="text-xs text-muted-foreground">{formatInherited(inherited)}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
        title="Override"
        onClick={() => setEditing(true)}
      >
        <Edit2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
