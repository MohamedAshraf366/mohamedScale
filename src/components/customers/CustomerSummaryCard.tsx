import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Calendar, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface CustomerSummaryCardProps {
  interactions: number;
  dealsClosed: number;
  pendingFollowUps: number;
  firstContact?: string;
  lastActivity?: string;
}

export function CustomerSummaryCard({
  interactions,
  dealsClosed,
  pendingFollowUps,
  firstContact,
  lastActivity,
}: CustomerSummaryCardProps) {
  const totalOpportunities = Math.max(1, interactions); // Avoid division by zero
  const conversionRate = totalOpportunities > 0 
    ? Math.round((dealsClosed / totalOpportunities) * 100) 
    : 0;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Client Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-primary/5 rounded-lg">
              <div className="text-2xl font-bold text-primary">{interactions}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Interactions
              </div>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{dealsClosed}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Deals Closed
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold">
                {pendingFollowUps}/{Math.max(1, pendingFollowUps + dealsClosed)}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Follow-ups
              </div>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{conversionRate}%</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Conversion
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline mini card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">First Contact</span>
            <span className="font-medium">
              {firstContact ? format(new Date(firstContact), "MMM d, yyyy") : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Last Activity</span>
            <span className="font-medium">
              {lastActivity
                ? formatDistanceToNow(new Date(lastActivity), { addSuffix: true })
                : "—"}
            </span>
          </div>
          {pendingFollowUps > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-primary flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Pending Follow-ups
              </span>
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-medium">
                {pendingFollowUps}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
