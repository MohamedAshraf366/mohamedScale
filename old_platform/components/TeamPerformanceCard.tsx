import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Users, TrendingUp, CheckCircle2, MessageSquare } from 'lucide-react';

interface TeamMemberStats {
  name: string;
  communications: number;
  followUps: number;
  dealsClosed: number;
  conversionRate: number;
}

interface TeamPerformanceCardProps {
  startDate: Date;
}

const TeamPerformanceCard = ({ startDate }: TeamPerformanceCardProps) => {
  const [teamStats, setTeamStats] = useState<TeamMemberStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({
    communications: 0,
    dealsClosed: 0,
    avgConversion: 0
  });

  useEffect(() => {
    fetchTeamPerformance();
  }, [startDate]);

  const fetchTeamPerformance = async () => {
    setLoading(true);
    try {
      const { data: communications } = await supabase
        .from('communication_log')
        .select('assigned_to, deal_completed, status')
        .gte('communication_date', startDate.toISOString());

      // Group by assigned_to
      const memberMap = new Map<string, { comms: number; closed: number }>();
      
      communications?.forEach(comm => {
        const assignee = comm.assigned_to || 'Unassigned';
        const current = memberMap.get(assignee) || { comms: 0, closed: 0 };
        current.comms += 1;
        if (comm.deal_completed) current.closed += 1;
        memberMap.set(assignee, current);
      });

      // Fetch follow-ups count per member
      const { data: followUps } = await supabase
        .from('follow_up_history')
        .select('communication_log_id')
        .gte('follow_up_date', startDate.toISOString());

      const stats: TeamMemberStats[] = [];
      let totalComms = 0;
      let totalClosed = 0;

      memberMap.forEach((value, name) => {
        if (name && name !== 'Unassigned') {
          const conversionRate = value.comms > 0 ? (value.closed / value.comms) * 100 : 0;
          stats.push({
            name,
            communications: value.comms,
            followUps: 0, // Could be enhanced with actual follow-up tracking per user
            dealsClosed: value.closed,
            conversionRate
          });
          totalComms += value.comms;
          totalClosed += value.closed;
        }
      });

      // Sort by deals closed
      stats.sort((a, b) => b.dealsClosed - a.dealsClosed);

      setTeamStats(stats.slice(0, 5)); // Top 5 performers
      setTotalStats({
        communications: totalComms,
        dealsClosed: totalClosed,
        avgConversion: totalComms > 0 ? (totalClosed / totalComms) * 100 : 0
      });
    } catch (error) {
      console.error('Error fetching team performance:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="chart-container">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="text-center p-3 rounded-xl bg-white/50 dark:bg-card/50 backdrop-blur-sm">
            <MessageSquare className="h-4 w-4 mx-auto mb-1 text-primary" />
            <p className="text-xl font-bold" style={{ textShadow: '0 0 15px hsl(159 82% 14% / 0.2)' }}>{totalStats.communications}</p>
            <p className="text-xs text-muted-foreground">Total Comms</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-white/50 dark:bg-card/50 backdrop-blur-sm">
            <CheckCircle2 className="h-4 w-4 mx-auto mb-1" style={{ color: 'hsl(142, 71%, 45%)' }} />
            <p className="text-xl font-bold" style={{ color: 'hsl(142, 71%, 45%)', textShadow: '0 0 15px hsl(142 71% 45% / 0.2)' }}>{totalStats.dealsClosed}</p>
            <p className="text-xs text-muted-foreground">Deals Closed</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-white/50 dark:bg-card/50 backdrop-blur-sm">
            <TrendingUp className="h-4 w-4 mx-auto mb-1 text-accent" />
            <p className="text-xl font-bold" style={{ color: 'hsl(25, 95%, 53%)', textShadow: '0 0 15px hsl(25 95% 53% / 0.2)' }}>{totalStats.avgConversion.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Conversion</p>
          </div>
        </div>

        {/* Individual Performance */}
        {teamStats.length > 0 ? (
          <div className="space-y-4">
            {teamStats.map((member, index) => (
              <div key={member.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-yellow-500 text-yellow-950' : 'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="font-medium text-sm">{member.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{member.communications} comms</span>
                    <span className="text-green-500 font-medium">{member.dealsClosed} deals</span>
                  </div>
                </div>
                <Progress 
                  value={member.conversionRate} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {member.conversionRate.toFixed(1)}% conversion
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-4">
            No team data available. Assign team members to communications to see performance.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default TeamPerformanceCard;
