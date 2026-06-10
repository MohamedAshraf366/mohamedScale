import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, Bell, BellOff, ChevronRight, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { isOpportunityInPipeline } from '@/lib/pipelineUtils';

interface StuckOpportunity {
  id: string;
  opportunity_name: string;
  company_name: string;
  project_name: string;
  stage: string;
  interest_level: string;
  daysInStage: number;
  threshold: number;
  created_at: string;
  assigned_to: string;
}

// Default thresholds in days for each opportunity stage
const STAGE_THRESHOLDS: Record<string, number> = {
  'Discovery': 5,
  'Qualification': 7,
  'Proposal': 10,
  'Negotiation': 14,
  'Closed Won': 999, // Never alert
  'Closed Lost': 999, // Never alert
  'Unknown': 7,
};

const PipelineAlerts = () => {
  const navigate = useNavigate();
  const [stuckOpportunities, setStuckOpportunities] = useState<StuckOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    fetchStuckOpportunities();

    // Set up real-time subscription for opportunities
    const channel = supabase
      .channel('pipeline-alerts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'opportunities',
        },
        () => {
          fetchStuckOpportunities();
        }
      )
      .subscribe();

    // Refresh every 5 minutes
    const interval = setInterval(fetchStuckOpportunities, 5 * 60 * 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const fetchStuckOpportunities = async () => {
    try {
      setLoading(true);

      // Fetch opportunities with their related client and project info
      // Only get opportunities that are in the pipeline (High/Medium/Low interest)
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          id,
          name,
          stage,
          interest_level,
          created_at,
          updated_at,
          assigned_to,
          is_closed,
          clients (
            company_name
          ),
          projects (
            name
          )
        `)
        .in('interest_level', ['High', 'Medium', 'Low'])
        .eq('is_closed', false)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const now = new Date();
      const stuck: StuckOpportunity[] = [];

      (data || []).forEach((opp: any) => {
        // Only process opportunities that are in the pipeline
        if (!isOpportunityInPipeline(opp.interest_level)) return;

        const stage = opp.stage || 'Unknown';
        const threshold = STAGE_THRESHOLDS[stage] || 7;
        // Use updated_at to track how long in current stage
        const stageDate = opp.updated_at || opp.created_at;
        const daysInStage = differenceInDays(now, new Date(stageDate));

        if (daysInStage >= threshold) {
          stuck.push({
            id: opp.id,
            opportunity_name: opp.name || 'Unnamed Opportunity',
            company_name: opp.clients?.company_name || 'Unknown Client',
            project_name: opp.projects?.name || 'Unknown Project',
            stage,
            interest_level: opp.interest_level || 'Not set',
            daysInStage,
            threshold,
            created_at: opp.created_at,
            assigned_to: opp.assigned_to || 'Unassigned',
          });
        }
      });

      // Sort by most overdue first
      stuck.sort((a, b) => (b.daysInStage - b.threshold) - (a.daysInStage - a.threshold));
      
      setStuckOpportunities(stuck);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching stuck opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverity = (daysInStage: number, threshold: number): 'critical' | 'warning' | 'info' => {
    const overdueDays = daysInStage - threshold;
    if (overdueDays >= threshold) return 'critical'; // 2x over threshold
    if (overdueDays >= threshold / 2) return 'warning'; // 1.5x over threshold
    return 'info';
  };

  const getSeverityStyles = (severity: 'critical' | 'warning' | 'info') => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800';
      case 'warning':
        return 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800';
      default:
        return 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800';
    }
  };

  const handleOpportunityClick = (opportunityId: string) => {
    navigate(`/pipeline?highlight=${opportunityId}`);
  };

  if (!alertsEnabled) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-muted-foreground">
              <BellOff className="h-5 w-5" />
              <span>Pipeline alerts are paused</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setAlertsEnabled(true)}>
              <Bell className="h-4 w-4 mr-2" />
              Enable Alerts
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Pipeline Alerts
                {stuckOpportunities.length > 0 && (
                  <Badge variant="destructive" className="animate-pulse">
                    {stuckOpportunities.length}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Opportunities stuck in stages beyond threshold • Updated {format(lastUpdated, 'HH:mm')}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={fetchStuckOpportunities} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setAlertsEnabled(false)}>
              <BellOff className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && stuckOpportunities.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg skeleton-shimmer" />
            ))}
          </div>
        ) : stuckOpportunities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">All opportunities are on track!</p>
            <p className="text-sm">No opportunities have exceeded their stage thresholds</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {stuckOpportunities.slice(0, 10).map((opp) => {
              const severity = getSeverity(opp.daysInStage, opp.threshold);
              const overdueDays = opp.daysInStage - opp.threshold;

              return (
                <div
                  key={opp.id}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm",
                    getSeverityStyles(severity)
                  )}
                  onClick={() => handleOpportunityClick(opp.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm truncate">{opp.opportunity_name}</p>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs shrink-0",
                            severity === 'critical' && "bg-red-100 text-red-700 border-red-300",
                            severity === 'warning' && "bg-amber-100 text-amber-700 border-amber-300",
                            severity === 'info' && "bg-blue-100 text-blue-700 border-blue-300"
                          )}
                        >
                          {overdueDays}+ days overdue
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="truncate">{opp.company_name}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {opp.daysInStage}d in {opp.stage}
                        </span>
                        <span>•</span>
                        <Badge variant="secondary" className="text-xs h-5">
                          {opp.interest_level}
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                  </div>
                </div>
              );
            })}

            {stuckOpportunities.length > 10 && (
              <Button 
                variant="ghost" 
                className="w-full text-sm"
                onClick={() => navigate('/pipeline?filter=stuck')}
              >
                View all {stuckOpportunities.length} stuck opportunities
              </Button>
            )}
          </div>
        )}

        {/* Threshold Legend */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-2">Stage Thresholds:</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(STAGE_THRESHOLDS).filter(([_, days]) => days < 100).map(([stage, days]) => (
              <Badge key={stage} variant="outline" className="text-xs font-normal">
                {stage}: {days}d
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PipelineAlerts;
