import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Check, X, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  RenegotiationBid,
  useUpdateBid,
  SupplierRoleSwapRecommendation,
} from '@/hooks/useRenegotiationBids';

interface BidComparisonTableProps {
  bids: RenegotiationBid[];
  managementTarget: number | null;
  currentPrice: number | null;
  swapRecommendation: SupplierRoleSwapRecommendation | null;
}

const RoleBadge = ({ role }: { role: 'selected' | 'backup' | 'new_entrant' }) => {
  const colors = {
    selected: 'bg-primary/20 text-primary border-primary/30',
    backup: 'bg-amber-500/20 text-amber-700 border-amber-500/30',
    new_entrant: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  };

  const labels = {
    selected: 'Selected',
    backup: 'Backup',
    new_entrant: 'New Entrant',
  };

  return (
    <Badge variant="outline" className={cn('text-[10px]', colors[role])}>
      {labels[role]}
    </Badge>
  );
};

const QualityStars = ({ rating, onRate }: { rating: number | null; onRate: (r: number) => void }) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const displayRating = hoverRating ?? rating ?? 0;

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="p-0 h-4 w-4 cursor-pointer hover:scale-110 transition-transform"
          onClick={() => onRate(star)}
          onMouseEnter={() => setHoverRating(star)}
          onMouseLeave={() => setHoverRating(null)}
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

const BidComparisonTable = ({
  bids,
  managementTarget,
  currentPrice,
  swapRecommendation,
}: BidComparisonTableProps) => {
  const { t } = useTranslation();
  const updateBid = useUpdateBid();
  const [editingBid, setEditingBid] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleStartEdit = useCallback((id: string, currentValue: number | null) => {
    setEditingBid(id);
    setEditValue(currentValue?.toString() || '');
  }, []);

  const handleSaveBid = useCallback((id: string) => {
    const price = parseFloat(editValue);
    if (!isNaN(price) && price > 0) {
      updateBid.mutate({ id, new_bid: price });
    }
    setEditingBid(null);
  }, [editValue, updateBid]);

  const handleQualityUpdate = useCallback((id: string, rating: number) => {
    updateBid.mutate({ id, quality_rating: rating });
  }, [updateBid]);

  // Sort: selected first, then backups, then new entrants
  const sortedBids = [...bids].sort((a, b) => {
    const order = { selected: 0, backup: 1, new_entrant: 2 };
    return order[a.supplier_role] - order[b.supplier_role];
  });

  const getBidStatus = (bid: RenegotiationBid) => {
    if (!bid.new_bid) return null;
    if (!managementTarget) return 'neutral';
    
    if (bid.new_bid <= managementTarget) return 'meets_target';
    if (bid.new_bid <= managementTarget * 1.05) return 'close';
    return 'above_target';
  };

  const statusColors = {
    meets_target: 'text-green-600 bg-green-50',
    close: 'text-amber-600 bg-amber-50',
    above_target: 'text-red-600 bg-red-50',
    neutral: '',
  };

  return (
    <div className="space-y-4">
      {/* Swap Recommendation Alert */}
      {swapRecommendation && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-900">Supplier Role Swap Recommended</h4>
            <p className="text-sm text-amber-700 mt-1">{swapRecommendation.reason}</p>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="text-muted-foreground">
                Current: {swapRecommendation.currentSelected?.supplier_name || 'None'}
              </span>
              <span>→</span>
              <span className="font-medium text-green-700">
                Recommended: {swapRecommendation.challenger.supplier_name}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Target Reference */}
      <div className="flex items-center gap-6 text-sm bg-muted/50 rounded-lg p-3">
        <div>
          <span className="text-muted-foreground">Current Price:</span>
          <span className="ml-2 font-medium">{currentPrice?.toFixed(2) || '—'}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Management Target:</span>
          <span className="ml-2 font-medium text-primary">{managementTarget?.toFixed(2) || '—'}</span>
        </div>
        {currentPrice && managementTarget && (
          <div>
            <span className="text-muted-foreground">Target Reduction:</span>
            <span className="ml-2 font-medium text-green-600">
              {((currentPrice - managementTarget) / currentPrice * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Comparison Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Supplier</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Current Price</TableHead>
              <TableHead className="text-right">New Bid</TableHead>
              <TableHead className="text-center">Quality</TableHead>
              <TableHead className="text-right">vs Target</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedBids.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No suppliers in this bid event yet
                </TableCell>
              </TableRow>
            ) : (
              sortedBids.map((bid) => {
                const status = getBidStatus(bid);
                const isRecommended = swapRecommendation?.challenger.id === bid.id;
                const vsTarget = bid.new_bid && managementTarget
                  ? ((bid.new_bid - managementTarget) / managementTarget * 100)
                  : null;

                return (
                  <TableRow
                    key={bid.id}
                    className={cn(
                      isRecommended && 'bg-green-50/50 border-l-4 border-l-green-500'
                    )}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {bid.supplier_name}
                        {isRecommended && (
                          <Badge variant="outline" className="text-[9px] bg-green-100 text-green-700 border-green-300">
                            Recommended
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={bid.supplier_role} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {bid.current_price?.toFixed(2) || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingBid === bid.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-7 w-24 text-right text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveBid(bid.id);
                              if (e.key === 'Escape') setEditingBid(null);
                            }}
                          />
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleSaveBid(bid.id)}>
                            <Check className="h-3 w-3 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingBid(null)}>
                            <X className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <span
                          className={cn(
                            'cursor-pointer hover:text-primary transition-colors px-2 py-1 rounded',
                            status && statusColors[status]
                          )}
                          onClick={() => handleStartEdit(bid.id, bid.new_bid)}
                        >
                          {bid.new_bid?.toFixed(2) || 'Enter bid'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center">
                        <QualityStars
                          rating={bid.quality_rating}
                          onRate={(r) => handleQualityUpdate(bid.id, r)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {vsTarget !== null && (
                        <div className={cn(
                          'flex items-center justify-end gap-1 text-sm',
                          vsTarget <= 0 ? 'text-green-600' : vsTarget <= 5 ? 'text-amber-600' : 'text-red-600'
                        )}>
                          {vsTarget <= 0 ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : (
                            <TrendingUp className="h-3 w-3" />
                          )}
                          {vsTarget <= 0 ? '' : '+'}{vsTarget.toFixed(1)}%
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default BidComparisonTable;
