import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface AtRiskSupplierBadgeProps {
  isAtRisk: boolean | null;
  consecutiveOnTimeCount: number | null;
  className?: string;
}

const AtRiskSupplierBadge = ({ 
  isAtRisk, 
  consecutiveOnTimeCount = 0,
  className = '' 
}: AtRiskSupplierBadgeProps) => {
  if (!isAtRisk) return null;

  const remaining = 5 - (consecutiveOnTimeCount || 0);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`bg-red-500/10 text-red-600 border-red-500/20 ${className}`}
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            At Risk
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <p className="font-medium">Supplier At Risk</p>
            <p className="text-muted-foreground">
              {remaining > 0 ? (
                <>
                  {remaining} more on-time deliver{remaining === 1 ? 'y' : 'ies'} needed to clear status
                </>
              ) : (
                <>Next on-time delivery will clear this status</>
              )}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {[...Array(5)].map((_, i) => (
                <div 
                  key={i}
                  className={`h-2 w-4 rounded-sm ${
                    i < (consecutiveOnTimeCount || 0) 
                      ? 'bg-green-500' 
                      : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default AtRiskSupplierBadge;
