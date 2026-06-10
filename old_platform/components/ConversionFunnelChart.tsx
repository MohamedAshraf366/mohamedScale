import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowDown, TrendingDown, BarChart3 } from 'lucide-react';

interface FunnelStage {
  name: string;
  count: number;
  percentage: number;
  dropOff: number;
}

interface ConversionFunnelChartProps {
  stages: FunnelStage[];
  onStageClick?: (stage: FunnelStage) => void;
  onCompareKPI?: () => void;
}

// Scale Brand Colors - Clean, no glow
const FUNNEL_COLORS = [
  'hsl(20, 100%, 48%)',   // Scale Orange - Raw Outreach
  'hsl(217, 91%, 60%)',   // Blue - Qualified Leads
  'hsl(263, 70%, 50%)',   // Indigo - Proposals Sent
  'hsl(142, 71%, 45%)',   // Green - Closed Deals
];

const ConversionFunnelChart = ({ stages, onStageClick, onCompareKPI }: ConversionFunnelChartProps) => {
  const { t } = useTranslation();
  const maxCount = stages[0]?.count || 1;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>{t('analytics.conversionFunnel')}</CardTitle>
          <CardDescription>{t('analytics.funnelDescription')}</CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onCompareKPI?.();
          }}
          className="text-xs border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-200"
        >
          <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
          {t('analytics.compareWithKpi')}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {stages.map((stage, index) => {
            const widthPercent = Math.max((stage.count / maxCount) * 100, 25);
            const isLast = index === stages.length - 1;
            const color = FUNNEL_COLORS[index % FUNNEL_COLORS.length];
            
            return (
              <div key={stage.name} className="space-y-1">
                {/* Funnel Bar - Clean, no glow */}
                <div
                  className="relative mx-auto transition-all duration-200 cursor-pointer group"
                  style={{ width: `${widthPercent}%` }}
                  onClick={() => onStageClick?.(stage)}
                >
                  <div
                    className="h-14 rounded-lg flex items-center justify-between px-4 transition-all duration-200 hover:opacity-90"
                    style={{ 
                      background: `linear-gradient(180deg, ${color} 0%, ${color} 100%)`,
                    }}
                  >
                    <span className="text-white font-medium text-sm truncate">
                      {stage.name}
                    </span>
                    <div className="flex items-center gap-2 text-white">
                      <span className="font-bold text-lg">{stage.count}</span>
                      <span className="text-white/80 text-sm">
                        ({stage.percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  
                  {/* Hover tooltip */}
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-sm whitespace-nowrap">
                      <p className="font-medium">{stage.name}</p>
                      <p className="text-muted-foreground">{stage.count} {t('analytics.leads')}</p>
                      <p className="text-muted-foreground">{stage.percentage.toFixed(1)}% {t('analytics.ofTotal')}</p>
                    </div>
                  </div>
                </div>

                {/* Drop-off indicator */}
                {!isLast && stage.dropOff > 0 && (
                  <div className="flex items-center justify-center gap-2 py-1">
                    <ArrowDown className="h-4 w-4 text-muted-foreground/50" />
                    <div className="flex items-center gap-1 text-sm">
                      <TrendingDown className="h-3 w-3 text-destructive" />
                      <span className="text-destructive font-medium">
                        -{stage.dropOff} ({((stage.dropOff / stage.count) * 100).toFixed(1)}% {t('analytics.dropOff')})
                      </span>
                    </div>
                    <ArrowDown className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary Stats - Clean cards */}
        <div className="mt-6 pt-4 border-t border-border/50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-primary">
                {stages[0]?.count || 0}
              </p>
              <p className="text-xs text-muted-foreground">{t('analytics.totalLeads')}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-success">
                {stages[stages.length - 1]?.count || 0}
              </p>
              <p className="text-xs text-muted-foreground">{t('analytics.closedDeals')}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-primary">
                {stages.length > 0 
                  ? ((stages[stages.length - 1]?.count / stages[0]?.count) * 100).toFixed(1)
                  : 0}%
              </p>
              <p className="text-xs text-muted-foreground">{t('analytics.conversionRate')}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-destructive">
                {stages.length > 0 
                  ? stages[0].count - stages[stages.length - 1].count
                  : 0}
              </p>
              <p className="text-xs text-muted-foreground">{t('analytics.totalDropOff')}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConversionFunnelChart;
