import { useState, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Package,
  Building2,
  MoreVertical,
  ExternalLink,
  Trash2,
  GripVertical,
  Star,
  MapPin,
  Check,
  X,
} from 'lucide-react';
import { calculateWeightedScore } from '@/hooks/useWeightedScore';
import { cn } from '@/lib/utils';

export interface UnlockSupplierCard {
  id: string;
  cycle_id: string;
  supplier_id: string;
  status: string;
  quoted_price: number | null;
  final_price: number | null;
  total_price: number | null;
  quality_rating: number | null;
  coverage_zones: string[];
  notes: string | null;
  suppliers: { id: string; name: string } | null;
  material_unlock_cycles: {
    id: string;
    target_price: number | null;
    materials: { id: string; name: string; category: string } | null;
  } | null;
}

interface Zone {
  id: string;
  name: string;
}

interface UnlockKanbanCardProps {
  supplier: UnlockSupplierCard;
  zones: Zone[];
  onDelete: (id: string) => void;
  onUpdatePrice: (id: string, price: number) => void;
  onUpdateQuality: (id: string, rating: number) => void;
  isHighlighted?: boolean;
  isDragging?: boolean;
}

const ScoreIndicator = ({ score, level }: { score: number; level: 'high' | 'medium' | 'low' }) => {
  const colorClasses = {
    high: 'bg-green-500/20 text-green-700 border-green-500/30',
    medium: 'bg-amber-500/20 text-amber-700 border-amber-500/30',
    low: 'bg-red-500/20 text-red-700 border-red-500/30',
  };

  return (
    <Badge variant="outline" className={cn('text-[10px] font-medium', colorClasses[level])}>
      Score: {score}
    </Badge>
  );
};

const QualityStars = ({
  rating,
  onRate,
  isEditing,
}: {
  rating: number | null;
  onRate: (r: number) => void;
  isEditing: boolean;
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const displayRating = hoverRating ?? rating ?? 0;

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={cn(
            'p-0 h-4 w-4 transition-colors',
            isEditing ? 'cursor-pointer hover:scale-110' : 'cursor-default'
          )}
          onClick={() => isEditing && onRate(star)}
          onMouseEnter={() => isEditing && setHoverRating(star)}
          onMouseLeave={() => setHoverRating(null)}
          disabled={!isEditing}
        >
          <Star
            className={cn(
              'h-3.5 w-3.5',
              star <= displayRating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
            )}
          />
        </button>
      ))}
    </div>
  );
};

export const UnlockKanbanCard = ({
  supplier,
  zones,
  onDelete,
  onUpdatePrice,
  onUpdateQuality,
  isHighlighted = false,
  isDragging = false,
}: UnlockKanbanCardProps) => {
  const navigate = useNavigate();
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [editPrice, setEditPrice] = useState<string>(
    supplier.quoted_price?.toString() || ''
  );

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: supplier.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const targetPrice = supplier.material_unlock_cycles?.target_price || null;
  const currentPrice = supplier.total_price ?? supplier.quoted_price ?? null;

  const { weightedScore, scoreLevel } = calculateWeightedScore({
    quotedPrice: currentPrice,
    targetPrice,
    qualityRating: supplier.quality_rating,
  });

  // Get zone names for coverage badges
  const coveredZoneNames = zones
    .filter((z) => supplier.coverage_zones?.includes(z.id))
    .map((z) => z.name);

  const handlePriceSave = useCallback(() => {
    const price = parseFloat(editPrice);
    if (!isNaN(price) && price > 0) {
      onUpdatePrice(supplier.id, price);
    }
    setIsEditingPrice(false);
  }, [editPrice, onUpdatePrice, supplier.id]);

  const handlePriceCancel = useCallback(() => {
    setEditPrice(supplier.quoted_price?.toString() || '');
    setIsEditingPrice(false);
  }, [supplier.quoted_price]);

  const borderColor = {
    high: 'border-l-green-500',
    medium: 'border-l-amber-500',
    low: 'border-l-red-500',
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className={cn(
          'cursor-grab hover:shadow-md transition-all border-l-4',
          borderColor[scoreLevel],
          isDragging && 'opacity-50 shadow-lg rotate-2',
          isHighlighted && 'ring-2 ring-primary ring-offset-2 animate-pulse'
        )}
      >
        <CardContent className="p-3">
          {/* Drag Handle & Material Name */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-muted rounded"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-sm line-clamp-1">
                    {supplier.material_unlock_cycles?.materials?.name || 'Unknown Material'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {supplier.material_unlock_cycles?.materials?.category}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ScoreIndicator score={weightedScore} level={scoreLevel} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate('/suppliers')} className="text-xs">
                    <ExternalLink className="h-3 w-3 mr-2" />
                    View Supplier
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/supply/materials')} className="text-xs">
                    <ExternalLink className="h-3 w-3 mr-2" />
                    View Material
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(supplier.id)}
                    className="text-xs text-destructive"
                  >
                    <Trash2 className="h-3 w-3 mr-2" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Supplier Name */}
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {supplier.suppliers?.name || 'Unknown Supplier'}
            </span>
          </div>

          {/* Prices - Inline Editing */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-muted/50 rounded p-2">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Quoted Price</p>
              {isEditingPrice ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="h-6 text-xs px-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handlePriceSave();
                      if (e.key === 'Escape') handlePriceCancel();
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={handlePriceSave}>
                    <Check className="h-3 w-3 text-green-600" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={handlePriceCancel}>
                    <X className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ) : (
                <p
                  className="text-sm font-medium cursor-pointer hover:text-primary transition-colors"
                  onClick={() => setIsEditingPrice(true)}
                >
                  {currentPrice?.toFixed(2) || '—'}
                </p>
              )}
            </div>
            <div className="bg-primary/5 rounded p-2 border border-primary/20">
              <p className="text-[10px] text-muted-foreground uppercase">Target</p>
              <p className="text-sm font-medium text-primary">
                {targetPrice?.toFixed(2) || '—'}
              </p>
            </div>
          </div>

          {/* Quality Rating - Inline */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-muted-foreground uppercase">Quality</span>
            <QualityStars
              rating={supplier.quality_rating}
              onRate={(r) => onUpdateQuality(supplier.id, r)}
              isEditing={true}
            />
          </div>

          {/* Coverage Badges */}
          {coveredZoneNames.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        {coveredZoneNames.length} zone(s)
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{coveredZoneNames.join(', ')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {coveredZoneNames.slice(0, 2).map((name) => (
                <Badge key={name} variant="secondary" className="text-[9px] px-1.5 py-0">
                  {name}
                </Badge>
              ))}
              {coveredZoneNames.length > 2 && (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                  +{coveredZoneNames.length - 2}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UnlockKanbanCard;
