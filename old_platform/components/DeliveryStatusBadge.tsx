import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { DeliveryStatusTier, getDeliveryStatusColor, getDeliveryStatusLabel } from '@/hooks/useLogistics';

interface DeliveryStatusBadgeProps {
  status: DeliveryStatusTier | null;
  delayMinutes?: number;
  showIcon?: boolean;
  className?: string;
}

const DeliveryStatusBadge = ({ 
  status, 
  delayMinutes = 0, 
  showIcon = true,
  className = '' 
}: DeliveryStatusBadgeProps) => {
  const getIcon = () => {
    switch (status) {
      case 'on_time':
        return <CheckCircle2 className="h-3 w-3" />;
      case 'slightly_delayed':
        return <Clock className="h-3 w-3" />;
      case 'critically_delayed':
        return <XCircle className="h-3 w-3" />;
      default:
        return <AlertTriangle className="h-3 w-3" />;
    }
  };

  const formatDelay = () => {
    if (!delayMinutes || delayMinutes <= 0) return '';
    if (delayMinutes < 60) return `+${delayMinutes}m`;
    const hours = Math.floor(delayMinutes / 60);
    const mins = delayMinutes % 60;
    return mins > 0 ? `+${hours}h ${mins}m` : `+${hours}h`;
  };

  return (
    <Badge 
      variant="outline" 
      className={`${getDeliveryStatusColor(status)} ${className}`}
    >
      <span className="flex items-center gap-1">
        {showIcon && getIcon()}
        <span>{getDeliveryStatusLabel(status)}</span>
        {delayMinutes > 0 && status !== 'on_time' && (
          <span className="text-xs opacity-75">({formatDelay()})</span>
        )}
      </span>
    </Badge>
  );
};

export default DeliveryStatusBadge;
