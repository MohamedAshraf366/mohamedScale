import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getOverallInterestTooltip } from '@/lib/clientInterestUtils';

interface OverallInterestBadgeProps {
  level: string;
  showIcon?: boolean;
  className?: string;
}

export const OverallInterestBadge = ({ level, showIcon = true, className }: OverallInterestBadgeProps) => {
  const getBadgeStyles = () => {
    switch (level) {
      case 'High':
        return 'bg-green-500/15 text-green-600 border-green-500/25';
      case 'Medium':
        return 'bg-amber-500/15 text-amber-600 border-amber-500/25';
      case 'Low':
        return 'bg-orange-500/15 text-orange-600 border-orange-500/25';
      default:
        return 'bg-muted text-muted-foreground border-muted-foreground/20';
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              'cursor-help shrink-0',
              getBadgeStyles(),
              className
            )}
          >
            {showIcon && <TrendingUp className="h-3 w-3 mr-1" />}
            {level === 'Not set' ? 'No Active Opps' : level}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{getOverallInterestTooltip()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
