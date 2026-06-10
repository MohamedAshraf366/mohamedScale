import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';

interface ReturningClientBadgeProps {
  count: number;
  variant?: 'default' | 'compact';
}

export const ReturningClientBadge = ({ count, variant = 'default' }: ReturningClientBadgeProps) => {
  if (count <= 1) return null;

  if (variant === 'compact') {
    return (
      <Badge 
        variant="outline" 
        className="ml-1.5 bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px] px-1.5 py-0 h-4"
      >
        <RefreshCw className="h-2.5 w-2.5 mr-0.5" />
        {count}
      </Badge>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className="ml-2 bg-blue-500/10 text-blue-600 border-blue-500/30 text-xs"
    >
      <RefreshCw className="h-3 w-3 mr-1" />
      Returning ({count})
    </Badge>
  );
};

export const ReturningLeadTag = () => {
  return (
    <Badge 
      variant="outline" 
      className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-xs"
    >
      <RefreshCw className="h-3 w-3 mr-1" />
      Returning Lead
    </Badge>
  );
};
