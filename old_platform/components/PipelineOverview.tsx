import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Users,
  FileText,
  CheckCircle2,
  RefreshCw,
  CalendarDays,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { 
  startOfMonth, 
  endOfMonth, 
  startOfQuarter, 
  endOfQuarter, 
  startOfWeek,
  endOfWeek,
  subMonths, 
  subQuarters,
  subWeeks,
  format,
  eachMonthOfInterval,
  eachWeekOfInterval,
  eachDayOfInterval,
  getWeek,
  isWithinInterval
} from 'date-fns';

interface PipelineStage {
  id: string;
  name: string;
  count: number;
  conversionRate: number;
  icon: React.ElementType;
  filterValue: string;
}

interface TrendDataPoint {
  label: string;
  closedDeals: number;
  lostDeals: number;
}

interface BottleneckData {
  stageName: string;
  avgDays: number;
}

interface SparklinePoint {
  value: number;
}

interface PeriodComparison {
  currentPeriod: {
    closedDeals: number;
    totalValue: number;
    qualifiedLeads: number;
    conversionRate: number;
  };
  previousPeriod: {
    closedDeals: number;
    totalValue: number;
    qualifiedLeads: number;
    conversionRate: number;
  };
  periodLabel: string;
  prevPeriodLabel: string;
  sparklines: {
    closedDeals: SparklinePoint[];
    qualifiedLeads: SparklinePoint[];
    conversionRate: SparklinePoint[];
  };
}

interface PipelineOverviewProps {
  className?: string;
}

const PipelineOverview = ({ className }: PipelineOverviewProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [bottleneck, setBottleneck] = useState<BottleneckData | null>(null);
  const [trendPeriod, setTrendPeriod] = useState<'week' | 'month' | 'quarter' | 'custom'>('month');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  });
  const [loading, setLoading] = useState(true);
  const [periodComparison, setPeriodComparison] = useState<PeriodComparison | null>(null);
  const [showComparison, setShowComparison] = useState(true);

  useEffect(() => {
    fetchPipelineData();
  }, [trendPeriod, dateRange]);

  const fetchPipelineData = async () => {
    try {
      setLoading(true);
      
      // Fetch all communications for pipeline calculations
      const { data: comms, error } = await supabase
        .from('communication_log')
        .select('*');

      if (error) throw error;

      const allComms = comms || [];

      // Calculate stage counts
      const rawOutreach = allComms.length;
      const qualifiedLeads = allComms.filter(c => 
        ['High', 'Medium', 'Low'].includes(c.interest_level) || c.quotation_required === true
      ).length;
      const proposalsSent = allComms.filter(c => 
        c.is_general_quotation === true || c.quotation_required === true
      ).length;
      const closedDeals = allComms.filter(c => 
        c.deal_completed === true && c.status === 'Closed'
      ).length;
      
      // Repeat deals - closed deals from companies with previous closed deals
      const repeatDeals = allComms.filter(c => {
        if (!c.deal_completed || c.status !== 'Closed' || !c.company_name) return false;
        const previousDeals = allComms.filter(prev => 
          prev.id !== c.id && 
          prev.company_name === c.company_name && 
          prev.deal_completed === true &&
          new Date(prev.communication_date) < new Date(c.communication_date)
        );
        return previousDeals.length > 0;
      }).length;

      // Calculate conversion rates
      const qualificationRate = rawOutreach > 0 ? (qualifiedLeads / rawOutreach) * 100 : 0;
      const proposalRate = qualifiedLeads > 0 ? (proposalsSent / qualifiedLeads) * 100 : 0;
      const closeRate = proposalsSent > 0 ? (closedDeals / proposalsSent) * 100 : 0;
      const repeatRate = closedDeals > 0 ? (repeatDeals / closedDeals) * 100 : 0;

      setStages([
        { 
          id: 'raw', 
          name: 'Raw Outreach', 
          count: rawOutreach, 
          conversionRate: 100,
          icon: Users,
          filterValue: 'all'
        },
        { 
          id: 'qualified', 
          name: 'Qualified Leads', 
          count: qualifiedLeads, 
          conversionRate: qualificationRate,
          icon: TrendingUp,
          filterValue: 'qualified'
        },
        { 
          id: 'proposals', 
          name: 'Proposals Sent', 
          count: proposalsSent, 
          conversionRate: proposalRate,
          icon: FileText,
          filterValue: 'proposal'
        },
        { 
          id: 'closed', 
          name: 'Closed Deals', 
          count: closedDeals, 
          conversionRate: closeRate,
          icon: CheckCircle2,
          filterValue: 'closed'
        },
        { 
          id: 'repeat', 
          name: 'Repeat Deals', 
          count: repeatDeals, 
          conversionRate: repeatRate,
          icon: RefreshCw,
          filterValue: 'repeat'
        },
      ]);

      // Calculate trend data
      const now = new Date();
      let trendPoints: TrendDataPoint[] = [];

      if (trendPeriod === 'week') {
        // Last 8 weeks
        const weeks = eachWeekOfInterval({
          start: subWeeks(now, 7),
          end: now
        });

        trendPoints = weeks.map(week => {
          const weekStart = startOfWeek(week);
          const weekEnd = endOfWeek(week);
          
          const weekComms = allComms.filter(c => {
            const commDate = new Date(c.communication_date);
            return commDate >= weekStart && commDate <= weekEnd;
          });

          const closed = weekComms.filter(c => c.deal_completed === true && c.status === 'Closed').length;
          const lost = weekComms.filter(c => c.interest_level === 'Not interested' || c.status === 'Closed' && !c.deal_completed).length;

          return {
            label: `W${getWeek(week)}`,
            closedDeals: closed,
            lostDeals: lost
          };
        });
      } else if (trendPeriod === 'month') {
        // Last 6 months
        const months = eachMonthOfInterval({
          start: subMonths(now, 5),
          end: now
        });

        trendPoints = months.map(month => {
          const monthStart = startOfMonth(month);
          const monthEnd = endOfMonth(month);
          
          const monthComms = allComms.filter(c => {
            const commDate = new Date(c.communication_date);
            return commDate >= monthStart && commDate <= monthEnd;
          });

          const closed = monthComms.filter(c => c.deal_completed === true && c.status === 'Closed').length;
          const lost = monthComms.filter(c => c.interest_level === 'Not interested' || c.status === 'Closed' && !c.deal_completed).length;

          return {
            label: format(month, 'MMM'),
            closedDeals: closed,
            lostDeals: lost
          };
        });
      } else if (trendPeriod === 'quarter') {
        // Last 4 quarters
        const quarters = [0, 1, 2, 3].map(i => subQuarters(now, i)).reverse();
        
        trendPoints = quarters.map(quarter => {
          const quarterStart = startOfQuarter(quarter);
          const quarterEnd = endOfQuarter(quarter);
          
          const quarterComms = allComms.filter(c => {
            const commDate = new Date(c.communication_date);
            return commDate >= quarterStart && commDate <= quarterEnd;
          });

          const closed = quarterComms.filter(c => c.deal_completed === true && c.status === 'Closed').length;
          const lost = quarterComms.filter(c => c.interest_level === 'Not interested' || c.status === 'Closed' && !c.deal_completed).length;

          return {
            label: `Q${Math.floor(quarter.getMonth() / 3) + 1}`,
            closedDeals: closed,
            lostDeals: lost
          };
        });
      } else if (trendPeriod === 'custom' && dateRange.from && dateRange.to) {
        // Custom date range - group by day if range <= 14 days, otherwise by week
        const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 14) {
          const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
          trendPoints = days.map(day => {
            const dayComms = allComms.filter(c => {
              const commDate = new Date(c.communication_date);
              return format(commDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
            });

            const closed = dayComms.filter(c => c.deal_completed === true && c.status === 'Closed').length;
            const lost = dayComms.filter(c => c.interest_level === 'Not interested' || c.status === 'Closed' && !c.deal_completed).length;

            return {
              label: format(day, 'd MMM'),
              closedDeals: closed,
              lostDeals: lost
            };
          });
        } else {
          const weeks = eachWeekOfInterval({ start: dateRange.from, end: dateRange.to });
          trendPoints = weeks.map(week => {
            const weekStart = startOfWeek(week);
            const weekEnd = endOfWeek(week);
            
            const weekComms = allComms.filter(c => {
              const commDate = new Date(c.communication_date);
              return commDate >= weekStart && commDate <= weekEnd && 
                     isWithinInterval(commDate, { start: dateRange.from!, end: dateRange.to! });
            });

            const closed = weekComms.filter(c => c.deal_completed === true && c.status === 'Closed').length;
            const lost = weekComms.filter(c => c.interest_level === 'Not interested' || c.status === 'Closed' && !c.deal_completed).length;

            return {
              label: format(week, 'd MMM'),
              closedDeals: closed,
              lostDeals: lost
            };
          });
        }
      }

      setTrendData(trendPoints);

      // Calculate period comparison
      let currentStart: Date, currentEnd: Date, prevStart: Date, prevEnd: Date;
      let periodLabel = '', prevPeriodLabel = '';

      if (trendPeriod === 'week') {
        currentStart = startOfWeek(now);
        currentEnd = endOfWeek(now);
        prevStart = startOfWeek(subWeeks(now, 1));
        prevEnd = endOfWeek(subWeeks(now, 1));
        periodLabel = 'This Week';
        prevPeriodLabel = 'Last Week';
      } else if (trendPeriod === 'month') {
        currentStart = startOfMonth(now);
        currentEnd = endOfMonth(now);
        prevStart = startOfMonth(subMonths(now, 1));
        prevEnd = endOfMonth(subMonths(now, 1));
        periodLabel = format(now, 'MMM yyyy');
        prevPeriodLabel = format(subMonths(now, 1), 'MMM yyyy');
      } else if (trendPeriod === 'quarter') {
        currentStart = startOfQuarter(now);
        currentEnd = endOfQuarter(now);
        prevStart = startOfQuarter(subQuarters(now, 1));
        prevEnd = endOfQuarter(subQuarters(now, 1));
        periodLabel = `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
        prevPeriodLabel = `Q${Math.floor(subQuarters(now, 1).getMonth() / 3) + 1} ${subQuarters(now, 1).getFullYear()}`;
      } else if (trendPeriod === 'custom' && dateRange.from && dateRange.to) {
        currentStart = dateRange.from;
        currentEnd = dateRange.to;
        const rangeDuration = dateRange.to.getTime() - dateRange.from.getTime();
        prevEnd = new Date(dateRange.from.getTime() - 1);
        prevStart = new Date(prevEnd.getTime() - rangeDuration);
        periodLabel = `${format(dateRange.from, 'd MMM')} - ${format(dateRange.to, 'd MMM')}`;
        prevPeriodLabel = `${format(prevStart, 'd MMM')} - ${format(prevEnd, 'd MMM')}`;
      } else {
        currentStart = startOfMonth(now);
        currentEnd = endOfMonth(now);
        prevStart = startOfMonth(subMonths(now, 1));
        prevEnd = endOfMonth(subMonths(now, 1));
        periodLabel = format(now, 'MMM yyyy');
        prevPeriodLabel = format(subMonths(now, 1), 'MMM yyyy');
      }

      const currentPeriodComms = allComms.filter(c => {
        const commDate = new Date(c.communication_date);
        return commDate >= currentStart && commDate <= currentEnd;
      });

      const prevPeriodComms = allComms.filter(c => {
        const commDate = new Date(c.communication_date);
        return commDate >= prevStart && commDate <= prevEnd;
      });

      const calcMetrics = (comms: typeof allComms) => {
        const qualified = comms.filter(c => 
          ['High', 'Medium', 'Low'].includes(c.interest_level) || c.quotation_required === true
        ).length;
        const closed = comms.filter(c => c.deal_completed === true && c.status === 'Closed').length;
        const totalVal = comms
          .filter(c => c.deal_completed === true && c.status === 'Closed')
          .reduce((sum, c) => sum + (c.deal_value_total || 0), 0);
        const convRate = comms.length > 0 ? (closed / comms.length) * 100 : 0;
        return { closedDeals: closed, totalValue: totalVal, qualifiedLeads: qualified, conversionRate: convRate };
      };

      // Generate sparkline data (last 6 data points for trend)
      const generateSparklineData = () => {
        const sparklinePoints = 6;
        const closedDealsData: SparklinePoint[] = [];
        const qualifiedLeadsData: SparklinePoint[] = [];
        const conversionRateData: SparklinePoint[] = [];

        if (trendPeriod === 'week') {
          for (let i = sparklinePoints - 1; i >= 0; i--) {
            const weekStart = startOfWeek(subWeeks(now, i));
            const weekEnd = endOfWeek(subWeeks(now, i));
            const weekComms = allComms.filter(c => {
              const d = new Date(c.communication_date);
              return d >= weekStart && d <= weekEnd;
            });
            closedDealsData.push({ value: weekComms.filter(c => c.deal_completed && c.status === 'Closed').length });
            qualifiedLeadsData.push({ value: weekComms.filter(c => ['High', 'Medium', 'Low'].includes(c.interest_level) || c.quotation_required).length });
            conversionRateData.push({ value: weekComms.length > 0 ? (weekComms.filter(c => c.deal_completed && c.status === 'Closed').length / weekComms.length) * 100 : 0 });
          }
        } else if (trendPeriod === 'month' || trendPeriod === 'custom') {
          for (let i = sparklinePoints - 1; i >= 0; i--) {
            const monthStart = startOfMonth(subMonths(now, i));
            const monthEnd = endOfMonth(subMonths(now, i));
            const monthComms = allComms.filter(c => {
              const d = new Date(c.communication_date);
              return d >= monthStart && d <= monthEnd;
            });
            closedDealsData.push({ value: monthComms.filter(c => c.deal_completed && c.status === 'Closed').length });
            qualifiedLeadsData.push({ value: monthComms.filter(c => ['High', 'Medium', 'Low'].includes(c.interest_level) || c.quotation_required).length });
            conversionRateData.push({ value: monthComms.length > 0 ? (monthComms.filter(c => c.deal_completed && c.status === 'Closed').length / monthComms.length) * 100 : 0 });
          }
        } else if (trendPeriod === 'quarter') {
          for (let i = sparklinePoints - 1; i >= 0; i--) {
            const quarterStart = startOfQuarter(subQuarters(now, i));
            const quarterEnd = endOfQuarter(subQuarters(now, i));
            const quarterComms = allComms.filter(c => {
              const d = new Date(c.communication_date);
              return d >= quarterStart && d <= quarterEnd;
            });
            closedDealsData.push({ value: quarterComms.filter(c => c.deal_completed && c.status === 'Closed').length });
            qualifiedLeadsData.push({ value: quarterComms.filter(c => ['High', 'Medium', 'Low'].includes(c.interest_level) || c.quotation_required).length });
            conversionRateData.push({ value: quarterComms.length > 0 ? (quarterComms.filter(c => c.deal_completed && c.status === 'Closed').length / quarterComms.length) * 100 : 0 });
          }
        }

        return {
          closedDeals: closedDealsData,
          qualifiedLeads: qualifiedLeadsData,
          conversionRate: conversionRateData
        };
      };

      setPeriodComparison({
        currentPeriod: calcMetrics(currentPeriodComms),
        previousPeriod: calcMetrics(prevPeriodComms),
        periodLabel,
        prevPeriodLabel,
        sparklines: generateSparklineData()
      });

      // Calculate bottleneck - stage with longest average time
      // Using deal_duration_days for closed deals, and days since creation for open ones
      const stageTimings: { [key: string]: number[] } = {
        'Qualification': [],
        'Proposal': [],
        'Negotiation': [],
        'Closing': []
      };

      allComms.forEach(comm => {
        if (comm.current_phase && comm.communication_date) {
          const daysSinceCreation = Math.floor(
            (new Date().getTime() - new Date(comm.communication_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          
          if (comm.current_phase === 'Qualification' || comm.current_phase === 'Initial Contact') {
            stageTimings['Qualification'].push(daysSinceCreation);
          } else if (comm.current_phase === 'Proposal' || comm.current_phase === 'Quote Sent') {
            stageTimings['Proposal'].push(daysSinceCreation);
          } else if (comm.current_phase === 'Negotiation' || comm.current_phase === 'In Progress') {
            stageTimings['Negotiation'].push(daysSinceCreation);
          } else if (comm.current_phase === 'Closing' || comm.current_phase === 'Final Review') {
            stageTimings['Closing'].push(daysSinceCreation);
          }
        }
      });

      let maxAvg = 0;
      let bottleneckStage = '';

      Object.entries(stageTimings).forEach(([stage, times]) => {
        if (times.length > 0) {
          const avg = times.reduce((a, b) => a + b, 0) / times.length;
          if (avg > maxAvg) {
            maxAvg = avg;
            bottleneckStage = stage;
          }
        }
      });

      if (bottleneckStage) {
        setBottleneck({
          stageName: bottleneckStage,
          avgDays: Math.round(maxAvg)
        });
      }

    } catch (error) {
      console.error('Error fetching pipeline data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStageClick = (filterValue: string) => {
    navigate(`/pipeline?stage=${filterValue}`);
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pipeline Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-16 skeleton-shimmer rounded-lg" />
            <div className="h-32 skeleton-shimmer rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Pipeline Overview</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs text-primary"
            onClick={() => navigate('/pipeline')}
          >
            View Pipeline
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pipeline Stages - Horizontal Flow with Conversion Indicators */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {stages.map((stage, index) => {
            // Calculate conversion rate from previous stage to current stage
            const prevStage = index > 0 ? stages[index - 1] : null;
            const stageConversionRate = prevStage && prevStage.count > 0 
              ? (stage.count / prevStage.count) * 100
              : null;
            
            // Color coding based on thresholds: green >= 50%, yellow 25-49%, red < 25%
            const getConversionColor = (rate: number) => {
              if (rate >= 50) return { bg: 'bg-green-500/15', text: 'text-green-600', arrow: 'text-green-500' };
              if (rate >= 25) return { bg: 'bg-amber-500/15', text: 'text-amber-600', arrow: 'text-amber-500' };
              return { bg: 'bg-red-500/15', text: 'text-red-600', arrow: 'text-red-500' };
            };
            
            const colors = stageConversionRate !== null ? getConversionColor(stageConversionRate) : null;
            
            return (
              <div key={stage.id} className="flex items-center">
                {/* Conversion rate indicator between stages */}
                {index > 0 && stageConversionRate !== null && colors && (
                  <div className="flex flex-col items-center mx-1 flex-shrink-0">
                    <ArrowRight className={`h-4 w-4 ${colors.arrow}`} />
                    <span className={`text-[10px] font-semibold ${colors.text} ${colors.bg} px-1.5 py-0.5 rounded-full whitespace-nowrap`}>
                      {stageConversionRate.toFixed(0)}%
                    </span>
                  </div>
                )}
                <button
                  onClick={() => handleStageClick(stage.filterValue)}
                  className="flex flex-col items-center p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-all duration-200 hover:scale-105 min-w-[80px] group"
                >
                  <stage.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mb-1" />
                  <span className="text-xl font-bold text-primary">{stage.count}</span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight whitespace-nowrap">
                    {stage.name}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Period Comparison */}
        {periodComparison && showComparison && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground">
                {periodComparison.periodLabel} vs {periodComparison.prevPeriodLabel}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-muted-foreground"
                onClick={() => setShowComparison(false)}
              >
                Hide
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {/* Closed Deals */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-lg font-bold text-foreground">
                    {periodComparison.currentPeriod.closedDeals}
                  </span>
                  {(() => {
                    const diff = periodComparison.currentPeriod.closedDeals - periodComparison.previousPeriod.closedDeals;
                    const pct = periodComparison.previousPeriod.closedDeals > 0 
                      ? ((diff / periodComparison.previousPeriod.closedDeals) * 100).toFixed(0)
                      : diff > 0 ? '+∞' : '0';
                    if (diff > 0) return (
                      <span className="flex items-center text-[10px] text-green-600">
                        <ArrowUpRight className="h-3 w-3" />
                        {pct}%
                      </span>
                    );
                    if (diff < 0) return (
                      <span className="flex items-center text-[10px] text-red-500">
                        <ArrowDownRight className="h-3 w-3" />
                        {Math.abs(Number(pct))}%
                      </span>
                    );
                    return <Minus className="h-3 w-3 text-muted-foreground" />;
                  })()}
                </div>
                <span className="text-[10px] text-muted-foreground">Closed Deals</span>
                {/* Sparkline */}
                <div className="h-8 w-full mt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={periodComparison.sparklines.closedDeals}>
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-popover border border-border rounded px-2 py-1 shadow-md">
                                <span className="text-[10px] font-medium">{payload[0].value}</span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={periodComparison.currentPeriod.closedDeals >= periodComparison.previousPeriod.closedDeals ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)'}
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 3, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-[9px] text-muted-foreground/60">
                  prev: {periodComparison.previousPeriod.closedDeals}
                </div>
              </div>

              {/* Qualified Leads */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-lg font-bold text-foreground">
                    {periodComparison.currentPeriod.qualifiedLeads}
                  </span>
                  {(() => {
                    const diff = periodComparison.currentPeriod.qualifiedLeads - periodComparison.previousPeriod.qualifiedLeads;
                    const pct = periodComparison.previousPeriod.qualifiedLeads > 0 
                      ? ((diff / periodComparison.previousPeriod.qualifiedLeads) * 100).toFixed(0)
                      : diff > 0 ? '+∞' : '0';
                    if (diff > 0) return (
                      <span className="flex items-center text-[10px] text-green-600">
                        <ArrowUpRight className="h-3 w-3" />
                        {pct}%
                      </span>
                    );
                    if (diff < 0) return (
                      <span className="flex items-center text-[10px] text-red-500">
                        <ArrowDownRight className="h-3 w-3" />
                        {Math.abs(Number(pct))}%
                      </span>
                    );
                    return <Minus className="h-3 w-3 text-muted-foreground" />;
                  })()}
                </div>
                <span className="text-[10px] text-muted-foreground">Qualified</span>
                {/* Sparkline */}
                <div className="h-8 w-full mt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={periodComparison.sparklines.qualifiedLeads}>
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-popover border border-border rounded px-2 py-1 shadow-md">
                                <span className="text-[10px] font-medium">{payload[0].value}</span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={periodComparison.currentPeriod.qualifiedLeads >= periodComparison.previousPeriod.qualifiedLeads ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)'}
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 3, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-[9px] text-muted-foreground/60">
                  prev: {periodComparison.previousPeriod.qualifiedLeads}
                </div>
              </div>

              {/* Conversion Rate */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-lg font-bold text-foreground">
                    {periodComparison.currentPeriod.conversionRate.toFixed(0)}%
                  </span>
                  {(() => {
                    const diff = periodComparison.currentPeriod.conversionRate - periodComparison.previousPeriod.conversionRate;
                    if (diff > 0) return (
                      <span className="flex items-center text-[10px] text-green-600">
                        <ArrowUpRight className="h-3 w-3" />
                        {diff.toFixed(0)}pp
                      </span>
                    );
                    if (diff < 0) return (
                      <span className="flex items-center text-[10px] text-red-500">
                        <ArrowDownRight className="h-3 w-3" />
                        {Math.abs(diff).toFixed(0)}pp
                      </span>
                    );
                    return <Minus className="h-3 w-3 text-muted-foreground" />;
                  })()}
                </div>
                <span className="text-[10px] text-muted-foreground">Conv. Rate</span>
                {/* Sparkline */}
                <div className="h-8 w-full mt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={periodComparison.sparklines.conversionRate}>
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-popover border border-border rounded px-2 py-1 shadow-md">
                                <span className="text-[10px] font-medium">{Number(payload[0].value).toFixed(1)}%</span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={periodComparison.currentPeriod.conversionRate >= periodComparison.previousPeriod.conversionRate ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)'}
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 3, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-[9px] text-muted-foreground/60">
                  prev: {periodComparison.previousPeriod.conversionRate.toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Show Comparison Button (when hidden) */}
        {!showComparison && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-[10px] text-muted-foreground"
            onClick={() => setShowComparison(true)}
          >
            Show Period Comparison
          </Button>
        )}

        {/* Trend Chart */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Deal Progression</span>
            <div className="flex items-center gap-1">
              <Button
                variant={trendPeriod === 'week' ? 'default' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => setTrendPeriod('week')}
              >
                Week
              </Button>
              <Button
                variant={trendPeriod === 'month' ? 'default' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => setTrendPeriod('month')}
              >
                Month
              </Button>
              <Button
                variant={trendPeriod === 'quarter' ? 'default' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => setTrendPeriod('quarter')}
              >
                Quarter
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={trendPeriod === 'custom' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-6 px-2 text-[10px] gap-1"
                    onClick={() => setTrendPeriod('custom')}
                  >
                    <CalendarDays className="h-3 w-3" />
                    {trendPeriod === 'custom' && dateRange.from && dateRange.to
                      ? `${format(dateRange.from, 'd MMM')} - ${format(dateRange.to, 'd MMM')}`
                      : 'Range'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      setDateRange({ from: range?.from, to: range?.to });
                      if (range?.from && range?.to) {
                        setTrendPeriod('custom');
                      }
                    }}
                    numberOfMonths={2}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="h-[100px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="closedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--status-open))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--status-open))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="lostGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--status-closed))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--status-closed))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '11px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="closedDeals" 
                  stroke="hsl(var(--status-open))" 
                  fill="url(#closedGradient)"
                  strokeWidth={2}
                  name="Closed"
                />
                <Area 
                  type="monotone" 
                  dataKey="lostDeals" 
                  stroke="hsl(var(--status-closed))" 
                  fill="url(#lostGradient)"
                  strokeWidth={2}
                  name="Lost"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottleneck Indicator */}
        {bottleneck && bottleneck.avgDays > 0 && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Bottleneck: {bottleneck.stageName}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Avg. {bottleneck.avgDays} days in this stage
              </p>
            </div>
            <Clock className="h-3 w-3 text-amber-500/60" />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PipelineOverview;
