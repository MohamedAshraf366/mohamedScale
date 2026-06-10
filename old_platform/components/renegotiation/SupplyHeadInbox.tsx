import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Inbox,
  Package,
  Building2,
  DollarSign,
  CalendarIcon,
  Send,
  TrendingUp,
  Award,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useRenegotiations,
  usePendingObjections,
  useSupplierPerformance,
  useCreateRenegotiation,
  useSupplyHeadReview,
} from '@/hooks/useRenegotiations';

const SupplyHeadInbox = () => {
  const { t } = useTranslation();
  const [selectedObjection, setSelectedObjection] = useState<string | null>(null);
  const [selectedRenegotiation, setSelectedRenegotiation] = useState<string | null>(null);
  const [targetPrice, setTargetPrice] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');

  const { data: pendingObjections, isLoading: loadingObjections } = usePendingObjections();
  const { data: pendingReviews, isLoading: loadingReviews } = useRenegotiations('pending_supply_head');
  const createRenegotiation = useCreateRenegotiation();
  const supplyHeadReview = useSupplyHeadReview();

  // Get the selected item for performance data
  const selectedRenegotiationItem = selectedRenegotiation
    ? pendingReviews?.find(r => r.id === selectedRenegotiation)
    : null;
  const selectedObjectionItem = selectedObjection
    ? pendingObjections?.find(o => o.id === selectedObjection)
    : null;

  const supplierId = selectedRenegotiationItem?.supplier_id || selectedObjectionItem?.related_supplier_id;

  const { data: performance } = useSupplierPerformance(supplierId || null);

  const handleCreateFromObjection = async (objectionId: string) => {
    const objection = pendingObjections?.find(o => o.id === objectionId);
    if (!objection || !objection.related_material_id) return;

    await createRenegotiation.mutateAsync({
      objection_id: objectionId,
      material_id: objection.related_material_id,
      supplier_id: objection.related_supplier_id || undefined,
      current_price: objection.materials?.scale_price || undefined,
      sales_suggested_price: objection.unit_price || undefined,
    });

    setSelectedObjection(null);
  };

  const handleSubmitReview = async () => {
    if (!selectedRenegotiation || !targetPrice || !scheduledDate) return;

    await supplyHeadReview.mutateAsync({
      id: selectedRenegotiation,
      supply_head_target: parseFloat(targetPrice),
      scheduled_date: format(scheduledDate, 'yyyy-MM-dd'),
      supply_head_notes: notes || undefined,
    });

    setSelectedRenegotiation(null);
    setTargetPrice('');
    setScheduledDate(undefined);
    setNotes('');
  };

  const isLoading = loadingObjections || loadingReviews;

  return (
    <div className="space-y-6">
      {/* New Objections Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Inbox className="h-5 w-5 text-amber-500" />
            {t('renegotiation.newObjections', 'New Sales Objections')}
            {pendingObjections?.length ? (
              <Badge variant="secondary" className="ml-2">{pendingObjections.length}</Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !pendingObjections?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{t('renegotiation.noObjections', 'No new objections to review')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingObjections.map((objection) => (
                <div
                  key={objection.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        <span className="font-medium">{objection.materials?.name || 'Unknown Material'}</span>
                        <Badge variant="outline" className="text-xs">
                          {objection.objection_type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {objection.company_name || objection.person_name || 'Unknown Client'}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Suggested: {objection.unit_price?.toFixed(2) || '—'}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Current: {objection.materials?.scale_price?.toFixed(2) || '—'}
                        </span>
                      </div>
                      {objection.notes && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{objection.notes}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleCreateFromObjection(objection.id)}
                      disabled={createRenegotiation.isPending}
                    >
                      Create Request
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Reviews Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Send className="h-5 w-5 text-blue-500" />
            {t('renegotiation.pendingReviews', 'Pending Your Review')}
            {pendingReviews?.length ? (
              <Badge variant="secondary" className="ml-2">{pendingReviews.length}</Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !pendingReviews?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{t('renegotiation.noPendingReviews', 'No pending reviews')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingReviews.map((renegotiation) => (
                <div
                  key={renegotiation.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedRenegotiation(renegotiation.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        <span className="font-medium">{renegotiation.materials?.name || 'Unknown Material'}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {renegotiation.suppliers?.name || 'No supplier'}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Current: {renegotiation.current_price?.toFixed(2) || '—'}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Sales Suggested: {renegotiation.sales_suggested_price?.toFixed(2) || '—'}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline">Click to Review</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selectedRenegotiation} onOpenChange={(open) => !open && setSelectedRenegotiation(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('renegotiation.reviewRequest', 'Review Renegotiation Request')}</DialogTitle>
          </DialogHeader>

          {selectedRenegotiation && (
            <div className="space-y-4">
              {/* Material & Supplier Info */}
              {(() => {
                const reneg = pendingReviews?.find(r => r.id === selectedRenegotiation);
                return (
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span className="font-medium">{reneg?.materials?.name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Current Price:</span>
                        <span className="ml-2 font-medium">{reneg?.current_price?.toFixed(2) || '—'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Sales Suggested:</span>
                        <span className="ml-2 font-medium text-amber-600">{reneg?.sales_suggested_price?.toFixed(2) || '—'}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Supplier Performance */}
              {performance && (
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Supplier Performance Context
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/30 rounded p-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Award className="h-3 w-3" />
                        Performance Rating
                      </div>
                      <p className="text-lg font-semibold">
                        {performance.performanceRating?.toFixed(1) || '—'}
                        <span className="text-sm font-normal text-muted-foreground">/5</span>
                      </p>
                    </div>
                    <div className="bg-muted/30 rounded p-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <DollarSign className="h-3 w-3" />
                        Price Consistency
                      </div>
                      <p className={cn(
                        'text-lg font-semibold',
                        performance.priceConsistencyIndex >= 80 ? 'text-green-600' :
                        performance.priceConsistencyIndex >= 50 ? 'text-amber-600' : 'text-red-600'
                      )}>
                        {performance.priceConsistencyIndex}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Input Fields */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Target Price</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Enter target price"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Scheduled Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !scheduledDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduledDate ? format(scheduledDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Notes / Justification</label>
                  <Textarea
                    placeholder="Explain your target price rationale..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRenegotiation(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReview}
              disabled={!targetPrice || !scheduledDate || supplyHeadReview.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              Submit to Management
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupplyHeadInbox;
