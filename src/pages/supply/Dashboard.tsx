import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { subDays, format } from 'date-fns';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Activity, Layers, CheckCircle2, AlertTriangle, Clock, RefreshCcw,
  ShieldAlert, Users, Package, MapPin, ExternalLink, Unlock,
  FileCheck, TrendingDown, Timer, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  HeroStat, InlineKpi, RowMetric, DeltaBadge, SectionCard,
} from '@/components/shared/DashboardKpiComponents';

type PeriodKey = 'week' | 'month' | 'year';

function getRange(period: PeriodKey) {
  const now = new Date();
  
  if (period === 'week') {
    // حساب بداية الأسبوع (السبت)
    const day = now.getDay(); // 0 = الأحد, 1 = الإثنين, ..., 6 = السبت
    // لو النهاردة السبت (6) يبقى الفرق 0، لو الأحد (0) يبقى الفرق 6، وهكذا
    const diff = (day === 6 ? 0 : day + 1);
    const start = new Date(now);
    start.setDate(now.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }
  
  const days = period === 'year' ? 365 : 30;
  return { start: subDays(now, days), end: now };
}

function getPrevRange(period: PeriodKey) {
  const now = new Date();
  const days = period === 'year' ? 365 : period === 'month' ? 30 : 7;
  return { start: subDays(now, days * 2), end: subDays(now, days) };
}

// ─── Order KPIs hook (معدل لاستخدام البيانات الموجودة) ───
function useOrderKpis(period: PeriodKey) {
  const range = getRange(period);
  const prevRange = getPrevRange(period);

  return useQuery({
    queryKey: ['supply-order-kpis', period],
    queryFn: async () => {
      // Get supplier quotes (orders placeholder)
      const { data: currentQuotes } = await supabase
        .from('supplier_quotes')
        .select('id, status, created_at, submitted_at')
        .gte('created_at', range.start.toISOString())
        .lte('created_at', range.end.toISOString());

      const { data: prevQuotes } = await supabase
        .from('supplier_quotes')
        .select('id, status, created_at') // ✅ بدون submitted_at
        .gte('created_at', prevRange.start.toISOString())
        .lte('created_at', prevRange.end.toISOString());

      const calc = (quotes: typeof currentQuotes | typeof prevQuotes, hasSubmittedAt: boolean = true) => {
        const list = quotes || [];
        const total = list.length;
        
        // استخدام الحالات الموجودة في supplier_quotes
        const approved = list.filter(q => q.status === 'approved').length;
        const submitted = list.filter(q => q.status === 'submitted').length;
        const underReview = list.filter(q => q.status === 'under_review').length;
        const negotiating = list.filter(q => q.status === 'negotiating').length;
        const rejected = list.filter(q => q.status === 'rejected').length;
        
        const successRate = total > 0 ? (approved / total) * 100 : 0;
        
        // حساب وقت الاستجابة فقط إذا كان submitted_at موجود
        let avgResponseHours: number | null = null;
        if (hasSubmittedAt) {
          const responseTimes = (list as any[])
            .filter(q => q.status === 'approved' && q.submitted_at)
            .map(q => {
              const submitted = new Date(q.submitted_at);
              const createdAt = new Date(q.created_at);
              return (createdAt.getTime() - submitted.getTime()) / (1000 * 60 * 60);
            });
          avgResponseHours = responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            : null;
        }

        return {
          total,
          approved,
          submitted,
          underReview,
          negotiating,
          rejected,
          successRate,
          avgResponseHours,
        };
      };

      return { 
        current: calc(currentQuotes, true), 
        previous: calc(prevQuotes, false)  
      };
    },
  });
}

// ─── Supply health summary hook (معدل) ───
function useSupplyHealthSummary() {
  return useQuery({
    queryKey: ['supply-health-summary'],
    queryFn: async () => {
      // Active cycles
      const { data: cycles } = await supabase
        .from('unlock_cycles')
        .select('id, status')
        .in('status', ['active', 'sourcing', 'planning']);
      const activeCycles = (cycles || []).length;

      // Total quotes
      const { data: allQuotes } = await supabase
        .from('supplier_quotes')
        .select('id, status');
      const totalQuotes = (allQuotes || []).length;
      
      // Approved quotes
      const approvedQuotes = (allQuotes || []).filter(q => q.status === 'approved').length;
      
      // Quotes needing attention (submitted > 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: staleQuotes } = await supabase
        .from('supplier_quotes')
        .select('id')
        .eq('status', 'submitted')
        .lt('created_at', sevenDaysAgo.toISOString());
      const staleCount = (staleQuotes || []).length;

      // Review flags (supply_domains with review_status = needs_review)
      const { data: reviewDomains } = await supabase
        .from('supply_domains')
        .select('id')
        .eq('review_status', 'needs_review')
        .eq('status', 'active');
      const reviewFlags = (reviewDomains || []).length;

      // Coverage % (domains with directives / total active domains)
      const { data: allDomains } = await supabase
        .from('supply_domains')
        .select('id')
        .eq('status', 'active');
      const totalDomains = (allDomains || []).length;

      const { data: directives } = await supabase
        .from('supply_domain_directives')
        .select('domain_id')
        .eq('is_active', true)
        .eq('role', 'selected');
      const coveredDomains = new Set((directives || []).map((d: any) => d.domain_id)).size;
      const coveragePct = totalDomains > 0 ? Math.round((coveredDomains / totalDomains) * 100) : 0;

      // Suppliers count
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('account_id');
      const totalSuppliers = (suppliers || []).length;

      return {
        activeCycles,
        totalQuotes,
        approvedQuotes,
        staleQuotes: staleCount,
        reviewFlags,
        coveragePct,
        totalSuppliers,
      };
    },
  });
}

// ─── Action items hook (معدل لاستخدام البيانات الموجودة) ───
interface ActionItem {
  id: string;
  type: 'expiring_quote' | 'review_flag' | 'stale_quote' | 'active_cycle';
  description: string;
  severity: 'high' | 'medium' | 'low';
  age: string;
  link: string;
}

function useActionItems() {
  return useQuery({
    queryKey: ['supply-action-items'],
    queryFn: async () => {
      const items: ActionItem[] = [];
      const now = new Date();

      // 1. Stale quotes (submitted for > 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: staleQuotes } = await supabase
        .from('supplier_quotes')
        .select('id, created_at, supplier_account_id')
        .eq('status', 'submitted')
        .lt('created_at', sevenDaysAgo.toISOString());

      (staleQuotes || []).forEach(quote => {
        const ageDays = Math.floor((now.getTime() - new Date(quote.created_at).getTime()) / (1000 * 60 * 60 * 24));
        items.push({
          id: `stale-${quote.id}`,
          type: 'stale_quote',
          description: `Quote ${quote.id.slice(0, 8)} pending review for ${ageDays} days`,
          severity: ageDays > 14 ? 'high' : 'medium',
          age: `${ageDays}d`,
          link: '/supplier-materials',
        });
      });

      // 2. Review flags on domains
      const { data: reviewDomains } = await supabase
        .from('supply_domains')
        .select('id, review_reason, updated_at')
        .eq('review_status', 'needs_review')
        .eq('status', 'active');

      (reviewDomains || []).forEach((d: any) => {
        const ageDays = Math.floor((now.getTime() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24));
        items.push({
          id: `review-${d.id}`,
          type: 'review_flag',
          description: d.review_reason || `Domain ${d.id.slice(0, 8)} needs review`,
          severity: 'medium',
          age: `${ageDays}d`,
          link: '/supply/coverage',
        });
      });

      // 3. Active cycles older than 14 days
      const { data: cycles } = await supabase
        .from('unlock_cycles')
        .select('id, name, status, created_at')
        .in('status', ['active', 'sourcing'])
        .order('created_at', { ascending: false });

      (cycles || []).forEach((c: any) => {
        const ageDays = Math.floor((now.getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24));
        if (ageDays > 14) {
          items.push({
            id: `cycle-${c.id}`,
            type: 'active_cycle',
            description: c.name || `Cycle ${c.id.slice(0, 8)} active for ${ageDays} days`,
            severity: ageDays > 30 ? 'high' : 'medium',
            age: `${ageDays}d`,
            link: `/supply/unlock/${c.id}`,
          });
        }
      });

      // Sort by severity then age
      const severityOrder = { high: 0, medium: 1, low: 2 };
      items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      return items.slice(0, 20);
    },
  });
}

const pct = (v: number) => `${v.toFixed(1)}%`;

const TYPE_ICONS: Record<ActionItem['type'], React.ElementType> = {
  expiring_quote: Clock,
  review_flag: AlertTriangle,
  stale_quote: Timer,
  active_cycle: Unlock,
};

const TYPE_LABELS: Record<ActionItem['type'], string> = {
  expiring_quote: 'Quote',
  review_flag: 'Review',
  stale_quote: 'Stale',
  active_cycle: 'Cycle',
};

const SEVERITY_STYLES: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  low: 'bg-muted text-muted-foreground border-border',
};

import { WipShelf } from '@/components/supply/WipShelf';

export default function SupplyDashboard() {
  return (
    <WipShelf
      title="Supply Dashboard — Work in Progress"
      description="The dashboard is paused while we redesign supply KPIs around the new Domains workflow."
      redirectHint="In the meantime, use Supply Domains for day-to-day selection and review."
    />
  );
}

function _LegacySupplyDashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodKey>('month');

  const { data: orderKpis, isLoading: kpisLoading } = useOrderKpis(period);
  const { data: health, isLoading: healthLoading } = useSupplyHealthSummary();
  const { data: actionItems, isLoading: actionsLoading } = useActionItems();

  const isLoading = kpisLoading || healthLoading || actionsLoading;

  const periodLabel = period === 'week' ? 'Last 7 Days' : period === 'month' ? 'Last 30 Days' : 'Last 365 Days';

  return (
    <ProtectedRoute>
      <AppLayout>
        <TooltipProvider delayDuration={200}>
          <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="h-5 w-5 text-emerald-500" />
                  <h1 className="text-xl font-extrabold tracking-tight">Supply Dashboard</h1>
                </div>
                <p className="text-xs text-muted-foreground/60 font-medium tracking-wide">{periodLabel}</p>
              </div>
              <ToggleGroup
                type="single"
                value={period}
                onValueChange={(v) => v && setPeriod(v as PeriodKey)}
                className="bg-muted/40 dark:bg-muted/20 rounded-lg p-0.5 gap-0"
              >
                {(['week', 'month', 'year'] as const).map((p) => (
                  <ToggleGroupItem key={p} value={p} className="text-[11px] px-3 h-7 rounded-md data-[state=on]:bg-card data-[state=on]:shadow-sm data-[state=on]:font-bold capitalize">
                    {p}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
                </div>
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
              </div>
            ) : (
              <>
                {/* ─── Section 1: Quote KPIs ─── */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  <SectionCard icon={FileCheck} title="Quote Activity" accentBorder="">
                    <HeroStat
                      label="Total Quotes"
                      tip="Total supplier quotes in this period"
                      value={orderKpis?.current.total ?? 0}
                      delta={orderKpis?.previous ? <DeltaBadge current={orderKpis.current.total} previous={orderKpis.previous.total} /> : undefined}
                      prevValue={orderKpis?.previous?.total}
                      compareMode
                    />
                    <div className="flex items-end justify-around pt-1">
                      <InlineKpi
                        label="Approved"
                        value={orderKpis?.current.approved ?? 0}
                        tip="Approved quotes"
                      />
                      <InlineKpi
                        label="Submitted"
                        value={orderKpis?.current.submitted ?? 0}
                        tip="Pending review"
                      />
                      <InlineKpi
                        label="Negotiating"
                        value={orderKpis?.current.negotiating ?? 0}
                        tip="In negotiation"
                      />
                    </div>
                  </SectionCard>

                  <SectionCard icon={Timer} title="Performance" accentBorder="">
                    <RowMetric
                      label="Success Rate"
                      value={pct(orderKpis?.current.successRate ?? 0)}
                      tip="Approved quotes ÷ total quotes"
                      delta={orderKpis?.previous ? <DeltaBadge current={orderKpis.current.successRate / 100} previous={orderKpis.previous.successRate / 100} /> : undefined}
                    />
                    <RowMetric
                      label="Avg. Response Time"
                      value={orderKpis?.current.avgResponseHours != null ? `${Math.round(orderKpis.current.avgResponseHours)}h` : '—'}
                      tip="Average time from submission to approval"
                    />
                    <RowMetric
                      label="Rejected Quotes"
                      value={String(orderKpis?.current.rejected ?? 0)}
                      tip="Quotes that were rejected"
                    />
                  </SectionCard>

                  <SectionCard icon={Layers} title="Supply Health" accentBorder="">
                    <RowMetric
                      label="Active Cycles"
                      value={String(health?.activeCycles ?? 0)}
                      tip="Active sourcing cycles"
                    />
                    <RowMetric
                      label="Total Suppliers"
                      value={String(health?.totalSuppliers ?? 0)}
                      tip="Registered suppliers"
                    />
                    <RowMetric
                      label="Coverage Rate"
                      value={`${health?.coveragePct ?? 0}%`}
                      tip="Domains with active supplier directives"
                    />
                  </SectionCard>
                </div>

                {/* ─── Section 2: Quick Stats Cards ─── */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <button
                    onClick={() => navigate('/supply/unlock')}
                    className="text-left"
                  >
                    <Card className="hover:border-primary/30 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <Unlock className="h-4 w-4 text-emerald-500" />
                          <span className="text-xs text-muted-foreground">Active Cycles</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">{health?.activeCycles ?? 0}</p>
                      </CardContent>
                    </Card>
                  </button>

                  <button
                    onClick={() => navigate('/supply/coverage')}
                    className="text-left"
                  >
                    <Card className="hover:border-primary/30 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-emerald-500" />
                          <span className="text-xs text-muted-foreground">Coverage</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">{health?.coveragePct ?? 0}%</p>
                      </CardContent>
                    </Card>
                  </button>

                  <button
                    onClick={() => navigate('/supplier-materials')}
                    className="text-left"
                  >
                    <Card className={cn("hover:border-primary/30 transition-colors", (health?.staleQuotes ?? 0) > 0 && "border-amber-500/30")}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-amber-500" />
                          <span className="text-xs text-muted-foreground">Pending Review</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">{health?.staleQuotes ?? 0}</p>
                      </CardContent>
                    </Card>
                  </button>

                  <button onClick={() => navigate('/suppliers')} className="text-left">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-blue-500" />
                          <span className="text-xs text-muted-foreground">Suppliers</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">{health?.totalSuppliers ?? 0}</p>
                      </CardContent>
                    </Card>
                  </button>

                  <button
                    onClick={() => navigate('/supply/coverage')}
                    className="text-left"
                  >
                    <Card className={cn("hover:border-primary/30 transition-colors", (health?.reviewFlags ?? 0) > 0 && "border-purple-500/30")}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-purple-500" />
                          <span className="text-xs text-muted-foreground">Review Flags</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">{health?.reviewFlags ?? 0}</p>
                      </CardContent>
                    </Card>
                  </button>
                </div>

                {/* ─── Section 3: Action Items Table ─── */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        Action Items
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px]">
                        {(actionItems || []).length} items
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {(actionItems || []).length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No pending action items. All clear!</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[80px]">Type</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="w-[80px]">Severity</TableHead>
                            <TableHead className="w-[60px]">Age</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(actionItems || []).map(item => {
                            const Icon = TYPE_ICONS[item.type];
                            return (
                              <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(item.link)}>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-[10px] text-muted-foreground font-medium">{TYPE_LABELS[item.type]}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs">{item.description}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={cn("text-[9px]", SEVERITY_STYLES[item.severity])}>
                                    {item.severity}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground tabular-nums">{item.age}</TableCell>
                                <TableCell>
                                  <ExternalLink className="h-3 w-3 text-muted-foreground/40" />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TooltipProvider>
      </AppLayout>
    </ProtectedRoute>
  );
}