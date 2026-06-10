import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, Minus, Target, BarChart3, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';

// Confetti particle component
const ConfettiParticle = ({ delay, color, left }: { delay: number; color: string; left: number }) => (
  <div
    className="absolute w-2 h-2 rounded-sm"
    style={{
      left: `${left}%`,
      top: '-10px',
      backgroundColor: color,
      animation: `confettiFall 3s ease-out ${delay}s forwards`,
      opacity: 0,
    }}
  />
);

const Confetti = () => {
  const colors = ['#22c55e', '#eab308', '#f97316', '#3b82f6', '#ec4899', '#8b5cf6'];
  const particles = useMemo(() => 
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      delay: Math.random() * 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      left: Math.random() * 100,
    })), []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
      {particles.map((p) => (
        <ConfettiParticle key={p.id} delay={p.delay} color={p.color} left={p.left} />
      ))}
    </div>
  );
};

interface KPIComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  funnelData: {
    rawOutreach: number;
    quotationRequested: number;
    inNegotiation: number;
    closedDeals: number;
  };
}

interface TargetData {
  rawOutreach: number | null;
  monthlyRevenue: number | null;
  qualificationRatio: number | null;
  closingRatio: number | null;
  retentionRate: number | null;
}

interface ComparisonRow {
  label: string;
  actual: number;
  target: number | null;
  isRate?: boolean;
}

const KPIComparisonDialog = ({
  open,
  onOpenChange,
  periodType,
  dateFrom,
  dateTo,
  funnelData,
}: KPIComparisonDialogProps) => {
  const { t } = useTranslation();
  const [targets, setTargets] = useState<TargetData>({
    rawOutreach: null,
    monthlyRevenue: null,
    qualificationRatio: null,
    closingRatio: null,
    retentionRate: null,
  });
  const [loading, setLoading] = useState(false);

  // Map period type to ScaleTargets period_type
  const getPeriodTypeForQuery = () => {
    switch (periodType) {
      case 'monthly':
        return 'Monthly';
      case 'quarterly':
        return 'Quarterly';
      case 'yearly':
        return 'Yearly';
      default:
        return 'Monthly'; // Default to monthly for daily/weekly views
    }
  };

  // Get period value from date range
  const getPeriodValue = () => {
    if (!dateFrom) return '';
    
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    
    switch (periodType) {
      case 'daily':
      case 'weekly':
      case 'monthly':
        return months[dateFrom.getMonth()];
      case 'quarterly':
        const quarter = Math.floor(dateFrom.getMonth() / 3) + 1;
        return `Q${quarter}`;
      case 'yearly':
        return dateFrom.getFullYear().toString();
      default:
        return months[dateFrom.getMonth()];
    }
  };

  useEffect(() => {
    if (open) {
      fetchTargets();
    }
  }, [open, periodType, dateFrom]);

  const fetchTargets = async () => {
    setLoading(true);
    try {
      const periodTypeQuery = getPeriodTypeForQuery();
      const periodValue = getPeriodValue();
      const currentYear = dateFrom?.getFullYear().toString() || new Date().getFullYear().toString();

      // Fetch period-specific targets (Raw Outreach, Monthly Revenue)
      const { data: periodTargets } = await supabase
        .from('scale_targets')
        .select('*')
        .eq('period_type', periodTypeQuery)
        .eq('period_value', periodValue);

      // Fetch yearly rate targets (always yearly)
      const { data: yearlyRates } = await supabase
        .from('scale_targets')
        .select('*')
        .eq('period_type', 'Yearly')
        .in('kpi_name', ['Qualification Ratio', 'Closing Ratio (Qualified → Deal)', 'Retention Rate'])
        .order('created_at', { ascending: false });

      const newTargets: TargetData = {
        rawOutreach: null,
        monthlyRevenue: null,
        qualificationRatio: null,
        closingRatio: null,
        retentionRate: null,
      };

      // Process period targets
      periodTargets?.forEach((target) => {
        if (target.kpi_name === 'Raw Outreach') {
          newTargets.rawOutreach = target.target_value;
        }
        if (target.kpi_name === 'Monthly Revenue Target') {
          newTargets.monthlyRevenue = target.target_value;
        }
      });

      // Process yearly rate targets (use the latest for each)
      const seenRates = new Set<string>();
      yearlyRates?.forEach((target) => {
        if (!seenRates.has(target.kpi_name)) {
          seenRates.add(target.kpi_name);
          if (target.kpi_name === 'Qualification Ratio') {
            newTargets.qualificationRatio = target.target_value;
          }
          if (target.kpi_name === 'Closing Ratio (Qualified → Deal)') {
            newTargets.closingRatio = target.target_value;
          }
          if (target.kpi_name === 'Retention Rate') {
            newTargets.retentionRate = target.target_value;
          }
        }
      });

      setTargets(newTargets);
    } catch (error) {
      console.error('Error fetching targets:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate expected values using yearly rates
  const calculateExpectedQualified = () => {
    if (targets.rawOutreach === null || targets.qualificationRatio === null) return null;
    return targets.rawOutreach * (targets.qualificationRatio / 100);
  };

  const calculateExpectedDeals = () => {
    const expectedQualified = calculateExpectedQualified();
    if (expectedQualified === null || targets.closingRatio === null) return null;
    return expectedQualified * (targets.closingRatio / 100);
  };

  const calculateExpectedRetained = () => {
    const expectedDeals = calculateExpectedDeals();
    if (expectedDeals === null || targets.retentionRate === null) return null;
    return expectedDeals * (targets.retentionRate / 100);
  };

  const getVarianceInfo = (actual: number, target: number | null) => {
    if (target === null || target === 0) return { percent: null, isPositive: null };
    const percent = ((actual / target) * 100);
    return { percent, isPositive: actual >= target };
  };

  // Check if all metrics exceed targets
  const allMetricsExceeded = useMemo(() => {
    const expectedQualified = calculateExpectedQualified();
    const expectedDeals = calculateExpectedDeals();
    
    const checks = [
      { actual: funnelData.rawOutreach, target: targets.rawOutreach },
      { actual: funnelData.quotationRequested, target: expectedQualified },
      { actual: funnelData.closedDeals, target: expectedDeals },
    ];
    
    // Need at least the main targets defined
    const hasTargets = checks.some(c => c.target !== null && c.target > 0);
    if (!hasTargets) return false;
    
    // Check if all defined targets are exceeded
    return checks.every(c => {
      if (c.target === null || c.target === 0) return true; // Skip undefined targets
      return c.actual >= c.target;
    });
  }, [funnelData, targets]);

  const formatNumber = (value: number | null, isRate = false) => {
    if (value === null) return t('kpiComparison.noTargetDefined');
    if (isRate) return `${value.toFixed(1)}%`;
    return Math.round(value).toLocaleString();
  };

  const [animationKey, setAnimationKey] = useState(0);

  // Trigger re-animation when period changes
  useEffect(() => {
    if (open) {
      setAnimationKey(prev => prev + 1);
    }
  }, [open, periodType, dateFrom]);

  const renderComparisonBar = (actual: number, target: number | null, index: number) => {
    if (target === null || target === 0) {
      return (
        <div className="mt-2 mb-1 animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
          <div className="relative h-3 bg-muted rounded-full overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] text-muted-foreground">{t('kpiComparison.noTarget')}</span>
            </div>
          </div>
        </div>
      );
    }

    const percentage = Math.min((actual / target) * 100, 100);
    const isPositive = actual >= target;
    const displayPercent = (actual / target) * 100;

    return (
      <div 
        key={`bar-${animationKey}-${index}`}
        className="mt-2 mb-1 relative animate-fade-in" 
        style={{ animationDelay: `${index * 100}ms` }}
      >
        {/* Progress bar container */}
        <div className="relative h-4 bg-muted rounded-full overflow-hidden">
          {/* Filled portion with grow animation */}
          <div
            className={cn(
              "h-full rounded-full origin-left",
              isPositive 
                ? "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6),0_0_24px_rgba(34,197,94,0.3)]" 
                : "bg-orange-500"
            )}
            style={{ 
              width: `${percentage}%`,
              animation: `growBar 0.8s ease-out ${index * 100 + 200}ms forwards${isPositive ? ', glowPulse 2s ease-in-out infinite' : ''}`,
              transform: 'scaleX(0)'
            }}
          />
        </div>
        {/* Percentage badge with pop animation */}
        <div
          className={cn(
            "absolute -top-5 transform -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm",
            isPositive 
              ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" 
              : "bg-orange-500"
          )}
          style={{ 
            left: `${Math.min(Math.max(percentage, 10), 90)}%`,
            animation: `popIn 0.3s ease-out ${index * 100 + 600}ms forwards`,
            opacity: 0,
            transform: 'translateX(-50%) scale(0)'
          }}
        >
          {displayPercent.toFixed(0)}%
        </div>
      </div>
    );
  };

  const renderComparisonRow = (
    label: string,
    actual: number,
    target: number | null,
    index: number,
    showExpected = false
  ) => {
    const variance = getVarianceInfo(actual, target);
    
    return (
      <div className="py-3 border-b border-border last:border-0 animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
        <div className="grid grid-cols-4 gap-4">
          <div className="font-medium text-sm">{label}</div>
          <div className="text-center">
            <span className="font-semibold">{Math.round(actual).toLocaleString()}</span>
          </div>
          <div className="text-center">
            <span className={cn(
              "font-semibold",
              target === null && "text-muted-foreground text-sm"
            )}>
              {formatNumber(target)}
            </span>
      {showExpected && target !== null && (
              <span className="text-xs text-muted-foreground ml-1">({t('kpiComparison.expected')})</span>
            )}
          </div>
          <div className="text-center">
            {variance.percent !== null ? (
              <div className={cn(
                "flex items-center justify-center gap-1 font-semibold",
                variance.isPositive ? "text-green-600" : "text-red-600"
              )}>
                {variance.isPositive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {variance.percent.toFixed(1)}%
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>
        {/* Visual comparison bar */}
        {renderComparisonBar(actual, target, index)}
      </div>
    );
  };

  const periodLabel = getPeriodValue();
  const periodTypeLabel = getPeriodTypeForQuery();


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Confetti celebration */}
        {allMetricsExceeded && !loading && <Confetti />}
        
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {allMetricsExceeded && !loading ? (
              <>
                <PartyPopper className="h-5 w-5 text-yellow-500 animate-bounce" />
                <span className="bg-gradient-to-r from-green-500 to-yellow-500 bg-clip-text text-transparent">
                  {t('kpiComparison.allTargetsExceeded')}
                </span>
                <PartyPopper className="h-5 w-5 text-yellow-500 animate-bounce" />
              </>
            ) : (
              <>
                <Target className="h-5 w-5 text-primary" />
                {t('kpiComparison.title')}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {allMetricsExceeded && !loading 
              ? t('kpiComparison.congratulations', { period: periodLabel, type: periodTypeLabel })
              : t('kpiComparison.comparingPerformance', { period: periodLabel, type: periodTypeLabel })
            }
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            {t('kpiComparison.loadingData')}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Section 1: Outreach & Deals */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {t('kpiComparison.outreachDealsPipeline')}
              </h3>
              <div className="bg-muted/30 rounded-lg p-4">
                {/* Header */}
                <div className="grid grid-cols-4 gap-4 pb-2 border-b border-border text-xs font-medium text-muted-foreground uppercase">
                  <div>{t('kpiComparison.metric')}</div>
                  <div className="text-center">{t('kpiComparison.actual')}</div>
                  <div className="text-center">{t('kpiComparison.target')}</div>
                  <div className="text-center">{t('kpiComparison.achieved')}</div>
                </div>

                {renderComparisonRow(
                  t('kpiComparison.rawOutreach'),
                  funnelData.rawOutreach,
                  targets.rawOutreach,
                  0
                )}
                {renderComparisonRow(
                  t('kpiComparison.qualifiedLeads'),
                  funnelData.quotationRequested,
                  calculateExpectedQualified(),
                  1,
                  true
                )}
                {renderComparisonRow(
                  t('kpiComparison.closedDeals'),
                  funnelData.closedDeals,
                  calculateExpectedDeals(),
                  2,
                  true
                )}
                {targets.retentionRate !== null && (
                  renderComparisonRow(
                    t('kpiComparison.retainedRepeat'),
                    0,
                    calculateExpectedRetained(),
                    3,
                    true
                  )
                )}
              </div>
            </div>

            {/* Rate KPIs Reference */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {t('kpiComparison.yearlyRateKpis')}
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">{t('kpiComparison.qualificationRatio')}</p>
                  <p className="text-lg font-semibold">
                    {targets.qualificationRatio !== null 
                      ? `${targets.qualificationRatio}%` 
                      : t('kpiComparison.notSet')}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">{t('kpiComparison.closingRatio')}</p>
                  <p className="text-lg font-semibold">
                    {targets.closingRatio !== null 
                      ? `${targets.closingRatio}%` 
                      : t('kpiComparison.notSet')}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">{t('kpiComparison.retentionRate')}</p>
                  <p className="text-lg font-semibold">
                    {targets.retentionRate !== null 
                      ? `${targets.retentionRate}%` 
                      : t('kpiComparison.notSet')}
                  </p>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-2">
              <Button onClick={() => onOpenChange(false)}>
                {t('kpiComparison.close')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default KPIComparisonDialog;
