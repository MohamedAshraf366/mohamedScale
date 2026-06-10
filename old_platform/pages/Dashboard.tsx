import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedCard } from '@/components/ui/animated-card';
import { Button } from '@/components/ui/button';
import { MessageSquare, History, CalendarDays, CalendarRange, ArrowUpRight, ArrowDownRight, Minus, GitCompare, AlertTriangle, ChevronLeft, ChevronRight, CheckCircle2, Clock, Users, TrendingUp, Target, FileText, XCircle, Briefcase, FolderKanban, Building2 } from 'lucide-react';
import PipelineOverview from '@/components/PipelineOverview';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, subWeeks, addDays, subDays, isSameDay } from 'date-fns';
import TeamLeaderboard from '@/components/TeamLeaderboard';
import ContactTimeline from '@/components/ContactTimeline';
import { ChartSkeleton } from '@/components/ui/chart-skeleton';
import TodayFollowUpsSummary from '@/components/TodayFollowUpsSummary';
import ScaleKPISection from '@/components/ScaleKPISection';
import PipelineAnalyticsSection from '@/components/PipelineAnalyticsSection';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTranslation } from 'react-i18next';

// Opportunity-based funnel stats
interface FunnelStats {
  rawOutreach: number;        // Total opportunities
  qualifiedLeads: number;     // Opportunities with interest (Low/Med/High) + Discovery stage
  proposalsSent: number;      // Opportunities with RFP stage
  wonDeals: number;           // Opportunities converted to deal OR closed won
  lostOpportunities: number;  // Opportunities closed lost
}

interface InterestLevelData {
  high: number;
  medium: number;
  low: number;
  notInterested: number;
  notSet: number;
}

interface TopClient {
  company_name: string;
  opportunity_count: number;
  total_deal_value: number;
}

interface OverdueFollowUp {
  id: string;
  follow_up_date: string;
  status_after: string | null;
  action: string | null;
  opportunity_id: string | null;
  company_name?: string;
  opportunity_name?: string;
}

interface SummaryOpportunity {
  id: string;
  name: string;
  stage: string | null;
  interest_level: string | null;
  created_at: string;
  client_name?: string;
  project_name?: string;
}

interface SummaryData {
  totalOpportunities: number;
  qualifiedLeads: number;
  followUpsCount: number;
  opportunities: SummaryOpportunity[];
}

interface ComparisonMetric {
  label: string;
  thisWeek: number;
  lastWeek: number;
  change: number;
  changePercent: number;
}

interface ComparisonData {
  metrics: ComparisonMetric[];
  thisWeekRange: string;
  lastWeekRange: string;
}

type SummaryView = 'daily' | 'weekly' | 'comparison' | null;

// Entity counts
interface EntityCounts {
  clients: number;
  projects: number;
  opportunities: number;
}

const Dashboard = () => {
  const { t } = useTranslation();
  const [funnelStats, setFunnelStats] = useState<FunnelStats>({
    rawOutreach: 0,
    qualifiedLeads: 0,
    proposalsSent: 0,
    wonDeals: 0,
    lostOpportunities: 0,
  });
  const [entityCounts, setEntityCounts] = useState<EntityCounts>({
    clients: 0,
    projects: 0,
    opportunities: 0,
  });
  const [loading, setLoading] = useState(true);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('');
  
  // Summary states
  const [summaryView, setSummaryView] = useState<SummaryView>(null);
  const [dailySummary, setDailySummary] = useState<SummaryData>({ totalOpportunities: 0, qualifiedLeads: 0, followUpsCount: 0, opportunities: [] });
  const [weeklySummary, setWeeklySummary] = useState<SummaryData>({ totalOpportunities: 0, qualifiedLeads: 0, followUpsCount: 0, opportunities: [] });
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [dailySummaryDate, setDailySummaryDate] = useState<Date>(new Date());
  
  // Overdue follow-ups state
  const [overdueFollowUps, setOverdueFollowUps] = useState<OverdueFollowUp[]>([]);
  
  // Interest level breakdown state (now from opportunities)
  const [interestLevels, setInterestLevels] = useState<InterestLevelData>({
    high: 0,
    medium: 0,
    low: 0,
    notInterested: 0,
    notSet: 0,
  });
  
  // Top clients state
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  
  // Daily summary date navigation limits (±3 days from today)
  const today = new Date();
  const minDate = subDays(today, 3);
  const maxDate = addDays(today, 3);
  const canGoPrev = dailySummaryDate > minDate && !isSameDay(dailySummaryDate, minDate);
  const canGoNext = dailySummaryDate < maxDate && !isSameDay(dailySummaryDate, maxDate);

  useEffect(() => {
    fetchDashboardData();
    fetchOverdueFollowUps();
    fetchInterestLevelData();
    fetchTopClients();
  }, []);

  useEffect(() => {
    if (summaryView === 'comparison') {
      fetchComparisonData();
    } else if (summaryView) {
      fetchSummaryData(summaryView);
    }
  }, [summaryView, dailySummaryDate]);

  const fetchComparisonData = async () => {
    setSummaryLoading(true);
    try {
      const now = new Date();
      
      // This week range
      const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
      const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
      
      // Last week range
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

      // Fetch this week opportunities
      const { data: thisWeekOpps } = await supabase
        .from('opportunities')
        .select('id, interest_level, stage, is_deal, won, is_closed')
        .gte('created_at', thisWeekStart.toISOString())
        .lte('created_at', thisWeekEnd.toISOString());

      // Fetch last week opportunities
      const { data: lastWeekOpps } = await supabase
        .from('opportunities')
        .select('id, interest_level, stage, is_deal, won, is_closed')
        .gte('created_at', lastWeekStart.toISOString())
        .lte('created_at', lastWeekEnd.toISOString());

      const thisWeek = thisWeekOpps || [];
      const lastWeek = lastWeekOpps || [];

      // Calculate metrics based on new funnel
      const thisWeekTotal = thisWeek.length; // Raw Outreach
      const lastWeekTotal = lastWeek.length;
      
      // Qualified Leads: interest_level is Low/Medium/High AND stage is Discovery
      const thisWeekQualified = thisWeek.filter(o => 
        ['High', 'Medium', 'Low'].includes(o.interest_level || '') && 
        o.stage === 'Discovery'
      ).length;
      const lastWeekQualified = lastWeek.filter(o => 
        ['High', 'Medium', 'Low'].includes(o.interest_level || '') && 
        o.stage === 'Discovery'
      ).length;
      
      // Won Deals: is_deal = true OR (is_closed = true AND won = true)
      const thisWeekWon = thisWeek.filter(o => o.is_deal === true || (o.is_closed === true && o.won === true)).length;
      const lastWeekWon = lastWeek.filter(o => o.is_deal === true || (o.is_closed === true && o.won === true)).length;

      const calcChange = (current: number, previous: number) => {
        const change = current - previous;
        const changePercent = previous === 0 ? (current > 0 ? 100 : 0) : ((change / previous) * 100);
        return { change, changePercent };
      };

      const metrics: ComparisonMetric[] = [
        {
          label: t('dashboard.rawOutreach'),
          thisWeek: thisWeekTotal,
          lastWeek: lastWeekTotal,
          ...calcChange(thisWeekTotal, lastWeekTotal),
        },
        {
          label: t('dashboard.qualifiedLeads'),
          thisWeek: thisWeekQualified,
          lastWeek: lastWeekQualified,
          ...calcChange(thisWeekQualified, lastWeekQualified),
        },
        {
          label: t('dashboard.wonDeals'),
          thisWeek: thisWeekWon,
          lastWeek: lastWeekWon,
          ...calcChange(thisWeekWon, lastWeekWon),
        },
      ];

      setComparisonData({
        metrics,
        thisWeekRange: `${format(thisWeekStart, 'MMM dd')} - ${format(thisWeekEnd, 'MMM dd')}`,
        lastWeekRange: `${format(lastWeekStart, 'MMM dd')} - ${format(lastWeekEnd, 'MMM dd')}`,
      });
    } catch (error) {
      console.error('Error fetching comparison data:', error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchSummaryData = async (view: SummaryView) => {
    if (!view) return;
    
    setSummaryLoading(true);
    try {
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      if (view === 'daily') {
        startDate = startOfDay(dailySummaryDate);
        endDate = endOfDay(dailySummaryDate);
      } else {
        startDate = startOfWeek(now, { weekStartsOn: 1 }); // Monday
        endDate = endOfWeek(now, { weekStartsOn: 1 }); // Sunday
      }

      // Fetch opportunities with client and project info
      const { data: opps, error } = await supabase
        .from('opportunities')
        .select(`
          id, 
          name, 
          stage, 
          interest_level, 
          created_at,
          clients:client_id (company_name),
          projects:project_id (name)
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const opportunities = (opps || []).map(o => ({
        id: o.id,
        name: o.name,
        stage: o.stage,
        interest_level: o.interest_level,
        created_at: o.created_at,
        client_name: (o.clients as any)?.company_name || 'Unknown',
        project_name: (o.projects as any)?.name || 'Unknown',
      }));

      // Qualified leads: interest level Low/Medium/High + Discovery stage
      const qualifiedLeads = opportunities.filter(o => 
        ['High', 'Medium', 'Low'].includes(o.interest_level || '') && 
        o.stage === 'Discovery'
      ).length;

      // Fetch follow-ups for the period
      const { data: followUps } = await supabase
        .from('follow_up_history')
        .select('id')
        .gte('follow_up_date', startDate.toISOString())
        .lte('follow_up_date', endDate.toISOString());

      const followUpsCount = followUps?.length || 0;

      const summaryData: SummaryData = {
        totalOpportunities: opportunities.length,
        qualifiedLeads,
        followUpsCount,
        opportunities,
      };

      if (view === 'daily') {
        setDailySummary(summaryData);
      } else {
        setWeeklySummary(summaryData);
      }
    } catch (error) {
      console.error('Error fetching summary data:', error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchOverdueFollowUps = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Fetch overdue follow-ups (past date + status Open)
      const { data: followUps, error } = await supabase
        .from('follow_up_history')
        .select('id, follow_up_date, status_after, action, opportunity_id')
        .eq('status_after', 'Open')
        .lt('follow_up_date', today.toISOString())
        .order('follow_up_date', { ascending: true });

      if (error) throw error;

      if (followUps && followUps.length > 0) {
        // Fetch opportunity and client names
        const oppIds = [...new Set(followUps.map(f => f.opportunity_id).filter(Boolean))];
        
        let clientMap: {[key: string]: { company_name: string; opportunity_name: string }} = {};
        
        if (oppIds.length > 0) {
          const { data: opps } = await supabase
            .from('opportunities')
            .select('id, name, clients:client_id (company_name)')
            .in('id', oppIds);
          
          opps?.forEach(o => {
            clientMap[o.id] = {
              company_name: (o.clients as any)?.company_name || 'Unknown',
              opportunity_name: o.name,
            };
          });
        }

        const enrichedFollowUps = followUps.map(f => ({
          ...f,
          company_name: f.opportunity_id ? clientMap[f.opportunity_id]?.company_name || 'Unknown' : 'Unknown',
          opportunity_name: f.opportunity_id ? clientMap[f.opportunity_id]?.opportunity_name || '' : '',
        }));

        setOverdueFollowUps(enrichedFollowUps);
      } else {
        setOverdueFollowUps([]);
      }
    } catch (error) {
      console.error('Error fetching overdue follow-ups:', error);
    }
  };

  const fetchInterestLevelData = async () => {
    try {
      // Get interest levels from opportunities table
      const { data: opps } = await supabase
        .from('opportunities')
        .select('interest_level');

      if (opps) {
        const counts = {
          high: opps.filter(o => o.interest_level === 'High').length,
          medium: opps.filter(o => o.interest_level === 'Medium').length,
          low: opps.filter(o => o.interest_level === 'Low').length,
          notInterested: opps.filter(o => o.interest_level === 'Not interested').length,
          notSet: opps.filter(o => !o.interest_level || o.interest_level === 'Not set').length,
        };
        setInterestLevels(counts);
      }
    } catch (error) {
      console.error('Error fetching interest level data:', error);
    }
  };

  const fetchTopClients = async () => {
    try {
      // Fetch opportunities with client info
      const { data: opps } = await supabase
        .from('opportunities')
        .select(`
          id,
          is_deal,
          expected_value,
          clients:client_id (company_name)
        `);

      if (opps) {
        // Group by client
        const clientMap = new Map<string, { count: number; totalValue: number }>();
        
        opps.forEach(opp => {
          const companyName = (opp.clients as any)?.company_name;
          if (companyName) {
            const existing = clientMap.get(companyName) || { count: 0, totalValue: 0 };
            clientMap.set(companyName, {
              count: existing.count + 1,
              totalValue: existing.totalValue + (opp.is_deal ? (opp.expected_value || 0) : 0),
            });
          }
        });

        // Convert to array and sort
        const clients: TopClient[] = Array.from(clientMap.entries())
          .map(([company_name, data]) => ({
            company_name,
            opportunity_count: data.count,
            total_deal_value: data.totalValue,
          }))
          .sort((a, b) => {
            if (b.total_deal_value !== a.total_deal_value) {
              return b.total_deal_value - a.total_deal_value;
            }
            return b.opportunity_count - a.opportunity_count;
          })
          .slice(0, 5);

        setTopClients(clients);
      }
    } catch (error) {
      console.error('Error fetching top clients:', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      // Fetch all data in parallel
      const [oppsResult, clientsResult, projectsResult] = await Promise.all([
        supabase.from('opportunities').select('id, interest_level, stage, is_deal, won, is_closed'),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
      ]);

      if (oppsResult.error) throw oppsResult.error;

      const opportunities = oppsResult.data || [];

      // Set entity counts
      setEntityCounts({
        clients: clientsResult.count || 0,
        projects: projectsResult.count || 0,
        opportunities: opportunities.length,
      });

      // Calculate funnel stats
      const rawOutreach = opportunities.length;
      
      // Qualified Leads: interest_level is Low/Medium/High AND stage is Discovery
      const qualifiedLeads = opportunities.filter(o => 
        ['High', 'Medium', 'Low'].includes(o.interest_level || '') && 
        o.stage === 'Discovery'
      ).length;
      
      // Proposals Sent: stage is RFP
      const proposalsSent = opportunities.filter(o => o.stage === 'RFP').length;
      
      // Won Deals: is_deal = true OR (is_closed = true AND won = true)
      const wonDeals = opportunities.filter(o => 
        o.is_deal === true || (o.is_closed === true && o.won === true)
      ).length;
      
      // Lost Opportunities: is_closed = true AND won = false
      const lostOpportunities = opportunities.filter(o => 
        o.is_closed === true && o.won === false
      ).length;

      setFunnelStats({
        rawOutreach,
        qualifiedLeads,
        proposalsSent,
        wonDeals,
        lostOpportunities,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: t('dashboard.rawOutreach'),
      value: funnelStats.rawOutreach,
      icon: MessageSquare,
      color: 'text-primary',
    },
    {
      title: t('dashboard.qualifiedLeads'),
      value: funnelStats.qualifiedLeads,
      icon: Target,
      color: 'text-chart-1',
    },
    {
      title: t('dashboard.proposalsSent'),
      value: funnelStats.proposalsSent,
      icon: FileText,
      color: 'text-status-quotation',
    },
    {
      title: t('dashboard.wonDeals'),
      value: funnelStats.wonDeals,
      icon: CheckCircle2,
      color: 'text-status-open',
    },
    {
      title: t('dashboard.lostOpportunities'),
      value: funnelStats.lostOpportunities,
      icon: XCircle,
      color: 'text-destructive',
    },
  ];

  const getStageColor = (stage: string | null) => {
    switch (stage) {
      case 'Discovery':
        return 'bg-chart-1/15 text-chart-1 border-chart-1/30';
      case 'RFP':
        return 'bg-status-quotation/15 text-status-quotation border-status-quotation/30';
      case 'Closed':
        return 'bg-status-closed/15 text-status-closed border-status-closed/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getInterestColor = (interest: string | null) => {
    switch (interest) {
      case 'High':
        return 'text-status-open';
      case 'Medium':
        return 'text-status-quotation';
      case 'Low':
        return 'text-chart-3';
      case 'Not interested':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  const currentSummary = summaryView === 'daily' ? dailySummary : weeklySummary;

  if (loading) {
    return (
      <Layout>
        <div className="p-8 space-y-8">
          <div className="animate-slide-up">
            <div className="h-10 w-48 skeleton-shimmer rounded-lg mb-2" />
            <div className="h-4 w-72 skeleton-shimmer rounded opacity-60" />
          </div>
          
          {/* Stats Cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {[...Array(5)].map((_, i) => (
              <ChartSkeleton key={i} type="stat" height={120} />
            ))}
          </div>
          
          {/* Pipeline and KPIs skeleton */}
          <ChartSkeleton type="bar" height={300} />
          <ChartSkeleton type="bar" height={280} />
          
          {/* Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartSkeleton type="pie" />
            <ChartSkeleton type="bar" height={340} />
          </div>
          
          {/* Team performance */}
          <ChartSkeleton type="bar" height={300} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8 space-y-8">
        <div className="animate-slide-up">
          <h1 className="text-4xl font-bold mb-2">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground">
            {t('dashboard.description')}
          </p>
        </div>

        {/* Entity Counts Index */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('dashboard.totalClients')}</p>
                <p className="text-2xl font-bold text-primary">{entityCounts.clients}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-chart-1/20 bg-chart-1/5">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-chart-1/10">
                <FolderKanban className="h-6 w-6 text-chart-1" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('dashboard.totalProjects')}</p>
                <p className="text-2xl font-bold text-chart-1">{entityCounts.projects}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-chart-2/20 bg-chart-2/5">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-chart-2/10">
                <Target className="h-6 w-6 text-chart-2" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('dashboard.totalOpportunities')}</p>
                <p className="text-2xl font-bold text-chart-2">{entityCounts.opportunities}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Toggle Tabs */}
        <div className="flex gap-3 flex-wrap">
          <Button
            variant={summaryView === 'daily' ? 'default' : 'outline'}
            onClick={() => setSummaryView(summaryView === 'daily' ? null : 'daily')}
            className="gap-2"
          >
            <CalendarDays className="h-4 w-4" />
            {t('dashboard.dailySummary')}
          </Button>
          <Button
            variant={summaryView === 'weekly' ? 'default' : 'outline'}
            onClick={() => setSummaryView(summaryView === 'weekly' ? null : 'weekly')}
            className="gap-2"
          >
            <CalendarRange className="h-4 w-4" />
            {t('dashboard.weeklySummary')}
          </Button>
          <Button
            variant={summaryView === 'comparison' ? 'default' : 'outline'}
            onClick={() => setSummaryView(summaryView === 'comparison' ? null : 'comparison')}
            className="gap-2"
          >
            <GitCompare className="h-4 w-4" />
            {t('dashboard.weekComparison')}
          </Button>
        </div>

        {/* Summary Section */}
        {summaryView && summaryView !== 'comparison' && (
          <Card className="animate-card-enter">
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
                {summaryView === 'daily' ? (
                  <>
                    <CalendarDays className="h-5 w-5 text-primary" />
                    <span>{t('dashboard.dailySummary')} — {format(dailySummaryDate, 'MMMM dd, yyyy')}</span>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDailySummaryDate(subDays(dailySummaryDate, 1))}
                        disabled={!canGoPrev}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setDailySummaryDate(new Date())}
                        disabled={isSameDay(dailySummaryDate, today)}
                      >
                        {t('dashboard.today')}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDailySummaryDate(addDays(dailySummaryDate, 1))}
                        disabled={!canGoNext}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <CalendarRange className="h-5 w-5 text-primary" />
                    {t('dashboard.weeklySummary')} — {format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM dd')} - {format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM dd, yyyy')}
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-24 skeleton-shimmer rounded-lg" />
                    <div className="h-24 skeleton-shimmer rounded-lg" />
                  </div>
                  <div className="h-64 skeleton-shimmer rounded-lg" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                      <p className="text-sm text-muted-foreground mb-1">
                        {summaryView === 'daily' ? t('dashboard.opportunitiesToday') : t('dashboard.opportunitiesThisWeek')}
                      </p>
                      <p className="text-3xl font-bold text-primary">{currentSummary.totalOpportunities}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                      <p className="text-sm text-muted-foreground mb-1">
                        {summaryView === 'daily' ? t('dashboard.qualifiedToday') : t('dashboard.qualifiedThisWeek')}
                      </p>
                      <p className="text-3xl font-bold text-primary">{currentSummary.qualifiedLeads}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                      <p className="text-sm text-muted-foreground mb-1">
                        {summaryView === 'daily' ? t('dashboard.followUpsToday') : t('dashboard.followUpsThisWeek')}
                      </p>
                      <p className="text-3xl font-bold text-primary">{currentSummary.followUpsCount}</p>
                    </div>
                  </div>

                  {/* Table */}
                  {currentSummary.opportunities.length > 0 ? (
                    <div className="rounded-lg border border-border/50 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead>{t('dashboard.opportunity')}</TableHead>
                            <TableHead>{t('dashboard.client')}</TableHead>
                            <TableHead>{t('dashboard.project')}</TableHead>
                            <TableHead>{t('dashboard.interest')}</TableHead>
                            <TableHead>{t('dashboard.stage')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentSummary.opportunities.map((opp) => (
                            <TableRow key={opp.id} className="hover:bg-muted/30 transition-colors">
                              <TableCell className="font-medium">{opp.name}</TableCell>
                              <TableCell>{opp.client_name || '—'}</TableCell>
                              <TableCell>{opp.project_name || '—'}</TableCell>
                              <TableCell>
                                <span className={`font-medium ${getInterestColor(opp.interest_level)}`}>
                                  {opp.interest_level || '—'}
                                </span>
                              </TableCell>
                              <TableCell>
                                {opp.stage ? (
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStageColor(opp.stage)}`}>
                                    {opp.stage}
                                  </span>
                                ) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      {summaryView === 'daily' ? t('dashboard.noOpportunitiesToday') : t('dashboard.noOpportunitiesThisWeek')}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Comparison Section */}
        {summaryView === 'comparison' && (
          <Card className="animate-card-enter">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5 text-primary" />
                {t('dashboard.weekOverWeekComparison')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="h-32 skeleton-shimmer rounded-lg" />
                    <div className="h-32 skeleton-shimmer rounded-lg" />
                    <div className="h-32 skeleton-shimmer rounded-lg" />
                  </div>
                </div>
              ) : comparisonData ? (
                <div className="space-y-6">
                  {/* Date Range Labels */}
                  <div className="flex justify-between text-sm text-muted-foreground border-b border-border/50 pb-4">
                    <span>{t('dashboard.lastWeek')}: <strong className="text-foreground">{comparisonData.lastWeekRange}</strong></span>
                    <span>{t('dashboard.thisWeek')}: <strong className="text-foreground">{comparisonData.thisWeekRange}</strong></span>
                  </div>

                  {/* Comparison Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {comparisonData.metrics.map((metric) => {
                      const isPositive = metric.change > 0;
                      const isNeutral = metric.change === 0;
                      
                      return (
                        <div 
                          key={metric.label}
                          className="p-5 rounded-xl bg-muted/50 border border-border/50 space-y-3"
                        >
                          <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                          
                          {/* Values comparison */}
                          <div className="flex items-end justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">{t('dashboard.lastWeek')}</p>
                              <p className="text-xl font-semibold text-muted-foreground">{metric.lastWeek}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground mb-1">{t('dashboard.thisWeek')}</p>
                              <p className="text-3xl font-bold text-primary">{metric.thisWeek}</p>
                            </div>
                          </div>
                          
                          {/* Change indicator */}
                          <div className={`flex items-center gap-1.5 pt-2 border-t border-border/30 ${
                            isNeutral ? 'text-muted-foreground' : isPositive ? 'text-status-open' : 'text-status-closed'
                          }`}>
                            {isNeutral ? (
                              <Minus className="h-4 w-4" />
                            ) : isPositive ? (
                              <ArrowUpRight className="h-4 w-4" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4" />
                            )}
                            <span className="text-sm font-medium">
                              {isNeutral ? t('dashboard.noChange') : `${isPositive ? '+' : ''}${metric.change} (${metric.changePercent.toFixed(0)}%)`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {t('dashboard.noComparisonData')}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Today's Follow-ups Summary - Show when Daily Summary is active */}
        {summaryView === 'daily' && isSameDay(dailySummaryDate, new Date()) && (
          <TodayFollowUpsSummary />
        )}

        {/* Stats Cards - Funnel metrics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {statCards.map((stat, index) => (
            <AnimatedCard key={stat.title} index={index + 1} animation="float-in">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{stat.value}</div>
              </CardContent>
            </AnimatedCard>
          ))}
        </div>

        {/* Overdue Follow-ups Widget */}
        {overdueFollowUps.length > 0 && (
          <AnimatedCard index={6} animation="card-enter" className="border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                {t('dashboard.overdueFollowUpsRequiringAttention')} ({overdueFollowUps.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {overdueFollowUps.slice(0, 10).map((followUp) => (
                  <div
                    key={followUp.id}
                    className="flex items-center justify-between p-3 bg-background/80 rounded-lg border border-destructive/20"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{followUp.company_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {followUp.opportunity_name || followUp.action || t('dashboard.noActionSpecified')}
                      </p>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <p className="text-xs font-medium text-destructive">
                        {format(new Date(followUp.follow_up_date), 'MMM dd, yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {Math.floor((new Date().getTime() - new Date(followUp.follow_up_date).getTime()) / (1000 * 60 * 60 * 24))} {t('dashboard.daysOverdue')}
                      </p>
                    </div>
                  </div>
                ))}
                {overdueFollowUps.length > 10 && (
                  <p className="text-xs text-center text-muted-foreground pt-2">
                    {t('dashboard.andMore', { count: overdueFollowUps.length - 10 })}
                  </p>
                )}
              </div>
            </CardContent>
          </AnimatedCard>
        )}


        {/* Pipeline Overview - Full Width */}
        <PipelineOverview className="animate-card-enter" />

        {/* 2-Column Grid Layout for Dashboard Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Interest Level Breakdown Pie Chart */}
          <AnimatedCard index={7} animation="card-enter" className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('dashboard.interestLevelBreakdown')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: t('dashboard.high'), value: interestLevels.high, color: 'hsl(var(--status-open))' },
                        { name: t('dashboard.medium'), value: interestLevels.medium, color: 'hsl(var(--status-quotation))' },
                        { name: t('dashboard.low'), value: interestLevels.low, color: 'hsl(var(--chart-3))' },
                        { name: t('dashboard.notInterested'), value: interestLevels.notInterested, color: 'hsl(var(--status-closed))' },
                        { name: t('dashboard.notSet'), value: interestLevels.notSet, color: 'hsl(var(--muted-foreground))' },
                      ].filter(item => item.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {[
                        { name: t('dashboard.high'), value: interestLevels.high, color: 'hsl(var(--status-open))' },
                        { name: t('dashboard.medium'), value: interestLevels.medium, color: 'hsl(var(--status-quotation))' },
                        { name: t('dashboard.low'), value: interestLevels.low, color: 'hsl(var(--chart-3))' },
                        { name: t('dashboard.notInterested'), value: interestLevels.notInterested, color: 'hsl(var(--status-closed))' },
                        { name: t('dashboard.notSet'), value: interestLevels.notSet, color: 'hsl(var(--muted-foreground))' },
                      ].filter(item => item.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [value, t('dashboard.opportunities')]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </AnimatedCard>

          {/* Top Clients Widget */}
          <AnimatedCard index={8} animation="card-enter" className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" />
                {t('dashboard.topClients')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topClients.length > 0 ? (
                <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-thin">
                  {topClients.map((client, index) => (
                    <div
                      key={client.company_name}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-lg hover:bg-muted/70 cursor-pointer transition-all duration-200"
                      onClick={() => {
                        setSelectedCompany(client.company_name);
                        setTimelineOpen(true);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px]">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-sm">{client.company_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {client.opportunity_count} {t('dashboard.opportunities')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {client.total_deal_value > 0 ? (
                          <div className="flex items-center gap-1 text-primary">
                            <TrendingUp className="h-3 w-3" />
                            <span className="font-bold text-xs">
                              {client.total_deal_value.toLocaleString()} SAR
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">{t('dashboard.noDeals')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4 text-sm">
                  {t('dashboard.noClientsYet')}
                </p>
              )}
            </CardContent>
          </AnimatedCard>
        </div>

        {/* Scale KPI Targets Section */}
        <ScaleKPISection />

        {/* Pipeline Analytics Section */}
        <PipelineAnalyticsSection />

        {/* Team Leaderboard */}
        <TeamLeaderboard startDate={new Date(new Date().getFullYear(), 0, 1)} />
      </div>

      {/* Contact Timeline Dialog */}
      <ContactTimeline 
        open={timelineOpen}
        onOpenChange={setTimelineOpen}
        companyName={selectedCompany}
      />
    </Layout>
  );
};

export default Dashboard;
