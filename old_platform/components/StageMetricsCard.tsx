import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Clock, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StageMetric {
  name: string;
  count: number;
  conversionRate: number;
  avgDays: number;
  dropOffCount: number;
  dropOffReasons: { reason: string; count: number }[];
}

interface StageMetricsCardProps {
  stages: StageMetric[];
  onStageClick?: (stageName: string) => void;
}

const StageMetricsCard = ({ stages, onStageClick }: StageMetricsCardProps) => {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Stage Performance Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stages.map((stage, index) => (
            <div
              key={stage.name}
              className={cn(
                "p-4 rounded-lg border bg-card/50 hover:bg-accent/5 transition-colors cursor-pointer",
                onStageClick && "hover:shadow-sm"
              )}
              onClick={() => onStageClick?.(stage.name)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold">{stage.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {stage.count} leads
                  </Badge>
                </div>
                {index < stages.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                {/* Conversion Rate */}
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">Conversion Rate</p>
                  <p className={cn(
                    "text-lg font-bold",
                    stage.conversionRate >= 50 ? "text-green-600" : 
                    stage.conversionRate >= 25 ? "text-amber-600" : "text-red-600"
                  )}>
                    {stage.conversionRate.toFixed(1)}%
                  </p>
                </div>
                
                {/* Avg Time */}
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">Avg. Time in Stage</p>
                  <p className="text-lg font-bold text-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {stage.avgDays.toFixed(1)} days
                  </p>
                </div>
                
                {/* Drop-off */}
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">Drop-off</p>
                  <p className="text-lg font-bold text-red-500 flex items-center gap-1">
                    <TrendingDown className="h-3.5 w-3.5" />
                    {stage.dropOffCount}
                  </p>
                </div>
              </div>
              
              {/* Drop-off reasons */}
              {stage.dropOffReasons.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Drop-off Reasons
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {stage.dropOffReasons.slice(0, 4).map((reason) => (
                      <Badge 
                        key={reason.reason} 
                        variant="outline" 
                        className="text-xs bg-red-50 text-red-700 border-red-200"
                      >
                        {reason.reason} ({reason.count})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default StageMetricsCard;
