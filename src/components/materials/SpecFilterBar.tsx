import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export interface SpecDefinition {
  key: string;
  label_en: string;
  label_ar?: string;
  /** Lifecycle of the axis itself. Default 'active'. */
  status?: 'active' | 'archived';
  archived_at?: string | null;
  archived_reason?: string | null;
  /**
   * Digit assumed by the smart decoder when an existing material code is
   * shorter than the current spec_definitions (e.g. after appending a new
   * axis). Optional — when absent, missing positions resolve to 'Unspecified'.
   */
  default_code_digit?: string | null;
  options: Array<{
    value: string;
    code_digit: string;
    label_en: string;
    label_ar?: string;
    /** Alternate names used for AI quote matching, search, and imports. */
    aliases?: string[];
    /** Lifecycle of the option. Default 'active'. Archived options keep resolving historical codes. */
    status?: 'active' | 'archived';
    archived_at?: string | null;
    archived_reason?: string | null;
  }>;
}

interface SpecFilterBarProps {
  specDefinitions: SpecDefinition[];
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string | null) => void;
  onClearAll: () => void;
}

export function SpecFilterBar({
  specDefinitions,
  filters,
  onFilterChange,
  onClearAll,
}: SpecFilterBarProps) {
  const hasFilters = Object.values(filters).some(Boolean);

  if (!specDefinitions.length) return null;

  const activeSpecs = specDefinitions.filter((s) => s.status !== 'archived');
  return (
    <div className="flex flex-wrap items-center gap-3">
      {activeSpecs.map((spec) => (
        <Select
          key={spec.key}
          value={filters[spec.key] || 'all'}
          onValueChange={(v) => onFilterChange(spec.key, v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder={spec.label_en} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All {spec.label_en}</SelectItem>
            {spec.options.filter((o) => o.status !== 'archived').map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label_en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClearAll} className="h-9">
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
