import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  CalendarCheck, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Phone,
  MessageCircle,
  Users,
  Mail,
  Calendar,
  MoreHorizontal,
  ArrowRight,
  User,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface FollowUpSummary {
  total: number;
  completed: number;
  open: number;
  overdue: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  byUser: { name: string; count: number }[];
}

interface TrendData {
  scheduled: number[];
  completed: number[];
  open: number[];
  overdue: number[];
}

const channelIcons: Record<string, typeof Phone> = {
  'WA': MessageCircle,
  'Phone call': Phone,
  'In person': Users,
  'Email': Mail,
  'Meeting': Calendar,
  'Others': MoreHorizontal,
};

const channelLabels: Record<string, string> = {
  'WA': 'WhatsApp',
  'Phone call': 'Calls',
  'In person': 'Site Visits',
  'Email': 'Email',
  'Meeting': 'Meeting',
  'Others': 'Other',
};

const priorityColors: Record<string, string> = {
  'High': 'text-destructive bg-destructive/10',
  'Medium': 'text-status-quotation bg-status-quotation/10',
  'Low': 'text-muted-foreground bg-muted',
};

// Mini Sparkline component
const MiniSparkline = ({ data, colorClass }: { data: number[]; colorClass: string }) => {
  const chartData = data.map((value, index) => ({ value, index }));
  const trend = data.length >= 2 ? data[data.length - 1] - data[data.length - 2] : 0;
  
  // Map color classes to actual colors for SVG stroke
  const getStrokeColor = (cls: string) => {
    const colorMap: Record<string, string> = {
      'primary': '#f55000',
      'status-open': '#22c55e',
      'status-quotation': '#f59e0b',
      'destructive': '#ef4444',
      'muted': '#9ca3af',
    };
    return colorMap[cls] || '#9ca3af';
  };
  
  return (
    <div className="flex items-center gap-1 mt-1">
      <div className="w-16 h-6">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={getStrokeColor(colorClass)}
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {trend !== 0 && (
        <span className={`text-[10px] flex items-center ${trend > 0 ? 'text-status-open' : 'text-destructive'}`}>
          {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        </span>
      )}
    </div>
  );
};

export const TodayFollowUpsSummary = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<FollowUpSummary>({
    total: 0,
    completed: 0,
    open: 0,
    overdue: 0,
    byType: {},
    byPriority: {},
    byUser: [],
  });
  const [trendData, setTrendData] = useState<TrendData>({
    scheduled: [],
    completed: [],
    open: [],
    overdue: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayFollowUps();
    fetchTrendData();
  }, []);

  const fetchTrendData = async () => {
    try {
      const today = new Date();
      const sevenDaysAgo = startOfDay(subDays(today, 6));
      
      // Single query to fetch all follow-ups from last 7 days
      const { data: allFollowUps } = await supabase
        .from('follow_up_history')
        .select('id, follow_up_date, status_after, outcome')
        .gte('follow_up_date', sevenDaysAgo.toISOString());

      const followUps = allFollowUps || [];
      
      const trends: TrendData = {
        scheduled: [],
        completed: [],
        open: [],
        overdue: [],
      };

      // Process data client-side for each of the last 7 days
      for (let i = 6; i >= 0; i--) {
        const day = subDays(today, i);
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);

        // Filter follow-ups for this specific day
        const dayFollowUps = followUps.filter(f => {
          const fDate = new Date(f.follow_up_date);
          return fDate >= dayStart && fDate <= dayEnd;
        });

        trends.scheduled.push(dayFollowUps.length);
        trends.completed.push(dayFollowUps.filter(f => f.status_after === 'Closed' || f.outcome).length);
        trends.open.push(dayFollowUps.filter(f => f.status_after === 'Open' || (!f.status_after && !f.outcome)).length);

        // Overdue: follow-ups scheduled before this day that are still open
        const overdueCount = followUps.filter(f => {
          const fDate = new Date(f.follow_up_date);
          return fDate < dayStart && (f.status_after === 'Open' || (!f.status_after && !f.outcome));
        }).length;
        trends.overdue.push(overdueCount);
      }

      setTrendData(trends);
    } catch (error) {
      console.error('Error fetching trend data:', error);
    }
  };

  const fetchTodayFollowUps = async () => {
    try {
      const today = new Date();
      const todayStart = startOfDay(today);
      const todayEnd = endOfDay(today);

      // Fetch today's follow-ups
      const { data: todayFollowUps, error: todayError } = await supabase
        .from('follow_up_history')
        .select('id, follow_up_date, status_after, priority, follow_up_channel, user_id, outcome')
        .gte('follow_up_date', todayStart.toISOString())
        .lte('follow_up_date', todayEnd.toISOString());

      if (todayError) throw todayError;

      // Fetch overdue follow-ups (before today, still open)
      const { data: overdueFollowUps, error: overdueError } = await supabase
        .from('follow_up_history')
        .select('id')
        .lt('follow_up_date', todayStart.toISOString())
        .or('status_after.eq.Open,status_after.is.null');

      if (overdueError) throw overdueError;

      const followUps = todayFollowUps || [];
      const overdueCount = overdueFollowUps?.length || 0;

      // Calculate counts
      const total = followUps.length;
      const completed = followUps.filter(f => 
        f.status_after === 'Closed' || f.outcome
      ).length;
      const open = followUps.filter(f => 
        f.status_after === 'Open' || (!f.status_after && !f.outcome)
      ).length;

      // Breakdown by type (channel)
      const byType: Record<string, number> = {};
      followUps.forEach(f => {
        const channel = f.follow_up_channel || 'Others';
        byType[channel] = (byType[channel] || 0) + 1;
      });

      // Breakdown by priority
      const byPriority: Record<string, number> = {};
      followUps.forEach(f => {
        const priority = f.priority || 'Medium';
        byPriority[priority] = (byPriority[priority] || 0) + 1;
      });

      // Get unique user IDs for today's follow-ups
      const userIds = [...new Set(followUps.map(f => f.user_id).filter(Boolean))];
      
      let byUser: { name: string; count: number }[] = [];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        const userCounts: Record<string, { name: string; count: number }> = {};
        followUps.forEach(f => {
          if (f.user_id) {
            const profile = profiles?.find(p => p.id === f.user_id);
            const name = profile?.full_name || 'Unknown';
            if (!userCounts[f.user_id]) {
              userCounts[f.user_id] = { name, count: 0 };
            }
            userCounts[f.user_id].count++;
          }
        });

        byUser = Object.values(userCounts)
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);
      }

      setSummary({
        total,
        completed,
        open,
        overdue: overdueCount,
        byType,
        byPriority,
        byUser,
      });
    } catch (error) {
      console.error('Error fetching today follow-ups summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateToTasks = (filter?: string) => {
    // Navigate to tasks page with filter query param
    const params = new URLSearchParams();
    if (filter) {
      params.set('filter', filter);
    }
    params.set('date', 'today');
    navigate(`/tasks?${params.toString()}`);
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-5 w-48 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const summaryCards = [
    {
      label: 'Scheduled Today',
      value: summary.total,
      icon: CalendarCheck,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      filter: 'all',
      sparkColorClass: 'primary',
      trendKey: 'scheduled' as keyof TrendData,
    },
    {
      label: 'Completed',
      value: summary.completed,
      icon: CheckCircle2,
      color: 'text-status-open',
      bgColor: 'bg-status-open/10',
      filter: 'completed',
      sparkColorClass: 'status-open',
      trendKey: 'completed' as keyof TrendData,
    },
    {
      label: 'Still Open',
      value: summary.open,
      icon: Clock,
      color: 'text-status-quotation',
      bgColor: 'bg-status-quotation/10',
      filter: 'open',
      sparkColorClass: 'status-quotation',
      trendKey: 'open' as keyof TrendData,
    },
    {
      label: 'Overdue',
      value: summary.overdue,
      icon: AlertTriangle,
      color: summary.overdue > 0 ? 'text-destructive' : 'text-muted-foreground',
      bgColor: summary.overdue > 0 ? 'bg-destructive/10' : 'bg-muted',
      filter: 'overdue',
      sparkColorClass: summary.overdue > 0 ? 'destructive' : 'muted',
      trendKey: 'overdue' as keyof TrendData,
    },
  ];

  return (
    <Card className="animate-card-enter">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-lg">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Today's Follow-ups Summary
          </span>
          <button
            onClick={() => handleNavigateToTasks()}
            className="text-sm font-normal text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
          >
            View all tasks
            <ArrowRight className="h-4 w-4" />
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Main Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.label}
                onClick={() => handleNavigateToTasks(card.filter)}
                className="p-3 rounded-xl border border-border/50 hover:border-primary/30 hover:shadow-sm transition-all text-left group overflow-hidden"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-lg ${card.bgColor}`}>
                    <Icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                  <span className="text-xs text-muted-foreground">{card.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className={`text-2xl font-bold ${card.color} group-hover:scale-105 transition-transform`}>
                    {card.value}
                  </p>
                  {trendData[card.trendKey].length > 0 && (
                    <MiniSparkline 
                      data={trendData[card.trendKey]} 
                      colorClass={card.sparkColorClass} 
                    />
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Last 7 days</p>
              </button>
            );
          })}
        </div>

        {/* Breakdown Sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* By Type */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
            <h4 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
              By Channel
            </h4>
            <div className="space-y-2">
              {Object.keys(channelLabels).map((channel) => {
                const count = summary.byType[channel] || 0;
                if (count === 0 && !['WA', 'Phone call', 'In person'].includes(channel)) return null;
                const Icon = channelIcons[channel] || MoreHorizontal;
                return (
                  <div key={channel} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">{channelLabels[channel]}</span>
                    </div>
                    <span className="font-medium">{count}</span>
                  </div>
                );
              })}
              {Object.keys(summary.byType).length === 0 && (
                <p className="text-xs text-muted-foreground">No follow-ups today</p>
              )}
            </div>
          </div>

          {/* By Priority */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
            <h4 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
              By Priority
            </h4>
            <div className="space-y-2">
              {['High', 'Medium', 'Low'].map((priority) => {
                const count = summary.byPriority[priority] || 0;
                return (
                  <div key={priority} className="flex items-center justify-between text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[priority]}`}>
                      {priority}
                    </span>
                    <span className="font-medium">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By Assigned User */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
            <h4 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
              Top Assignees
            </h4>
            <div className="space-y-2">
              {summary.byUser.length > 0 ? (
                summary.byUser.map((user, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground truncate max-w-[100px]">
                        {user.name}
                      </span>
                    </div>
                    <span className="font-medium">{user.count}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No assignees today</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TodayFollowUpsSummary;
