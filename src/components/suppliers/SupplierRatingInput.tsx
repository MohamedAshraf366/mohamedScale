import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type SupplierQualityGrade = 'not_accepted' | 'accepted' | 'high_quality';

export const SUPPLIER_QUALITY_LABELS: Record<SupplierQualityGrade, string> = {
  not_accepted: 'Not accepted',
  accepted: 'Accepted',
  high_quality: 'High quality',
};

export function formatSupplierQuality(qualityGrade?: string | null) {
  if (!qualityGrade) return null;
  return SUPPLIER_QUALITY_LABELS[qualityGrade as SupplierQualityGrade] || qualityGrade.replace(/_/g, ' ');
}

function qualityBadgeClass(qualityGrade: SupplierQualityGrade) {
  switch (qualityGrade) {
    case 'high_quality':
      return 'bg-primary/10 text-primary border-primary/30';
    case 'accepted':
      return 'bg-secondary text-secondary-foreground border-border';
    case 'not_accepted':
      return 'bg-destructive/10 text-destructive border-destructive/30';
    default:
      return 'bg-secondary text-secondary-foreground border-border';
  }
}

interface SupplierRatingInputProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  className?: string;
}

export function SupplierRatingInput({ label, value, onChange, className }: SupplierRatingInputProps) {
  return (
    <div className={cn('flex items-center justify-between gap-2', className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const starValue = i + 1;
          const filled = value != null && starValue <= value;
          return (
            <button
              key={i}
              type="button"
              className="p-0.5 hover:scale-110 transition-transform"
              onClick={() => onChange(starValue === value ? null : starValue)}
            >
              <Star
                className={cn(
                  'h-4 w-4 transition-colors',
                  filled ? 'fill-primary text-primary' : 'text-muted-foreground/30 hover:text-primary/70'
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface SupplierRatingDisplayProps {
  overallRating?: number | null;
  qualityGrade?: string | null;
  ratingNotes?: string | null;
  compact?: boolean;
}

export function SupplierRatingDisplay({
  overallRating,
  qualityGrade,
  ratingNotes,
  compact,
}: SupplierRatingDisplayProps) {
  const qualityLabel = formatSupplierQuality(qualityGrade);

  if (compact) {
    if (overallRating == null && !qualityLabel) {
      return <span className="text-muted-foreground text-sm">—</span>;
    }

    return (
      <div className="flex items-center gap-2 flex-wrap">
        {overallRating != null && (
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-primary text-primary" />
            <span className="text-sm font-medium">{overallRating.toFixed(1)}</span>
          </div>
        )}
        {qualityLabel && qualityGrade && (
          <Badge variant="outline" className={cn('text-[10px]', qualityBadgeClass(qualityGrade as SupplierQualityGrade))}>
            {qualityLabel}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">Overall rating</span>
        {overallRating != null ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'h-3.5 w-3.5',
                    i < Math.round(overallRating) ? 'fill-primary text-primary' : 'text-muted-foreground/20'
                  )}
                />
              ))}
            </div>
            <span className="text-sm font-semibold">{overallRating.toFixed(1)}/5</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">Quality</span>
        {qualityLabel && qualityGrade ? (
          <Badge variant="outline" className={cn('text-xs', qualityBadgeClass(qualityGrade as SupplierQualityGrade))}>
            {qualityLabel}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </div>

      {ratingNotes && (
        <div className="space-y-1 pt-1 border-t">
          <span className="text-xs text-muted-foreground">Rating notes</span>
          <p className="text-sm leading-relaxed">{ratingNotes}</p>
        </div>
      )}
    </div>
  );
}
