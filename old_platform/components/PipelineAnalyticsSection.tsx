import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, BarChart3 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import PieChartDrillDownDialog from '@/components/PieChartDrillDownDialog';
import ConversionFunnelChart from '@/components/ConversionFunnelChart';
import FunnelDrillDownDialog from '@/components/FunnelDrillDownDialog';
import KPIComparisonDialog from '@/components/KPIComparisonDialog';
import AdvancedFilters, { AdvancedFiltersState } from '@/components/AdvancedFilters';
import StageMetricsCard from '@/components/StageMetricsCard';
import DropOffAnalysis from '@/components/DropOffAnalysis';
import PipelineAlerts from '@/components/PipelineAlerts';
import { ChartSkeleton } from '@/components/ui/chart-skeleton';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, eachQuarterOfInterval, eachYearOfInterval, getWeek, getQuarter, getYear, differenceInDays } from 'date-fns';

interface OutreachData {
  label: string;
  totalOutreach: number;
  quotationRequested: number;
}

interface CategoryData {
  name: string;
  value: number;
}

interface FunnelStage {
  name: string;
  count: number;
  percentage: number;
  dropOff: number;
}

interface ChannelConversionData {
  channel: string;
  totalLeads: number;
  quotations: number;
  closedDeals: number;
  conversionRate: number;
}

interface StageMetric {
  name: string;
  count: number;
  conversionRate: number;
  avgDays: number;
  dropOffCount: number;
  dropOffReasons: { reason: string; count: number }[];
}

interface DropOffReason {
  reason: string;
  count: number;
  percentage: number;
}

interface AnalyticsData {
  outreachByTime: OutreachData[];
  categoryDistribution: CategoryData[];
  projectPhaseDistribution: CategoryData[];
  projectSizeDistribution: CategoryData[];
  projectTypeDistribution: CategoryData[];
  funnelStages: FunnelStage[];
  channelConversions: ChannelConversionData[];
  stageMetrics: StageMetric[];
  dropOffReasons: DropOffReason[];
  totalDropOffs: number;
}

const COLORS = [
  'hsl(20, 100%, 48%)',
  'hsl(171, 40%, 17%)',
  'hsl(20, 90%, 58%)',
  'hsl(171, 35%, 30%)',
  'hsl(25, 95%, 55%)',
  'hsl(171, 50%, 35%)',
  'hsl(171, 40%, 22%)',
  'hsl(15, 90%, 50%)',
  'hsl(30, 85%, 55%)',
  'hsl(171, 30%, 45%)',
];

interface DrillDownState {
  open: boolean;
  filterField: 'category' | 'current_phase' | 'project_size' | 'project_type';
  filterValue: string;
  filterLabel: string;
}

const PipelineAnalyticsSection = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    outreachByTime: [],
    categoryDistribution: [],
    projectPhaseDistribution: [],
    projectSizeDistribution: [],
    projectTypeDistribution: [],
    funnelStages: [],
    channelConversions: [],
    stageMetrics: [],
    dropOffReasons: [],
    totalDropOffs: 0,
  });
  const [loading, setLoading] = useState(false);
  const [timePeriod, setTimePeriod] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [filters, setFilters] = useState<AdvancedFiltersState>({
    dateFrom: startOfMonth(new Date()),
    dateTo: endOfMonth(new Date()),
    city: '',
    category: '',
    salesperson: '',
    interestLevel: '',
    status: '',
  });
  const [drillDown, setDrillDown] = useState<DrillDownState>({
    open: false,
    filterField: 'category',
    filterValue: '',
    filterLabel: '',
  });
  const [funnelDrillDown, setFunnelDrillDown] = useState<{ open: boolean; stageName: string }>({
    open: false,
    stageName: '',
  });
  const [kpiComparisonOpen, setKpiComparisonOpen] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const handlePieClick = (
    field: 'category' | 'current_phase' | 'project_size' | 'project_type',
    data: { name: string; value: number }
  ) => {
    setDrillDown({
      open: true,
      filterField: field,
      filterValue: data.name,
      filterLabel: data.name,
    });
  };

  useEffect(() => {
    if (isOpen && !hasFetched) {
      fetchAnalytics();
      setHasFetched(true);
    }
  }, [isOpen]);

  useEffect(() => {
    if (hasFetched) {
      fetchAnalytics();
    }
  }, [timePeriod, filters]);

  const fetchAnalytics = async () => {
    if (!filters.dateFrom || !filters.dateTo) return;

    try {
      setLoading(true);

      let query = supabase
        .from('communication_log')
        .select('id, communication_date, category, quotation_required, quotation_sent, current_phase, project_size, project_type, deal_completed, communication_channels, city, assigned_to, interest_level, status, objection_type, created_at, deal_closed_at')
        .gte('communication_date', filters.dateFrom.toISOString())
        .lte('communication_date', filters.dateTo.toISOString());

      if (filters.city) query = query.eq('city', filters.city);
      if (filters.category) query = query.eq('category', filters.category);
      if (filters.salesperson) query = query.eq('assigned_to', filters.salesperson);
      if (filters.interestLevel) query = query.eq('interest_level', filters.interestLevel);
      if (filters.status) query = query.eq('status', filters.status as 'Open' | 'Closed' | 'In Follow-up');

      const { data: communications, error } = await query;
      if (error) throw error;

      let pipelineQuery = supabase
        .from('communication_log')
        .select('current_phase, project_size, project_type')
        .or('interest_level.in.(High,Medium,Low),quotation_required.eq.true')
        .gte('communication_date', filters.dateFrom.toISOString())
        .lte('communication_date', filters.dateTo.toISOString());

      if (filters.city) pipelineQuery = pipelineQuery.eq('city', filters.city);
      if (filters.category) pipelineQuery = pipelineQuery.eq('category', filters.category);
      if (filters.salesperson) pipelineQuery = pipelineQuery.eq('assigned_to', filters.salesperson);
      if (filters.interestLevel) pipelineQuery = pipelineQuery.eq('interest_level', filters.interestLevel);
      if (filters.status) pipelineQuery = pipelineQuery.eq('status', filters.status as 'Open' | 'Closed' | 'In Follow-up');

      const { data: pipelineRecords, error: pipelineError } = await pipelineQuery;
      if (pipelineError) throw pipelineError;

      const comms = communications || [];
      const pipelineData = pipelineRecords || [];

      const outreachByTime = processOutreachByTime(comms, filters.dateFrom, filters.dateTo, timePeriod);
      const categoryDistribution = processDistribution(comms, 'category');
      const projectPhaseDistribution = processDistribution(pipelineData, 'current_phase');
      const projectSizeDistribution = processDistribution(pipelineData, 'project_size');
      const projectTypeDistribution = processDistribution(pipelineData, 'project_type');
      const funnelStages = processFunnelStages(comms);
      const channelConversions = processChannelConversions(comms);
      const stageMetrics = processStageMetrics(comms);
      const { dropOffReasons, totalDropOffs } = processDropOffReasons(comms);

      setAnalyticsData({
        outreachByTime,
        categoryDistribution,
        projectPhaseDistribution,
        projectSizeDistribution,
        projectTypeDistribution,
        funnelStages,
        channelConversions,
        stageMetrics,
        dropOffReasons,
        totalDropOffs,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const processOutreachByTime = (
    comms: any[],
    startDate: Date,
    endDate: Date,
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  ): OutreachData[] => {
    const buckets: Map<string, { total: number; quotations: number }> = new Map();
    let intervals: Date[];
    let getLabel: (date: Date) => string;
    let getBucketKey: (date: Date) => string;

    switch (period) {
      case 'daily':
        intervals = eachDayOfInterval({ start: startDate, end: endDate });
        getLabel = (d) => format(d, 'MMM dd');
        getBucketKey = (d) => format(d, 'yyyy-MM-dd');
        break;
      case 'weekly':
        intervals = eachWeekOfInterval({ start: startDate, end: endDate });
        getLabel = (d) => `Week ${getWeek(d)}`;
        getBucketKey = (d) => `${getYear(d)}-W${getWeek(d)}`;
        break;
      case 'monthly':
        intervals = eachMonthOfInterval({ start: startDate, end: endDate });
        getLabel = (d) => format(d, 'MMM yyyy');
        getBucketKey = (d) => format(d, 'yyyy-MM');
        break;
      case 'quarterly':
        intervals = eachQuarterOfInterval({ start: startDate, end: endDate });
        getLabel = (d) => `Q${getQuarter(d)} ${getYear(d)}`;
        getBucketKey = (d) => `${getYear(d)}-Q${getQuarter(d)}`;
        break;
      case 'yearly':
        intervals = eachYearOfInterval({ start: startDate, end: endDate });
        getLabel = (d) => format(d, 'yyyy');
        getBucketKey = (d) => format(d, 'yyyy');
        break;
    }

    intervals.forEach((d) => buckets.set(getBucketKey(d), { total: 0, quotations: 0 }));

    comms.forEach((comm) => {
      if (!comm.communication_date) return;
      const commDate = new Date(comm.communication_date);
      const key = getBucketKey(commDate);
      if (buckets.has(key)) {
        const bucket = buckets.get(key)!;
        bucket.total++;
        if (comm.quotation_required) bucket.quotations++;
      }
    });

    return intervals.map((d) => {
      const key = getBucketKey(d);
      const bucket = buckets.get(key) || { total: 0, quotations: 0 };
      return { label: getLabel(d), totalOutreach: bucket.total, quotationRequested: bucket.quotations };
    });
  };

  const processDistribution = (comms: any[], field: string): CategoryData[] => {
    const counts: Map<string, number> = new Map();
    comms.forEach((comm) => {
      const value = comm[field] || 'Unknown';
      counts.set(value, (counts.get(value) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const processFunnelStages = (comms: any[]): FunnelStage[] => {
    const total = comms.length;
    const rawOutreach = total;
    const qualifiedLeads = comms.filter(c => ['High', 'Medium', 'Low'].includes(c.interest_level) && !c.quotation_sent && !c.deal_completed).length;
    const proposalsSent = comms.filter(c => c.quotation_sent && !c.deal_completed).length;
    const closedDeal = comms.filter(c => c.deal_completed).length;
    const totalPipeline = qualifiedLeads + proposalsSent + closedDeal;

    return [
      { name: 'Raw Outreach', count: rawOutreach, percentage: 100, dropOff: rawOutreach - totalPipeline },
      { name: 'Qualified Leads', count: qualifiedLeads, percentage: total > 0 ? (qualifiedLeads / total) * 100 : 0, dropOff: 0 },
      { name: 'Proposals Sent', count: proposalsSent, percentage: total > 0 ? (proposalsSent / total) * 100 : 0, dropOff: 0 },
      { name: 'Closed Deals', count: closedDeal, percentage: total > 0 ? (closedDeal / total) * 100 : 0, dropOff: 0 },
    ];
  };

  const processChannelConversions = (comms: any[]): ChannelConversionData[] => {
    const channelMap = new Map<string, { total: number; quotations: number; closed: number }>();
    comms.forEach((comm) => {
      const channel = comm.communication_channels || 'Unknown';
      if (!channelMap.has(channel)) channelMap.set(channel, { total: 0, quotations: 0, closed: 0 });
      const data = channelMap.get(channel)!;
      data.total++;
      if (comm.quotation_required) data.quotations++;
      if (comm.deal_completed) data.closed++;
    });
    return Array.from(channelMap.entries())
      .map(([channel, data]) => ({
        channel,
        totalLeads: data.total,
        quotations: data.quotations,
        closedDeals: data.closed,
        conversionRate: data.total > 0 ? (data.closed / data.total) * 100 : 0,
      }))
      .sort((a, b) => b.totalLeads - a.totalLeads);
  };

  const processStageMetrics = (comms: any[]): StageMetric[] => {
    const stages = ['Raw Outreach', 'Qualified Leads', 'Proposals Sent', 'Closed Deals'];
    const now = new Date();

    const getStageComms = (stageName: string) => {
      switch (stageName) {
        case 'Raw Outreach': return comms;
        case 'Qualified Leads': return comms.filter(c => ['High', 'Medium', 'Low'].includes(c.interest_level) && !c.quotation_sent && !c.deal_completed);
        case 'Proposals Sent': return comms.filter(c => c.quotation_sent && !c.deal_completed);
        case 'Closed Deals': return comms.filter(c => c.deal_completed);
        default: return [];
      }
    };

    const qualifiedCount = getStageComms('Qualified Leads').length;
    const proposalsCount = getStageComms('Proposals Sent').length;
    const closedCount = getStageComms('Closed Deals').length;
    const totalPipeline = qualifiedCount + proposalsCount + closedCount;

    return stages.map((stageName) => {
      const stageComms = getStageComms(stageName);
      const count = stageComms.length;
      let conversionRate = 0;
      let dropOffCount = 0;

      if (stageName === 'Raw Outreach') {
        conversionRate = count > 0 ? (totalPipeline / count) * 100 : 0;
        dropOffCount = count - totalPipeline;
      } else if (stageName === 'Qualified Leads') {
        conversionRate = qualifiedCount > 0 ? (proposalsCount / (qualifiedCount + proposalsCount)) * 100 : 0;
      } else if (stageName === 'Proposals Sent') {
        conversionRate = proposalsCount > 0 ? (closedCount / proposalsCount) * 100 : 0;
        dropOffCount = proposalsCount - closedCount;
      } else {
        conversionRate = 100;
      }

      let avgDays = 0;
      if (stageName === 'Closed Deals') {
        const durations = stageComms
          .filter(c => c.created_at && c.deal_closed_at)
          .map(c => differenceInDays(new Date(c.deal_closed_at), new Date(c.created_at)));
        avgDays = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
      } else {
        const durations = stageComms
          .filter(c => c.communication_date)
          .map(c => differenceInDays(now, new Date(c.communication_date)));
        avgDays = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
      }

      const dropOffReasons: { reason: string; count: number }[] = [];
      if (stageName === 'Raw Outreach') {
        const notInPipeline = stageComms.filter(c => !['High', 'Medium', 'Low'].includes(c.interest_level) && !c.quotation_sent && !c.deal_completed);
        const reasonCounts = new Map<string, number>();
        notInPipeline.forEach(c => {
          const reason = c.objection_type || c.interest_level === 'Not interested' ? 'Not interested' : 'No Response';
          reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
        });
        reasonCounts.forEach((cnt, reason) => dropOffReasons.push({ reason, count: cnt }));
        dropOffReasons.sort((a, b) => b.count - a.count);
      }

      return { name: stageName, count, conversionRate, avgDays: Math.max(0, avgDays), dropOffCount, dropOffReasons: dropOffReasons.slice(0, 3) };
    });
  };

  const processDropOffReasons = (comms: any[]): { dropOffReasons: DropOffReason[]; totalDropOffs: number } => {
    const notConverted = comms.filter(c => !c.deal_completed);
    const totalDropOffs = notConverted.length;
    const reasonCounts = new Map<string, number>();
    notConverted.forEach(c => {
      let reason = 'Unknown';
      if (c.objection_type) reason = c.objection_type;
      else if (c.interest_level === 'Not interested') reason = 'Not interested';
      else if (!c.quotation_required) reason = 'No Response';
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    });
    const dropOffReasons = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count, percentage: totalDropOffs > 0 ? (count / totalDropOffs) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);
    return { dropOffReasons, totalDropOffs };
  };

  const handleTimePeriodChange = (period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly') => {
    setTimePeriod(period);
    const now = new Date();
    let newDateFrom: Date;
    let newDateTo: Date;

    switch (period) {
      case 'daily':
        newDateFrom = startOfWeek(now);
        newDateTo = endOfWeek(now);
        break;
      case 'weekly':
        newDateFrom = startOfMonth(now);
        newDateTo = endOfMonth(now);
        break;
      case 'monthly':
        newDateFrom = startOfYear(now);
        newDateTo = endOfYear(now);
        break;
      case 'quarterly':
        newDateFrom = startOfYear(now);
        newDateTo = endOfYear(now);
        break;
      case 'yearly':
        newDateFrom = new Date(now.getFullYear() - 4, 0, 1);
        newDateTo = endOfYear(now);
        break;
    }
    setFilters(prev => ({ ...prev, dateFrom: newDateFrom, dateTo: newDateTo }));
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="animate-card-enter">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">{t('analytics.title')}</CardTitle>
                  <CardDescription className="text-sm">{t('analytics.description')}</CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon">
                <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            {loading ? (
              <div className="space-y-6">
                <ChartSkeleton type="stat" height={120} />
                <ChartSkeleton type="funnel" height={300} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ChartSkeleton type="bar" />
                  <ChartSkeleton type="bar" />
                </div>
              </div>
            ) : (
              <>
                <PipelineAlerts />
                <AdvancedFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  timePeriod={timePeriod}
                  onTimePeriodChange={handleTimePeriodChange}
                />
                <StageMetricsCard 
                  stages={analyticsData.stageMetrics}
                  onStageClick={(stageName) => setFunnelDrillDown({ open: true, stageName })}
                />
                <DropOffAnalysis 
                  reasons={analyticsData.dropOffReasons}
                  totalDropOffs={analyticsData.totalDropOffs}
                />
                <ConversionFunnelChart 
                  stages={analyticsData.funnelStages} 
                  onStageClick={(stage) => setFunnelDrillDown({ open: true, stageName: stage.name })}
                  onCompareKPI={() => setKpiComparisonOpen(true)}
                />

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{t('analytics.outreachPerPeriod', { period: t(`analytics.${timePeriod}`) })}</CardTitle>
                      <CardDescription className="text-xs">{t('analytics.outreachDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={analyticsData.outreachByTime} barGap={4}>
                          <defs>
                            <linearGradient id="greenGradientSection" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(171, 40%, 25%)" />
                              <stop offset="100%" stopColor="hsl(171, 40%, 17%)" />
                            </linearGradient>
                            <linearGradient id="orangeGradientSection" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(20, 100%, 52%)" />
                              <stop offset="100%" stopColor="hsl(20, 100%, 45%)" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" vertical={false} />
                          <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                          <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          <Bar dataKey="totalOutreach" fill="url(#greenGradientSection)" name={t('analytics.totalOutreach')} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="quotationRequested" fill="url(#orangeGradientSection)" name={t('analytics.quotationRequested')} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{t('analytics.leadSourcePerformance')}</CardTitle>
                      <CardDescription className="text-xs">{t('analytics.leadSourceDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={analyticsData.channelConversions.slice(0, 5)} layout="vertical" barGap={2}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" horizontal={false} />
                          <XAxis type="number" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                          <YAxis type="category" dataKey="channel" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} width={100} />
                          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          <Bar dataKey="totalLeads" fill="hsl(171, 40%, 22%)" name={t('analytics.totalLeads')} radius={[0, 4, 4, 0]} />
                          <Bar dataKey="closedDeals" fill="hsl(20, 100%, 48%)" name={t('analytics.closedDeals')} radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* Distribution Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{t('analytics.contactTypeDistribution')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={analyticsData.categoryDistribution.slice(0, 6)} cx="50%" cy="50%" outerRadius={70} innerRadius={25} dataKey="value" paddingAngle={2} onClick={(data) => handlePieClick('category', data)} style={{ cursor: 'pointer' }}>
                            {analyticsData.categoryDistribution.slice(0, 6).map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="white" strokeWidth={1} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{t('analytics.projectProgress')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={analyticsData.projectPhaseDistribution.slice(0, 6)} cx="50%" cy="50%" outerRadius={70} innerRadius={25} dataKey="value" paddingAngle={2} onClick={(data) => handlePieClick('current_phase', data)} style={{ cursor: 'pointer' }}>
                            {analyticsData.projectPhaseDistribution.slice(0, 6).map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="white" strokeWidth={1} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{t('analytics.projectSize')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={analyticsData.projectSizeDistribution.slice(0, 6)} cx="50%" cy="50%" outerRadius={70} innerRadius={25} dataKey="value" paddingAngle={2} onClick={(data) => handlePieClick('project_size', data)} style={{ cursor: 'pointer' }}>
                            {analyticsData.projectSizeDistribution.slice(0, 6).map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="white" strokeWidth={1} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{t('analytics.projectType')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={analyticsData.projectTypeDistribution.slice(0, 6)} cx="50%" cy="50%" outerRadius={70} innerRadius={25} dataKey="value" paddingAngle={2} onClick={(data) => handlePieClick('project_type', data)} style={{ cursor: 'pointer' }}>
                            {analyticsData.projectTypeDistribution.slice(0, 6).map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="white" strokeWidth={1} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <Card><CardContent className="pt-4 pb-3"><div className="text-2xl font-bold text-primary">{analyticsData.outreachByTime.reduce((sum, d) => sum + d.totalOutreach, 0)}</div><p className="text-xs text-muted-foreground">{t('analytics.totalOutreach')}</p></CardContent></Card>
                  <Card><CardContent className="pt-4 pb-3"><div className="text-2xl font-bold text-primary">{analyticsData.outreachByTime.reduce((sum, d) => sum + d.quotationRequested, 0)}</div><p className="text-xs text-muted-foreground">{t('analytics.quotationsRequested')}</p></CardContent></Card>
                  <Card className="bg-primary/5 border-primary/20"><CardContent className="pt-4 pb-3"><div className="text-2xl font-bold text-primary">{(() => { const total = analyticsData.outreachByTime.reduce((sum, d) => sum + d.totalOutreach, 0); const quotations = analyticsData.outreachByTime.reduce((sum, d) => sum + d.quotationRequested, 0); return total > 0 ? ((quotations / total) * 100).toFixed(1) : '0'; })()}%</div><p className="text-xs text-muted-foreground">{t('analytics.conversionRate')}</p></CardContent></Card>
                  <Card><CardContent className="pt-4 pb-3"><div className="text-2xl font-bold text-foreground">{analyticsData.funnelStages[3]?.count || 0}</div><p className="text-xs text-muted-foreground">Closed Deals</p></CardContent></Card>
                  <Card><CardContent className="pt-4 pb-3"><div className="text-2xl font-bold text-foreground">{analyticsData.stageMetrics.length > 0 ? Math.max(...analyticsData.stageMetrics.map(s => s.avgDays)).toFixed(0) : 0} days</div><p className="text-xs text-muted-foreground">Max Stage Time</p></CardContent></Card>
                  <Card><CardContent className="pt-4 pb-3"><div className="text-2xl font-bold text-destructive">{analyticsData.totalDropOffs}</div><p className="text-xs text-muted-foreground">Total Drop-offs</p></CardContent></Card>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>

      {/* Dialogs */}
      {filters.dateFrom && filters.dateTo && (
        <PieChartDrillDownDialog
          open={drillDown.open}
          onClose={() => setDrillDown({ ...drillDown, open: false })}
          filterField={drillDown.filterField}
          filterValue={drillDown.filterValue}
          filterLabel={drillDown.filterLabel}
          startDate={filters.dateFrom}
          endDate={filters.dateTo}
        />
      )}
      {filters.dateFrom && filters.dateTo && (
        <FunnelDrillDownDialog
          open={funnelDrillDown.open}
          onClose={() => setFunnelDrillDown({ ...funnelDrillDown, open: false })}
          stageName={funnelDrillDown.stageName}
          startDate={filters.dateFrom}
          endDate={filters.dateTo}
        />
      )}
      <KPIComparisonDialog
        open={kpiComparisonOpen}
        onOpenChange={setKpiComparisonOpen}
        periodType={timePeriod}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        funnelData={{
          rawOutreach: analyticsData.funnelStages[0]?.count || 0,
          quotationRequested: analyticsData.funnelStages[1]?.count || 0,
          inNegotiation: analyticsData.funnelStages[2]?.count || 0,
          closedDeals: analyticsData.funnelStages[3]?.count || 0,
        }}
      />
    </Collapsible>
  );
};

export default PipelineAnalyticsSection;
