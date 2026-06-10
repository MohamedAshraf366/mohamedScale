import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Trophy, 
  Medal, 
  Flame, 
  Target, 
  Star,
  Crown,
  Zap,
  Award,
  Sparkles,
  TrendingUp,
  BarChart3,
  Brain,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { subDays, differenceInDays, startOfDay, isSameDay, format, startOfWeek, startOfMonth, endOfWeek, endOfMonth, eachWeekOfInterval, eachMonthOfInterval, isWithinInterval } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';

interface TeamMemberStats {
  name: string;
  communications: number;
  dealsClosed: number;
  conversionRate: number;
  streak: number;
  totalValue: number;
  badges: string[];
  rank: number;
}

interface TrendData {
  period: string;
  [key: string]: number | string;
}

interface RevenueTrendData {
  period: string;
  deals: number;
  revenue: number;
}

interface TeamLeaderboardProps {
  startDate: Date;
}

// Confetti particle component
const ConfettiParticle = ({ delay, color }: { delay: number; color: string }) => (
  <div
    className="absolute w-2 h-2 rounded-full"
    style={{
      backgroundColor: color,
      left: `${Math.random() * 100}%`,
      top: '-10px',
      animation: `confetti-fall ${1.5 + Math.random()}s ease-out ${delay}ms forwards`,
    }}
  />
);

// Celebration confetti burst
const CelebrationConfetti = ({ show }: { show: boolean }) => {
  if (!show) return null;
  
  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {[...Array(20)].map((_, i) => (
        <ConfettiParticle
          key={i}
          delay={i * 50}
          color={colors[i % colors.length]}
        />
      ))}
    </div>
  );
};

// Sparkle effect for top performers
const SparkleRing = ({ active }: { active: boolean }) => {
  if (!active) return null;
  
  return (
    <div className="absolute -inset-1 pointer-events-none">
      {[...Array(4)].map((_, i) => (
        <Sparkles
          key={i}
          className="absolute text-yellow-400"
          style={{
            width: '14px',
            height: '14px',
            opacity: 0,
            animation: `sparkle-pop 1s ease-out ${i * 200}ms infinite`,
            top: i === 0 ? '-4px' : i === 2 ? 'auto' : '50%',
            bottom: i === 2 ? '-4px' : 'auto',
            left: i === 3 ? '-4px' : i === 1 ? 'auto' : '50%',
            right: i === 1 ? '-4px' : 'auto',
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </div>
  );
};

const BADGE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  'top-closer': { icon: <Trophy className="h-3 w-3" />, label: 'Top Closer', color: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30' },
  'high-volume': { icon: <Zap className="h-3 w-3" />, label: 'High Volume', color: 'bg-blue-500/20 text-blue-600 border-blue-500/30' },
  'hot-streak': { icon: <Flame className="h-3 w-3" />, label: 'Hot Streak', color: 'bg-orange-500/20 text-orange-600 border-orange-500/30' },
  'rising-star': { icon: <Star className="h-3 w-3" />, label: 'Rising Star', color: 'bg-purple-500/20 text-purple-600 border-purple-500/30' },
  'consistent': { icon: <Target className="h-3 w-3" />, label: 'Consistent', color: 'bg-green-500/20 text-green-600 border-green-500/30' },
};

const TeamLeaderboard = ({ startDate }: TeamLeaderboardProps) => {
  const [teamStats, setTeamStats] = useState<TeamMemberStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('rankings');
  const [showCelebration, setShowCelebration] = useState(false);
  const [trendPeriod, setTrendPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [revenueTrendData, setRevenueTrendData] = useState<RevenueTrendData[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    fetchTeamPerformance();
  }, [startDate]);

  useEffect(() => {
    if (teamStats.length > 0 && selectedMembers.length === 0) {
      setSelectedMembers(teamStats.slice(0, 3).map(m => m.name));
    }
  }, [teamStats]);

  useEffect(() => {
    if (activeTab === 'trends' && teamStats.length > 0) {
      fetchTrendData();
    }
  }, [activeTab, trendPeriod, startDate]);

  // Trigger celebration when switching to badges tab and there are badges
  useEffect(() => {
    if (activeTab === 'badges' && teamStats.some(m => m.badges.length > 0)) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [activeTab, teamStats]);

  const calculateStreak = (dates: Date[]): number => {
    if (dates.length === 0) return 0;
    
    const sortedDates = dates
      .map(d => startOfDay(new Date(d)))
      .sort((a, b) => b.getTime() - a.getTime());
    
    let streak = 0;
    let currentDate = startOfDay(new Date());
    
    for (const date of sortedDates) {
      if (isSameDay(date, currentDate) || isSameDay(date, subDays(currentDate, 1))) {
        streak++;
        currentDate = date;
      } else if (differenceInDays(currentDate, date) > 1) {
        break;
      }
    }
    
    return streak;
  };

  const assignBadges = (member: Omit<TeamMemberStats, 'badges' | 'rank'>, allMembers: Omit<TeamMemberStats, 'badges' | 'rank'>[]): string[] => {
    const badges: string[] = [];
    
    const maxDeals = Math.max(...allMembers.map(m => m.dealsClosed));
    if (member.dealsClosed === maxDeals && maxDeals > 0) {
      badges.push('top-closer');
    }
    
    const maxComms = Math.max(...allMembers.map(m => m.communications));
    if (member.communications === maxComms && maxComms >= 10) {
      badges.push('high-volume');
    }
    
    if (member.streak >= 3) {
      badges.push('hot-streak');
    }
    
    if (member.conversionRate >= 30 && member.communications >= 5) {
      badges.push('rising-star');
    }
    
    if (member.streak >= 5) {
      badges.push('consistent');
    }
    
    return badges;
  };

  const fetchTeamPerformance = async () => {
    setLoading(true);
    try {
      // Fetch communications
      const { data: communications } = await supabase
        .from('communication_log')
        .select('assigned_to, deal_completed, communication_date, deal_value_total')
        .gte('communication_date', startDate.toISOString())
        .not('assigned_to', 'is', null);

      // Get unique user IDs and fetch their profiles
      const userIds = [...new Set(communications?.map(c => c.assigned_to).filter(Boolean) || [])];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      // Create a map of user ID to display name
      const userNameMap = new Map<string, string>();
      profiles?.forEach(profile => {
        const displayName = profile.full_name || profile.email || profile.id;
        userNameMap.set(profile.id, displayName);
      });

      const memberMap = new Map<string, { 
        comms: number; 
        closed: number; 
        dates: Date[]; 
        totalValue: number;
      }>();
      
      communications?.forEach(comm => {
        const userId = comm.assigned_to;
        if (!userId) return;
        
        // Use the display name from profiles, fallback to userId
        const displayName = userNameMap.get(userId) || userId;
        
        const current = memberMap.get(displayName) || { comms: 0, closed: 0, dates: [], totalValue: 0 };
        current.comms += 1;
        if (comm.deal_completed) {
          current.closed += 1;
          current.totalValue += comm.deal_value_total || 0;
        }
        if (comm.communication_date) {
          current.dates.push(new Date(comm.communication_date));
        }
        memberMap.set(displayName, current);
      });

      const statsWithoutBadges: Omit<TeamMemberStats, 'badges' | 'rank'>[] = [];
      
      memberMap.forEach((value, name) => {
        const conversionRate = value.comms > 0 ? (value.closed / value.comms) * 100 : 0;
        const streak = calculateStreak(value.dates);
        
        statsWithoutBadges.push({
          name,
          communications: value.comms,
          dealsClosed: value.closed,
          conversionRate,
          streak,
          totalValue: value.totalValue,
        });
      });

      statsWithoutBadges.sort((a, b) => {
        if (b.dealsClosed !== a.dealsClosed) return b.dealsClosed - a.dealsClosed;
        return b.communications - a.communications;
      });

      const finalStats: TeamMemberStats[] = statsWithoutBadges.map((member, index) => ({
        ...member,
        badges: assignBadges(member, statsWithoutBadges),
        rank: index + 1,
      }));

      setTeamStats(finalStats);
    } catch (error) {
      console.error('Error fetching team performance:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendData = async () => {
    try {
      // Fetch 12 weeks or 6 months of data for trends
      const trendStartDate = trendPeriod === 'weekly' 
        ? subDays(new Date(), 84) // 12 weeks
        : subDays(new Date(), 180); // 6 months

      const { data: communications } = await supabase
        .from('communication_log')
        .select('assigned_to, deal_completed, communication_date, deal_value_total, deal_closed_at')
        .gte('communication_date', trendStartDate.toISOString())
        .not('assigned_to', 'is', null);

      if (!communications || communications.length === 0) {
        setTrendData([]);
        setRevenueTrendData([]);
        return;
      }

      // Get unique team members
      const members = [...new Set(communications.map(c => c.assigned_to).filter(Boolean))];

      // Generate period intervals
      const now = new Date();
      let intervals: { start: Date; end: Date; label: string }[] = [];

      if (trendPeriod === 'weekly') {
        const weeks = eachWeekOfInterval({ start: trendStartDate, end: now }, { weekStartsOn: 0 });
        intervals = weeks.slice(-8).map(weekStart => ({
          start: startOfWeek(weekStart, { weekStartsOn: 0 }),
          end: endOfWeek(weekStart, { weekStartsOn: 0 }),
          label: format(weekStart, 'MMM d'),
        }));
      } else {
        const months = eachMonthOfInterval({ start: trendStartDate, end: now });
        intervals = months.slice(-6).map(monthStart => ({
          start: startOfMonth(monthStart),
          end: endOfMonth(monthStart),
          label: format(monthStart, 'MMM'),
        }));
      }

      // Build communication trend data
      const trends: TrendData[] = intervals.map(interval => {
        const periodData: TrendData = { period: interval.label };
        
        members.forEach(member => {
          if (!member) return;
          const memberComms = communications.filter(c => {
            if (c.assigned_to !== member || !c.communication_date) return false;
            const commDate = new Date(c.communication_date);
            return isWithinInterval(commDate, { start: interval.start, end: interval.end });
          });
          periodData[member] = memberComms.length;
        });

        return periodData;
      });

      // Build revenue trend data (deals and revenue by period)
      const revenueTrends: RevenueTrendData[] = intervals.map(interval => {
        const periodDeals = communications.filter(c => {
          if (!c.deal_completed) return false;
          // Use deal_closed_at if available, otherwise fall back to communication_date
          const dealDate = c.deal_closed_at ? new Date(c.deal_closed_at) : (c.communication_date ? new Date(c.communication_date) : null);
          if (!dealDate) return false;
          return isWithinInterval(dealDate, { start: interval.start, end: interval.end });
        });

        const totalRevenue = periodDeals.reduce((sum, c) => sum + (c.deal_value_total || 0), 0);

        return {
          period: interval.label,
          deals: periodDeals.length,
          revenue: totalRevenue,
        };
      });

      setTrendData(trends);
      setRevenueTrendData(revenueTrends);
    } catch (error) {
      console.error('Error fetching trend data:', error);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="relative">
            <Crown className="h-5 w-5 text-yellow-500 animate-bounce-subtle" />
            <SparkleRing active />
          </div>
        );
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Medal className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">{rank}</span>;
    }
  };

  const getRankBgClass = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-500/10 to-yellow-500/5 border-yellow-500/20 animate-glow-pulse';
      case 2:
        return 'bg-gradient-to-r from-gray-400/10 to-gray-400/5 border-gray-400/20';
      case 3:
        return 'bg-gradient-to-r from-amber-600/10 to-amber-600/5 border-amber-600/20';
      default:
        return 'bg-muted/30 border-border/50';
    }
  };

  const fetchAiInsights = async () => {
    if (teamStats.length === 0) {
      toast.error('No team data available to analyze');
      return;
    }

    setLoadingInsights(true);
    setAiInsights(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/team-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ teamStats }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          toast.error('Rate limit exceeded. Please try again in a moment.');
        } else if (response.status === 402) {
          toast.error('AI credits exhausted. Add credits in Settings → Workspace → Usage.');
        } else {
          toast.error(data.error || 'Failed to generate insights');
        }
        return;
      }

      setAiInsights(data.insights);
      setActiveTab('insights');
    } catch (error) {
      console.error('Error fetching AI insights:', error);
      toast.error('Failed to connect to AI service');
    } finally {
      setLoadingInsights(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Team Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden relative">
      <CelebrationConfetti show={showCelebration} />
      
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Team Leaderboard
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAiInsights}
            disabled={loadingInsights || teamStats.length === 0}
            className="gap-1.5 h-8"
          >
            {loadingInsights ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Brain className="h-3.5 w-3.5" />
            )}
            AI Insights
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full rounded-none border-b bg-transparent h-auto p-0">
            <TabsTrigger 
              value="rankings" 
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
            >
              Rankings
            </TabsTrigger>
            <TabsTrigger 
              value="streaks" 
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
            >
              Streaks
            </TabsTrigger>
            <TabsTrigger 
              value="badges" 
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
            >
              Badges
            </TabsTrigger>
            <TabsTrigger 
              value="trends" 
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              Trends
            </TabsTrigger>
            {aiInsights && (
              <TabsTrigger 
                value="insights" 
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
              >
                <Brain className="h-3 w-3 mr-1" />
                Insights
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="rankings" className="p-4 pt-3 mt-0">
            {teamStats.length > 0 ? (
              <div className="space-y-2">
                {teamStats.slice(0, 5).map((member, idx) => (
                  <div
                    key={member.name}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-300 hover:shadow-sm ${getRankBgClass(member.rank)}`}
                    style={{ 
                      animation: `slide-up 0.4s ease-out ${idx * 100}ms backwards`
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {getRankIcon(member.rank)}
                      <div>
                        <p className="font-medium text-sm">{member.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{member.communications} comms</span>
                          <span>•</span>
                          <span className="text-green-600 font-medium">{member.dealsClosed} deals</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">{member.conversionRate.toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground">conversion</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-6 text-sm">
                No team data available. Assign team members to communications to see rankings.
              </p>
            )}
          </TabsContent>

          <TabsContent value="streaks" className="p-4 pt-3 mt-0">
            {teamStats.length > 0 ? (
              <div className="space-y-2">
                {[...teamStats]
                  .sort((a, b) => b.streak - a.streak)
                  .slice(0, 5)
                  .map((member, idx) => (
                    <div
                      key={member.name}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 transition-all duration-300"
                      style={{ 
                        animation: `slide-up 0.4s ease-out ${idx * 100}ms backwards`
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`relative w-8 h-8 rounded-full flex items-center justify-center ${
                          member.streak >= 5 ? 'bg-orange-500/20' : 
                          member.streak >= 3 ? 'bg-yellow-500/20' : 'bg-muted'
                        }`}>
                          <Flame className={`h-4 w-4 ${
                            member.streak >= 5 ? 'text-orange-500 animate-flame' : 
                            member.streak >= 3 ? 'text-yellow-500 animate-flame-slow' : 'text-muted-foreground'
                          }`} />
                        </div>
                        <p className="font-medium text-sm">{member.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold transition-all ${
                          member.streak >= 5 ? 'text-orange-500 animate-pulse' : 
                          member.streak >= 3 ? 'text-yellow-500' : 'text-muted-foreground'
                        }`}>
                          {member.streak}
                        </span>
                        <span className="text-xs text-muted-foreground">day streak</span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-6 text-sm">
                No streak data available.
              </p>
            )}
          </TabsContent>

          <TabsContent value="badges" className="p-4 pt-3 mt-0">
            {teamStats.some(m => m.badges.length > 0) ? (
              <div className="space-y-3">
                {teamStats
                  .filter(m => m.badges.length > 0)
                  .slice(0, 5)
                  .map((member, memberIdx) => (
                    <div
                      key={member.name}
                      className="p-3 rounded-lg bg-muted/30 border border-border/50 transition-all"
                      style={{ 
                        animation: `scale-in 0.4s ease-out ${memberIdx * 150}ms backwards`
                      }}
                    >
                      <p className="font-medium text-sm mb-2">{member.name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {member.badges.map((badge, badgeIdx) => {
                          const config = BADGE_CONFIG[badge];
                          if (!config) return null;
                          return (
                            <Badge
                              key={badge}
                              variant="outline"
                              className={`text-xs gap-1 transition-all hover:scale-105 ${config.color}`}
                              style={{ 
                                animation: `badge-pop 0.5s ease-out ${memberIdx * 150 + badgeIdx * 100}ms backwards`
                              }}
                            >
                              <span className="animate-bounce-subtle">{config.icon}</span>
                              {config.label}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Award className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No badges earned yet. Keep closing deals to unlock achievements!
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="trends" className="p-4 pt-3 mt-0">
            <div className="space-y-4">
              {/* Period Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Performance Trends</span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant={trendPeriod === 'weekly' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTrendPeriod('weekly')}
                    className="h-7 text-xs"
                  >
                    Weekly
                  </Button>
                  <Button
                    variant={trendPeriod === 'monthly' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTrendPeriod('monthly')}
                    className="h-7 text-xs"
                  >
                    Monthly
                  </Button>
                </div>
              </div>

              {/* Member Selector */}
              <div className="flex flex-wrap gap-1.5">
                {teamStats.slice(0, 5).map((member) => (
                  <Button
                    key={member.name}
                    variant={selectedMembers.includes(member.name) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setSelectedMembers(prev => 
                        prev.includes(member.name)
                          ? prev.filter(n => n !== member.name)
                          : [...prev, member.name]
                      );
                    }}
                    className="h-6 text-xs px-2"
                  >
                    {member.name}
                  </Button>
                ))}
              </div>

              {/* Communications Chart */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Communications by Member</p>
                {trendData.length > 0 && selectedMembers.length > 0 ? (
                  <div className="h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                        <XAxis 
                          dataKey="period" 
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        {selectedMembers.map((member, idx) => {
                          const colors = [
                            'hsl(var(--primary))',
                            'hsl(142, 71%, 45%)',
                            'hsl(25, 95%, 53%)',
                            'hsl(262, 83%, 58%)',
                            'hsl(199, 89%, 48%)',
                          ];
                          return (
                            <Line
                              key={member}
                              type="monotone"
                              dataKey={member}
                              stroke={colors[idx % colors.length]}
                              strokeWidth={2}
                              dot={{ r: 3, fill: colors[idx % colors.length] }}
                              activeDot={{ r: 5, strokeWidth: 2 }}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <TrendingUp className="h-6 w-6 mx-auto text-muted-foreground/50 mb-1" />
                    <p className="text-xs text-muted-foreground">
                      {selectedMembers.length === 0 
                        ? 'Select team members to view trends'
                        : 'No trend data available'}
                    </p>
                  </div>
                )}
              </div>

              {/* Deals & Revenue Chart */}
              <div className="space-y-1 mt-4">
                <p className="text-xs font-medium text-muted-foreground">Deals & Revenue</p>
                {revenueTrendData.length > 0 ? (
                  <div className="h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                        <XAxis 
                          dataKey="period" 
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                        />
                        <YAxis 
                          yAxisId="left"
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                          allowDecimals={false}
                        />
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                          formatter={(value: number, name: string) => [
                            name === 'revenue' ? `SAR ${value.toLocaleString()}` : value,
                            name === 'revenue' ? 'Revenue' : 'Deals'
                          ]}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar 
                          yAxisId="left"
                          dataKey="deals" 
                          name="Deals"
                          fill="hsl(142, 71%, 45%)" 
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar 
                          yAxisId="right"
                          dataKey="revenue" 
                          name="Revenue"
                          fill="hsl(25, 95%, 53%)" 
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <BarChart3 className="h-6 w-6 mx-auto text-muted-foreground/50 mb-1" />
                    <p className="text-xs text-muted-foreground">No deals data available</p>
                  </div>
                )}
              </div>

              {/* Comparison Summary */}
              {trendData.length > 1 && selectedMembers.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {selectedMembers.slice(0, 4).map((member, idx) => {
                    const latestValue = trendData[trendData.length - 1]?.[member] as number || 0;
                    const previousValue = trendData[trendData.length - 2]?.[member] as number || 0;
                    const change = previousValue > 0 
                      ? ((latestValue - previousValue) / previousValue * 100).toFixed(0)
                      : latestValue > 0 ? '+100' : '0';
                    const isPositive = latestValue >= previousValue;
                    
                    return (
                      <div 
                        key={member}
                        className="p-2 rounded-lg bg-muted/30 border border-border/50"
                        style={{ animation: `slide-up 0.3s ease-out ${idx * 100}ms backwards` }}
                      >
                        <p className="text-xs text-muted-foreground truncate">{member}</p>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold">{latestValue}</span>
                          <span className={`text-xs ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                            {isPositive ? '↑' : '↓'}{Math.abs(Number(change))}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* AI Insights Tab */}
          {aiInsights && (
            <TabsContent value="insights" className="p-4 pt-3 mt-0">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Brain className="h-4 w-4 text-primary" />
                  <span>AI-Generated Performance Analysis</span>
                </div>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <div 
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ 
                      __html: aiInsights
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\n/g, '<br />')
                    }}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchAiInsights}
                  disabled={loadingInsights}
                  className="text-xs gap-1.5"
                >
                  {loadingInsights ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Brain className="h-3 w-3" />
                  )}
                  Regenerate Insights
                </Button>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
      
      {/* Inline styles for custom animations */}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(300px) rotate(720deg); opacity: 0; }
        }
        @keyframes sparkle-pop {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes badge-pop {
          0% { opacity: 0; transform: scale(0.5); }
          70% { transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 8px rgba(234, 179, 8, 0.2); }
          50% { box-shadow: 0 0 16px rgba(234, 179, 8, 0.4); }
        }
        @keyframes flame {
          0%, 100% { transform: scale(1) rotate(-3deg); }
          50% { transform: scale(1.1) rotate(3deg); }
        }
        @keyframes flame-slow {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        .animate-glow-pulse { animation: glow-pulse 2s ease-in-out infinite; }
        .animate-flame { animation: flame 0.5s ease-in-out infinite; }
        .animate-flame-slow { animation: flame-slow 1s ease-in-out infinite; }
        .animate-bounce-subtle { animation: bounce-subtle 1.5s ease-in-out infinite; }
      `}</style>
    </Card>
  );
};

export default TeamLeaderboard;
