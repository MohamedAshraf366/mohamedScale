import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Package,
  Building2,
  CalendarDays,
  DollarSign,
  Users,
  Search,
  Gavel,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useRenegotiationBids,
  useInitializeRenegotiationBids,
  useSupplierSwapRecommendation,
} from '@/hooks/useRenegotiationBids';
import { Renegotiation } from '@/hooks/useRenegotiations';
import BidComparisonTable from './BidComparisonTable';
import ExpandedSupplierSearch from './ExpandedSupplierSearch';

interface RenegotiationTaskDetailProps {
  renegotiation: Renegotiation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RenegotiationTaskDetail = ({
  renegotiation,
  open,
  onOpenChange,
}: RenegotiationTaskDetailProps) => {
  const { t } = useTranslation();
  const [activePhase, setActivePhase] = useState<'closed-bid' | 'open-hunt'>('closed-bid');
  const [showSupplierSearch, setShowSupplierSearch] = useState(false);

  const { data: bids, isLoading: loadingBids } = useRenegotiationBids(renegotiation?.id || null);
  const initializeBids = useInitializeRenegotiationBids();

  const swapRecommendation = useSupplierSwapRecommendation(
    bids || [],
    renegotiation?.management_approved_target || null
  );

  // Initialize bids when dialog opens
  useEffect(() => {
    if (open && renegotiation && !bids?.length && !loadingBids) {
      initializeBids.mutate({
        renegotiationId: renegotiation.id,
        materialId: renegotiation.material_id,
      });
    }
  }, [open, renegotiation, bids, loadingBids]);

  if (!renegotiation) return null;

  // Filter bids by phase
  const closedBidSuppliers = bids?.filter(b => 
    b.supplier_role === 'selected' || b.supplier_role === 'backup'
  ) || [];

  const newEntrants = bids?.filter(b => b.supplier_role === 'new_entrant') || [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Package className="h-5 w-5 text-primary" />
              <span>{renegotiation.materials?.name || 'Renegotiation Task'}</span>
              <Badge variant="outline" className="ml-2">
                {renegotiation.renegotiation_status || 'pending'}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {/* Summary Header */}
          <div className="grid grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground uppercase">Supplier</p>
              <p className="font-medium flex items-center gap-1 mt-1">
                <Building2 className="h-4 w-4" />
                {renegotiation.suppliers?.name || 'Multiple'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Scheduled</p>
              <p className="font-medium flex items-center gap-1 mt-1">
                <CalendarDays className="h-4 w-4" />
                {renegotiation.scheduled_date
                  ? format(new Date(renegotiation.scheduled_date), 'MMM d, yyyy')
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Current Price</p>
              <p className="font-medium mt-1">
                {renegotiation.current_price?.toFixed(2) || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Target Price</p>
              <p className="font-medium text-primary mt-1">
                {renegotiation.management_approved_target?.toFixed(2) || '—'}
              </p>
            </div>
          </div>

          {/* Phase Tabs */}
          <Tabs value={activePhase} onValueChange={(v) => setActivePhase(v as 'closed-bid' | 'open-hunt')}>
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="closed-bid" className="flex items-center gap-2">
                  <Gavel className="h-4 w-4" />
                  Phase 1: Closed Bid
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {closedBidSuppliers.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="open-hunt" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Phase 2: Open Hunt
                  {newEntrants.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {newEntrants.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {activePhase === 'open-hunt' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSupplierSearch(true)}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Expand Search
                </Button>
              )}
            </div>

            <TabsContent value="closed-bid" className="mt-4">
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <h4 className="font-medium text-amber-900 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Internal Bid Event
                  </h4>
                  <p className="text-sm text-amber-700 mt-1">
                    Collecting bids from Selected and Backup suppliers only. These are your existing trusted partners.
                  </p>
                </div>

                {loadingBids ? (
                  <div className="text-center py-8 text-muted-foreground">Loading bids...</div>
                ) : (
                  <BidComparisonTable
                    bids={closedBidSuppliers}
                    managementTarget={renegotiation.management_approved_target}
                    currentPrice={renegotiation.current_price}
                    swapRecommendation={swapRecommendation}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="open-hunt" className="mt-4">
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="font-medium text-blue-900 flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Open Market Hunting
                  </h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Expand your search to include new suppliers from the market. Click "Expand Search" to add new entrants.
                  </p>
                </div>

                {loadingBids ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : newEntrants.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <Search className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">No new suppliers added yet</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setShowSupplierSearch(true)}
                    >
                      <Search className="h-4 w-4 mr-2" />
                      Start Hunting
                    </Button>
                  </div>
                ) : (
                  <BidComparisonTable
                    bids={newEntrants}
                    managementTarget={renegotiation.management_approved_target}
                    currentPrice={renegotiation.current_price}
                    swapRecommendation={null}
                  />
                )}

                {/* Combined View when both phases have entries */}
                {newEntrants.length > 0 && closedBidSuppliers.length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Full Comparison (All Suppliers)
                    </h4>
                    <BidComparisonTable
                      bids={bids || []}
                      managementTarget={renegotiation.management_approved_target}
                      currentPrice={renegotiation.current_price}
                      swapRecommendation={swapRecommendation}
                    />
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ExpandedSupplierSearch
        open={showSupplierSearch}
        onOpenChange={setShowSupplierSearch}
        materialId={renegotiation.material_id}
        existingBids={bids || []}
      />
    </>
  );
};

export default RenegotiationTaskDetail;
