import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Sparkles,
  Building2,
  TrendingUp,
} from 'lucide-react';
import { CoverageAdvisorResult } from '@/hooks/useCoverageAdvisor';
import { cn } from '@/lib/utils';

interface CoverageAdvisorProps {
  advisorData: CoverageAdvisorResult;
  onHighlightSuppliers: (supplierIds: string[]) => void;
}

export const CoverageAdvisor = ({
  advisorData,
  onHighlightSuppliers,
}: CoverageAdvisorProps) => {
  const [showBestMixDialog, setShowBestMixDialog] = useState(false);
  const { coveragePercentage, missingZones, bestMix } = advisorData;

  const hasFullCoverage = missingZones.length === 0;

  const handleShowBestMix = () => {
    if (bestMix) {
      onHighlightSuppliers(bestMix.suppliers.map((s) => s.supplierId));
      setShowBestMixDialog(true);
    }
  };

  const handleCloseBestMix = () => {
    onHighlightSuppliers([]);
    setShowBestMixDialog(false);
  };

  return (
    <>
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Coverage Advisor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Coverage Progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Zone Coverage (Negotiating)</span>
              <span className="font-medium">{coveragePercentage}%</span>
            </div>
            <Progress
              value={coveragePercentage}
              className={cn(
                'h-2',
                hasFullCoverage ? '[&>div]:bg-green-500' : '[&>div]:bg-amber-500'
              )}
            />
          </div>

          {/* Status Badge */}
          {hasFullCoverage ? (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950/30 p-2 rounded-md">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium">Full coverage achieved</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs font-medium">
                  {missingZones.length} zone(s) not covered
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {missingZones.slice(0, 5).map((zone) => (
                  <Badge
                    key={zone.zoneId}
                    variant="outline"
                    className="text-[10px] border-amber-500/50 text-amber-600"
                  >
                    {zone.zoneName}
                  </Badge>
                ))}
                {missingZones.length > 5 && (
                  <Badge variant="outline" className="text-[10px]">
                    +{missingZones.length - 5} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Best Mix Button */}
          {bestMix && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={handleShowBestMix}
            >
              <Sparkles className="h-3 w-3 mr-2 text-amber-500" />
              Best Mix Recommendation
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Best Mix Dialog */}
      <Dialog open={showBestMixDialog} onOpenChange={handleCloseBestMix}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Optimal Supplier Mix
            </DialogTitle>
            <DialogDescription>
              Recommended combination for maximum coverage and quality.
            </DialogDescription>
          </DialogHeader>

          {bestMix && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                  <p className="text-xs text-muted-foreground">Coverage</p>
                  <p className="text-xl font-bold text-primary">
                    {bestMix.coveragePercentage}%
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 border border-green-500/20">
                  <p className="text-xs text-muted-foreground">Avg. Score</p>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <p className="text-xl font-bold text-green-600">
                      {bestMix.averageScore}
                    </p>
                  </div>
                </div>
              </div>

              {/* Recommended Suppliers */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Recommended Suppliers ({bestMix.suppliers.length})
                </p>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {bestMix.suppliers.map((supplier, index) => (
                      <div
                        key={supplier.supplierId}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-medium flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              {supplier.supplierName}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {supplier.coverageZones.length} zone(s) • Score: {supplier.weightedScore}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-[10px]',
                            supplier.status === 'negotiating'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-amber-100 text-amber-700'
                          )}
                        >
                          {supplier.status === 'negotiating' ? 'Negotiating' : 'Filtering'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Note */}
              <p className="text-[10px] text-muted-foreground text-center">
                Cards are highlighted on the Kanban board
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CoverageAdvisor;
