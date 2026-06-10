import { Badge } from '@/components/ui/badge';
import { Bot, Clock, User, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface EscalationTimerBadgeProps {
  escalationPhase: string | null;
  aiAttemptCount?: number;
  lastAiMessageAt?: string | null;
  officerAssignedAt?: string | null;
}

export const EscalationTimerBadge = ({
  escalationPhase,
  aiAttemptCount = 0,
  lastAiMessageAt,
  officerAssignedAt
}: EscalationTimerBadgeProps) => {
  const getTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Just now';
  };

  switch (escalationPhase) {
    case 'ai_attempt_1':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1"
              >
                <Bot className="h-3 w-3" />
                AI 1/2
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>AI Attempt 1 of 2</p>
              {lastAiMessageAt && (
                <p className="text-xs text-muted-foreground">Sent {getTimeAgo(lastAiMessageAt)}</p>
              )}
              <p className="text-xs">Waiting for supplier response...</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

    case 'ai_attempt_2':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1"
              >
                <Bot className="h-3 w-3" />
                AI 2/2
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>AI Attempt 2 of 2 (Urgent)</p>
              {lastAiMessageAt && (
                <p className="text-xs text-muted-foreground">Sent {getTimeAgo(lastAiMessageAt)}</p>
              )}
              <p className="text-xs">Final AI outreach before officer escalation</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

    case 'pending_officer':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="destructive" 
                className="bg-red-500/10 text-red-600 border-red-500/20 gap-1"
              >
                <User className="h-3 w-3" />
                Officer Required
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Officer Review Required</p>
              {officerAssignedAt && (
                <p className="text-xs text-muted-foreground">Assigned {getTimeAgo(officerAssignedAt)}</p>
              )}
              <p className="text-xs">AI outreach failed. Manual follow-up needed.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

    case 'auto_confirmed':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className="bg-green-500/10 text-green-600 border-green-500/20 gap-1"
              >
                <CheckCircle2 className="h-3 w-3" />
                Auto-Confirmed
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Auto-Confirmed via Sales Transaction</p>
              <p className="text-xs">Price confirmed through completed order</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

    case 'officer_confirmed':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className="bg-green-500/10 text-green-600 border-green-500/20 gap-1"
              >
                <User className="h-3 w-3" />
                Officer Confirmed
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Confirmed by Supply Officer</p>
              <p className="text-xs">Manual verification completed</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

    case 'no_response_closed':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="secondary" 
                className="bg-muted text-muted-foreground gap-1"
              >
                <XCircle className="h-3 w-3" />
                No Response
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Closed - No Response</p>
              <p className="text-xs">Supplier did not respond to outreach</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

    case 'none':
    default:
      return null;
  }
};

export default EscalationTimerBadge;
