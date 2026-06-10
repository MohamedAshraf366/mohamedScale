import { useState, useMemo } from "react";
import { differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { subDays, format, startOfWeek } from "date-fns";
import {
  CalendarIcon, Users, TrendingUp, DollarSign,
  CheckCircle, Clock, AlertTriangle,
  GitCompareArrows,
  Banknote, Target, Activity, Zap, Settings2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSalesDashboard, type DateRange } from "@/hooks/useSalesDashboard";
import { useKpiTargets, type KpiTargetValues } from "@/hooks/useKpiTargets";
import {
  DeltaBadge, FunnelBar, TargetProgress, HeroStat, InlineKpi,
  RowMetric, FollowUpStat, SectionCard,
} from "@/components/shared/DashboardKpiComponents";

type PeriodKey = "week" | "month" | "year" | "custom";


function getRange(period: PeriodKey, custom?: { from?: Date; to?: Date }): DateRange {
  const now = new Date();
  if (period === "custom" && custom?.from && custom?.to) {
    return { start: custom.from, end: custom.to };
  }
  
  if (period === "week") {
    // الأسبوع يبدأ من السبت
    const start = startOfWeek(now, { weekStartsOn: 6 });
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }
  
  const days = period === "year" ? 365 : period === "month" ? 30 : 7;
  return { start: subDays(now, days), end: now };
}

const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
const sar = (v: number) =>
  new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(v);

/* ─── Stage / Interest config ─── */
const STAGE_COLORS: Record<string, string> = {
  discovery: "bg-primary/50",
  rfp: "bg-primary/65",
  negotiation: "bg-primary/80",
  won: "bg-primary",
  lost: "bg-muted-foreground/30",
};
const STAGE_LABELS: Record<string, string> = {
  discovery: "Discovery", rfp: "RFP", negotiation: "Negotiation",
  won: "Closed Won", lost: "Closed Lost",
};
const INTEREST_COLORS: Record<string, string> = {
  High: "bg-primary", Medium: "bg-primary/65",
  Low: "bg-primary/40", "Not interested": "bg-muted-foreground/30",
};
const INTEREST_LABELS: Record<string, string> = {
  High: "High", Medium: "Medium", Low: "Low", "Not interested": "Not Interested",
};

/* ─── KPI Defaults ─── */
const KPI_DEFAULTS: KpiTargetValues = {
  engagedClients: 30, newClients: 10, orderingClients: 5,
  conversionRate: 0.25, retentionRate: 0.6, activationRate: 0.35,
  pipelineCreated: 15, wonDeals: 10, pipelineConvRate: 0.3,
  avgCycleDays: 21, avgStageTimeDays: 5,
  revenue: 500_000, salesCount: 10, avgSaleSize: 60_000,
  avgOrdersPerClient: 2, revenuePerClient: 100_000, revenueRetentionRate: 0.65,
  followUpsCreated: 50, followUpsOnTime: 40, followUpsOverdue: 10,
};

/* ════════════════════════════════════════════════════════════
   MAIN DASHBOARD
   ════════════════════════════════════════════════════════════ */
export default function SalesDashboard() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canSetTargets = hasRole("admin") || hasRole("management");
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [compareMode, setCompareMode] = useState(false);
  const [showTargets, setShowTargets] = useState(true);

  const range = useMemo(() => getRange(period, customRange), [period, customRange]);
  const { data: result, isLoading } = useSalesDashboard(range);
  const { data: kpiTargets } = useKpiTargets();
  const data = result?.current;
  const prev = result?.previous;
  const targets = useMemo(() => {
    if (!kpiTargets) return KPI_DEFAULTS;
    if (period === "custom" && customRange.from && customRange.to) {
      const days = Math.max(1, differenceInDays(customRange.to, customRange.from) + 1);
      return kpiTargets.forDays(days);
    }
    const targetPeriod = period === "custom" ? "month" : period;
    return kpiTargets[targetPeriod] ?? KPI_DEFAULTS;
  }, [kpiTargets, period, customRange]);
  const t = (node: React.ReactNode) => showTargets ? node : undefined;

  const periodLabel =
    period === "custom" && customRange.from && customRange.to
      ? `${format(customRange.from, "MMM d")} – ${format(customRange.to, "MMM d, yyyy")}`
      : period === "week" ? "Last 7 Days" : period === "month" ? "Last 30 Days" : "Last 365 Days";

  return (
    <AppLayout>
      <TooltipProvider delayDuration={200}>
      <div className="space-y-6 p-6">

        {/* ─── Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-extrabold tracking-tight">Sales Dashboard</h1>
            </div>
            <p className="text-xs text-muted-foreground/60 font-medium tracking-wide">{periodLabel}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant={showTargets ? "default" : "ghost"}
              size="sm"
              className="text-[11px] gap-1.5 h-7 rounded-lg px-3"
              onClick={() => setShowTargets(!showTargets)}
            >
              <Target className="h-3 w-3" />
              Targets
            </Button>
            <Button
              variant={compareMode ? "default" : "ghost"}
              size="sm"
              className="text-[11px] gap-1.5 h-7 rounded-lg px-3"
              onClick={() => setCompareMode(!compareMode)}
            >
              <GitCompareArrows className="h-3 w-3" />
              Compare
            </Button>
            {canSetTargets && (
              <Button
                variant="ghost"
                size="sm"
                className="text-[11px] gap-1.5 h-7 rounded-lg px-3"
                onClick={() => navigate("/sales/targets")}
              >
                <Settings2 className="h-3 w-3" />
                Set Targets
              </Button>
            )}
            <div className="h-5 w-px bg-border/40 mx-1" />
            <ToggleGroup
              type="single"
              value={period}
              onValueChange={(v) => v && setPeriod(v as PeriodKey)}
              className="bg-muted/40 dark:bg-muted/20 rounded-lg p-0.5 gap-0"
            >
              {(["week", "month", "year", "custom"] as const).map((p) => (
                <ToggleGroupItem key={p} value={p} className="text-[11px] px-3 h-7 rounded-md data-[state=on]:bg-card data-[state=on]:shadow-sm data-[state=on]:font-bold capitalize">
                  {p}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            {period === "custom" && (
              <div className="flex gap-1">
                {(["from", "to"] as const).map((edge) => (
                  <Popover key={edge}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="text-[11px] gap-1 h-7 rounded-lg px-2.5">
                        <CalendarIcon className="h-3 w-3" />
                        {customRange[edge] ? format(customRange[edge]!, "MMM d") : edge === "from" ? "From" : "To"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={customRange[edge]}
                        onSelect={(d) => setCustomRange((r) => ({ ...r, [edge]: d ?? undefined }))}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── KPI Grid ─── */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}><CardContent className="p-6 space-y-4">
                <Skeleton className="h-3 w-20" /><Skeleton className="h-10 w-24 mx-auto" /><Skeleton className="h-16 w-full" />
              </CardContent></Card>
            ))}
          </div>
        ) : data && prev ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

            {/* ── CLIENTS ── */}
            <SectionCard icon={Users} title="Clients" accentBorder="">
              <HeroStat
                label="Ordering Clients"
                tip={{
                  what: "Unique companies that produced at least one Won opportunity in this period — i.e. clients that actually bought.",
                  formula: "COUNT DISTINCT customer_account_id WHERE won_at ∈ range",
                  example: "Acme won 3 deals + Globex won 1 → 2 ordering clients.",
                }}
                value={data.clients.ordering}
                accentClass=""
                delta={<DeltaBadge current={data.clients.ordering} previous={prev.clients.ordering} />}
                prevValue={prev.clients.ordering} compareMode={compareMode}
                targetBar={showTargets ? <TargetProgress current={data.clients.ordering} target={targets.orderingClients} /> : undefined}
              />
              <div className="flex items-end justify-around pt-1">
                <InlineKpi label="Engaged" value={data.clients.engaged} prevValue={prev.clients.engaged} compareMode={compareMode} delta={<DeltaBadge current={data.clients.engaged} previous={prev.clients.engaged} />}
                  tip={{
                    what: "Unique companies your team had at least one logged conversation with during the period (call, WhatsApp, meeting, email…).",
                    formula: "COUNT DISTINCT account_id FROM communications WHERE occurred_at ∈ range",
                    example: "5 calls with Acme + 1 with Globex → 2 engaged.",
                  }}
                  targetBar={t(<TargetProgress current={data.clients.engaged} target={targets.engagedClients} />)} />
                <InlineKpi label="New" value={data.clients.new} prevValue={prev.clients.new} compareMode={compareMode} delta={<DeltaBadge current={data.clients.new} previous={prev.clients.new} />}
                  tip={{
                    what: "Engaged clients whose account was created INSIDE this period — brand-new logos you started talking to.",
                    formula: "engaged ∩ accounts.created_at ∈ range",
                    example: "Initech added Jan 5 + first call Jan 6 → counted as new.",
                  }}
                  targetBar={t(<TargetProgress current={data.clients.new} target={targets.newClients} />)} />
              </div>
              <div className="h-px bg-border/30 dark:bg-border/15" />
              <div className="bg-muted/60 dark:bg-muted/35 border border-border/50 rounded-xl p-3">
                <RowMetric label="Conversion Rate" value={pct(data.clients.conversionRate)} prevValue={pct(prev.clients.conversionRate)} compareMode={compareMode} delta={<DeltaBadge current={data.clients.conversionRate} previous={prev.clients.conversionRate} />}
                  tip={{
                    what: "Of every engaged client, what share actually placed an order. Higher = your conversations turn into sales.",
                    formula: "ordering ÷ engaged",
                    example: "20 engaged, 5 ordering → 25%.",
                  }}
                  targetBar={t(<TargetProgress current={data.clients.conversionRate ?? 0} target={targets.conversionRate} format="percent" />)} />
              </div>
              <RowMetric label="Retention Rate" value={pct(data.clients.retentionRate)} prevValue={pct(prev.clients.retentionRate)} compareMode={compareMode} delta={<DeltaBadge current={data.clients.retentionRate} previous={prev.clients.retentionRate} />}
                tip={{
                  what: "Of clients who bought this period, what share were already in your system before the period started — i.e. repeat customers.",
                  formula: "(ordering clients with accounts.created_at < range.start) ÷ ordering",
                  example: "10 ordering, 7 already existed → 70%.",
                }}
                targetBar={t(<TargetProgress current={data.clients.retentionRate ?? 0} target={targets.retentionRate} format="percent" />)} />
              <RowMetric label="Activation Rate" value={pct(data.clients.activationRate)} prevValue={pct(prev.clients.activationRate)} compareMode={compareMode} delta={<DeltaBadge current={data.clients.activationRate} previous={prev.clients.activationRate} />}
                tip={{
                  what: "Of brand-new clients added in the period, what share already converted to a sale within the same period.",
                  formula: "ordering ÷ new",
                  example: "8 new clients, 2 won → 25%.",
                }}
                targetBar={t(<TargetProgress current={data.clients.activationRate ?? 0} target={targets.activationRate} format="percent" />)} />
            </SectionCard>

            {/* ── PIPELINE ── */}
            <SectionCard icon={TrendingUp} title="Pipeline" accentBorder="">
              <HeroStat
                label="Won"
                tip={{
                  what: "Number of opportunities that reached the Won stage during this period.",
                  formula: "COUNT opportunities WHERE won_at ∈ range",
                  note: "When stage→Won, a DB trigger auto-accepts the latest quotation so revenue is never lost.",
                }}
                value={data.pipeline.won}
                accentClass=""
                delta={<DeltaBadge current={data.pipeline.won} previous={prev.pipeline.won} />}
                prevValue={prev.pipeline.won} compareMode={compareMode}
                targetBar={showTargets ? <TargetProgress current={data.pipeline.won} target={targets.wonDeals} /> : undefined}
                sub={sar(data.pipeline.wonAmount)}
              />
              <div className="flex items-end justify-around pt-1">
                <InlineKpi label="Created" value={data.pipeline.created} prevValue={prev.pipeline.created} compareMode={compareMode} delta={<DeltaBadge current={data.pipeline.created} previous={prev.pipeline.created} />}
                  tip={{
                    what: "Opportunities (deals) opened during the period. The amount below sums every quotation attached to those deals (any status).",
                    formula: "COUNT opportunities WHERE created_at ∈ range",
                    example: "Two new deals with quotes of SAR 10k + 25k → 2 deals, SAR 35k.",
                  }}
                  targetBar={t(<TargetProgress current={data.pipeline.created} target={targets.pipelineCreated} />)} sub={sar(data.pipeline.createdAmount)} />
              </div>
              <div className="h-px bg-border/30 dark:bg-border/15" />
              <div className="bg-muted/60 dark:bg-muted/35 border border-border/50 rounded-xl p-3">
                <RowMetric label="Pipeline Conv. Rate" value={pct(data.pipeline.conversionRate)} prevValue={pct(prev.pipeline.conversionRate)} compareMode={compareMode} delta={<DeltaBadge current={data.pipeline.conversionRate} previous={prev.pipeline.conversionRate} />}
                  tip={{
                    what: "Of every deal opened, what share was eventually won. Higher = healthier pipeline.",
                    formula: "won ÷ created",
                    example: "20 created, 4 won → 20%.",
                  }}
                  targetBar={t(<TargetProgress current={data.pipeline.conversionRate ?? 0} target={targets.pipelineConvRate} format="percent" />)} />
              </div>
              <RowMetric label="Avg. Deal Cycle" value={data.pipeline.avgCycleDays !== null ? `${Math.round(data.pipeline.avgCycleDays)}d` : "—"} prevValue={prev.pipeline.avgCycleDays !== null ? `${Math.round(prev.pipeline.avgCycleDays)}d` : "—"} compareMode={compareMode} delta={<DeltaBadge current={data.pipeline.avgCycleDays} previous={prev.pipeline.avgCycleDays} invert />}
                tip={{
                  what: "Average days from opportunity creation to Won — how long it takes to close a deal end-to-end.",
                  formula: "AVG(won_at − created_at) over won opps",
                  example: "Deals closing in 30/60/90 days → 60 days avg.",
                }}
                targetBar={t(<TargetProgress current={data.pipeline.avgCycleDays ?? 0} target={targets.avgCycleDays} format="days" invert />)} />
              <RowMetric label="Avg. Stage Time" value={data.pipeline.avgStageTimeDays !== null ? `${Math.round(data.pipeline.avgStageTimeDays)}d` : "—"} prevValue={prev.pipeline.avgStageTimeDays !== null ? `${Math.round(prev.pipeline.avgStageTimeDays)}d` : "—"} compareMode={compareMode} delta={<DeltaBadge current={data.pipeline.avgStageTimeDays} previous={prev.pipeline.avgStageTimeDays} invert />}
                tip={{
                  what: "Average time a deal spends in a single stage (e.g. RFP → Negotiation) before moving forward.",
                  formula: "AVG(time between stage_change events) per opp",
                  note: "Falls back to (Avg Deal Cycle ÷ 4) if no stage-change events have been logged yet.",
                }}
                targetBar={t(<TargetProgress current={data.pipeline.avgStageTimeDays ?? 0} target={targets.avgStageTimeDays} format="days" invert />)} />
            </SectionCard>

            {/* ── SALES ── */}
            <SectionCard icon={Zap} title="Sales" accentBorder="">
              <HeroStat
                label="Revenue"
                tip={{
                  what: "Total value of accepted quotations on Won deals — your booked revenue for the period.",
                  formula: "SUM(quotations.total) WHERE status='accepted' AND opp ∈ won",
                  example: "Acme deal won with accepted quote of SAR 50k → +SAR 50k.",
                }}
                value={sar(data.sales.amount)}
                accentClass=""
                delta={<DeltaBadge current={data.sales.amount} previous={prev.sales.amount} />}
                prevValue={sar(prev.sales.amount)} compareMode={compareMode}
                targetBar={showTargets ? <TargetProgress current={data.sales.amount} target={targets.revenue} format="currency" /> : undefined}
              />
              <div className="flex items-end justify-around pt-1">
                <InlineKpi label="Deals" value={data.sales.count} prevValue={prev.sales.count} compareMode={compareMode} delta={<DeltaBadge current={data.sales.count} previous={prev.sales.count} />}
                  tip={{
                    what: "Number of Won opportunities in the period (same as the Won number above).",
                    formula: "COUNT won opps WHERE won_at ∈ range",
                  }}
                  targetBar={t(<TargetProgress current={data.sales.count} target={targets.salesCount} />)} />
              </div>
              <div className="h-px bg-border/30 dark:bg-border/15" />
              <div className="bg-muted/60 dark:bg-muted/35 border border-border/50 rounded-xl p-3">
                <RowMetric label="Avg. Sale Size" value={data.sales.avgSize !== null ? sar(data.sales.avgSize) : "—"} prevValue={prev.sales.avgSize !== null ? sar(prev.sales.avgSize) : "—"} compareMode={compareMode} delta={<DeltaBadge current={data.sales.avgSize} previous={prev.sales.avgSize} />}
                  tip={{
                    what: "Average value of one closed deal.",
                    formula: "revenue ÷ deals",
                    example: "SAR 200k / 4 deals → SAR 50k.",
                  }}
                  targetBar={t(<TargetProgress current={data.sales.avgSize ?? 0} target={targets.avgSaleSize} format="currency" />)} />
              </div>
              <RowMetric label="Avg. Orders/Client" value={data.sales.avgOrdersPerClient !== null ? data.sales.avgOrdersPerClient.toFixed(1) : "—"} prevValue={prev.sales.avgOrdersPerClient !== null ? prev.sales.avgOrdersPerClient.toFixed(1) : "—"} compareMode={compareMode} delta={<DeltaBadge current={data.sales.avgOrdersPerClient} previous={prev.sales.avgOrdersPerClient} />}
                tip={{
                  what: "How many separate deals each ordering client closed on average.",
                  formula: "deals ÷ ordering clients",
                  example: "8 deals across 4 clients → 2.0.",
                }}
                targetBar={t(<TargetProgress current={data.sales.avgOrdersPerClient ?? 0} target={targets.avgOrdersPerClient} format="decimal" />)} />
              <RowMetric label="Revenue/Client" value={data.sales.revenuePerClient !== null ? sar(data.sales.revenuePerClient) : "—"} prevValue={prev.sales.revenuePerClient !== null ? sar(prev.sales.revenuePerClient) : "—"} compareMode={compareMode} delta={<DeltaBadge current={data.sales.revenuePerClient} previous={prev.sales.revenuePerClient} />}
                tip={{
                  what: "Average revenue generated per ordering client — your spend-per-customer.",
                  formula: "revenue ÷ ordering clients",
                  example: "SAR 200k / 4 clients → SAR 50k.",
                }}
                targetBar={t(<TargetProgress current={data.sales.revenuePerClient ?? 0} target={targets.revenuePerClient} format="currency" />)} />
              <RowMetric label="Revenue Retention" value={pct(data.sales.revenueRetentionRate)} prevValue={pct(prev.sales.revenueRetentionRate)} compareMode={compareMode} delta={<DeltaBadge current={data.sales.revenueRetentionRate} previous={prev.sales.revenueRetentionRate} />}
                tip={{
                  what: "Of total revenue, what share came from clients you already had before the period started — recurring/repeat money.",
                  formula: "revenue from accounts created BEFORE range.start ÷ total revenue",
                  example: "SAR 200k revenue, SAR 150k from existing clients → 75%.",
                }}
                targetBar={t(<TargetProgress current={data.sales.revenueRetentionRate ?? 0} target={targets.revenueRetentionRate} format="percent" />)} />
            </SectionCard>

            {/* ── COLLECTION ── */}
            <SectionCard icon={Banknote} title="Collection" accentBorder="">
              <div className="flex items-center justify-end -mt-1 -mb-1">
                <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/40 font-bold bg-muted/30 px-2 py-0.5 rounded-md">Coming Soon</span>
              </div>
              <HeroStat label="Outstanding" tip={{ what: "Unpaid balance: total invoiced minus collected.", formula: "total claim − collected" }} value="—" accentClass="" />
              <div className="flex items-end justify-around pt-1">
                <InlineKpi label="Total Claim" value="—" tip={{ what: "Sum of all invoices issued in the period." }} />
                <InlineKpi label="Collected" value="—" tip={{ what: "Sum of all payments received in the period." }} />
              </div>
              <div className="h-px bg-border/30 dark:bg-border/15" />
              <div className="bg-muted/60 dark:bg-muted/35 border border-border/50 rounded-xl p-3">
                <RowMetric label="Collection Rate" value="—" tip={{ what: "Share of invoiced amount that was actually collected.", formula: "collected ÷ total claim" }} />
              </div>
              <RowMetric label="Grace Compliance" value="—" tip={{ what: "Share of payments received within the agreed grace period." }} />
              <RowMetric label="Avg. Collection Period" value="—" tip={{ what: "Average days from invoice issuance to payment receipt." }} />
            </SectionCard>
          </div>
        ) : null}

        {/* ─── Section 2: Funnels + Follow-ups ─── */}
        {data && prev && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground/60">Pipeline by Stage</CardTitle>
                  <span className="text-[9px] text-muted-foreground/40 font-medium bg-muted/40 px-1.5 py-0.5 rounded">{periodLabel}</span>
                </div>
              </CardHeader>
              <CardContent>
                <FunnelBar items={data.funnel.stages} prevItems={prev.funnel.stages} colors={STAGE_COLORS} labels={STAGE_LABELS} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground/60">By Interest Level</CardTitle>
                  <span className="text-[9px] text-muted-foreground/40 font-medium bg-muted/40 px-1.5 py-0.5 rounded">{periodLabel}</span>
                </div>
              </CardHeader>
              <CardContent>
                <FunnelBar items={data.funnel.interestLevels} prevItems={prev.funnel.interestLevels} colors={INTEREST_COLORS} labels={INTEREST_LABELS} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground/60">Follow-up KPIs</CardTitle>
                  <span className="text-[9px] text-muted-foreground/40 font-medium bg-muted/40 px-1.5 py-0.5 rounded">{periodLabel}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2.5">
                  <FollowUpStat icon={Clock} label="Created" value={data.communication.created} variant="neutral" prevValue={prev.communication.created} compareMode={compareMode} targetBar={t(<TargetProgress current={data.communication.created} target={targets.followUpsCreated} />)} />
                  <FollowUpStat icon={CheckCircle} label="On-time" value={data.communication.onTime} variant="success" prevValue={prev.communication.onTime} compareMode={compareMode} targetBar={t(<TargetProgress current={data.communication.onTime} target={targets.followUpsOnTime} />)} />
                  <FollowUpStat icon={AlertTriangle} label="Overdue" value={data.communication.overdue} variant="danger" prevValue={prev.communication.overdue} compareMode={compareMode} targetBar={t(<TargetProgress current={data.communication.overdue} target={targets.followUpsOverdue} label="Max" invert />)} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      </TooltipProvider>
    </AppLayout>
  );
}



//For future use if beeded
// import { useState, useMemo } from "react";
// import { differenceInDays, startOfWeek, subDays, format } from "date-fns";
// import { useNavigate } from "react-router-dom";
// import {
//   CalendarIcon, Users, TrendingUp, DollarSign,
//   CheckCircle, Clock, AlertTriangle,
//   GitCompareArrows,
//   Banknote, Target, Activity, Zap, Settings2,
// } from "lucide-react";
// import { useAuth } from "@/contexts/AuthContext";
// import { AppLayout } from "@/components/layout";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
// import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// import { Calendar } from "@/components/ui/calendar";
// import { Button } from "@/components/ui/button";
// import { Skeleton } from "@/components/ui/skeleton";
// import { TooltipProvider } from "@/components/ui/tooltip";
// import { cn } from "@/lib/utils";
// import { useSalesDashboard, type DateRange } from "@/hooks/useSalesDashboard";
// import { useKpiTargets, type KpiTargetValues } from "@/hooks/useKpiTargets";
// import {
//   DeltaBadge, FunnelBar, TargetProgress, HeroStat, InlineKpi,
//   RowMetric, FollowUpStat, SectionCard,
// } from "@/components/shared/DashboardKpiComponents";

// type PeriodKey = "week" | "month" | "year" | "custom";

// // ✅ تعديل دالة getRange - الأسبوع يبدأ من السبت
// function getRange(period: PeriodKey, custom?: { from?: Date; to?: Date }): DateRange {
//   const now = new Date();
  
//   if (period === "custom" && custom?.from && custom?.to) {
//     return { start: custom.from, end: custom.to };
//   }
  
//   if (period === "week") {
//     // الأسبوع يبدأ من السبت (Saturday = 6)
//     const start = startOfWeek(now, { weekStartsOn: 6 });
//     start.setHours(0, 0, 0, 0);
//     return { start, end: now };
//   }
  
//   const days = period === "year" ? 365 : period === "month" ? 30 : 7;
//   return { start: subDays(now, days), end: now };
// }

// // ✅ دالة لجلب range الأسبوع السابق للمقارنة
// function getPrevRange(period: PeriodKey, currentRange?: DateRange): DateRange {
//   if (period === "week" && currentRange) {
//     const start = new Date(currentRange.start);
//     start.setDate(start.getDate() - 7);
//     const end = new Date(currentRange.end);
//     end.setDate(end.getDate() - 7);
//     return { start, end };
//   }
  
//   const now = new Date();
//   const days = period === "year" ? 365 : period === "month" ? 30 : 7;
//   return { start: subDays(now, days * 2), end: subDays(now, days) };
// }

// const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
// const sar = (v: number) =>
//   new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(v);

// /* ─── Stage / Interest config ─── */
// const STAGE_COLORS: Record<string, string> = {
//   discovery: "bg-primary/50",
//   rfp: "bg-primary/65",
//   negotiation: "bg-primary/80",
//   won: "bg-primary",
//   lost: "bg-muted-foreground/30",
// };
// const STAGE_LABELS: Record<string, string> = {
//   discovery: "Discovery", rfp: "RFP", negotiation: "Negotiation",
//   won: "Closed Won", lost: "Closed Lost",
// };
// const INTEREST_COLORS: Record<string, string> = {
//   High: "bg-primary", Medium: "bg-primary/65",
//   Low: "bg-primary/40", "Not interested": "bg-muted-foreground/30",
// };
// const INTEREST_LABELS: Record<string, string> = {
//   High: "High", Medium: "Medium", Low: "Low", "Not interested": "Not Interested",
// };

// /* ─── KPI Defaults ─── */
// const KPI_DEFAULTS: KpiTargetValues = {
//   engagedClients: 30, newClients: 10, orderingClients: 5,
//   conversionRate: 0.25, retentionRate: 0.6, activationRate: 0.35,
//   pipelineCreated: 15, wonDeals: 10, pipelineConvRate: 0.3,
//   avgCycleDays: 21, avgStageTimeDays: 5,
//   revenue: 500_000, salesCount: 10, avgSaleSize: 60_000,
//   avgOrdersPerClient: 2, revenuePerClient: 100_000, revenueRetentionRate: 0.65,
//   followUpsCreated: 50, followUpsOnTime: 40, followUpsOverdue: 10,
// };

// /* ════════════════════════════════════════════════════════════
//    MAIN DASHBOARD
//    ════════════════════════════════════════════════════════════ */
// export default function SalesDashboard() {
//   const navigate = useNavigate();
//   const { hasRole } = useAuth();
//   const canSetTargets = hasRole("admin") || hasRole("management");
//   const [period, setPeriod] = useState<PeriodKey>("month");
//   const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
//   const [compareMode, setCompareMode] = useState(false);
//   const [showTargets, setShowTargets] = useState(true);

//   // ✅ استخدام دالة getRange المعدلة
//   const range = useMemo(() => getRange(period, customRange), [period, customRange]);
  
//   // ✅ حساب range السابق للمقارنة
//   const prevRange = useMemo(() => {
//     if (period === "custom" && customRange.from && customRange.to) {
//       const days = differenceInDays(customRange.to, customRange.from) + 1;
//       return {
//         start: subDays(customRange.from, days),
//         end: subDays(customRange.to, days),
//       };
//     }
//     return getPrevRange(period, range);
//   }, [period, customRange, range]);
  
//   const { data: result, isLoading } = useSalesDashboard(range, prevRange);
//   const { data: kpiTargets } = useKpiTargets();
//   const data = result?.current;
//   const prev = result?.previous;
  
//   const targets = useMemo(() => {
//     if (!kpiTargets) return KPI_DEFAULTS;
//     if (period === "custom" && customRange.from && customRange.to) {
//       const days = Math.max(1, differenceInDays(customRange.to, customRange.from) + 1);
//       return kpiTargets.forDays(days);
//     }
//     const targetPeriod = period === "custom" ? "month" : period;
//     return kpiTargets[targetPeriod] ?? KPI_DEFAULTS;
//   }, [kpiTargets, period, customRange]);
  
//   const t = (node: React.ReactNode) => showTargets ? node : undefined;

//   // ✅ تحديث التسمية للأسبوع
//   const periodLabel =
//     period === "custom" && customRange.from && customRange.to
//       ? `${format(customRange.from, "MMM d")} – ${format(customRange.to, "MMM d, yyyy")}`
//       : period === "week" 
//         ? `This Week (Starts Saturday: ${format(range.start, "MMM d")} – ${format(range.end, "MMM d, yyyy")})`
//         : period === "month" 
//           ? "Last 30 Days" 
//           : "Last 365 Days";

//   return (
//     <AppLayout>
//       <TooltipProvider delayDuration={200}>
//       <div className="space-y-6 p-6">

//         {/* ─── Header ─── */}
//         <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
//           <div>
//             <div className="flex items-center gap-2 mb-1">
//               <Activity className="h-5 w-5 text-primary" />
//               <h1 className="text-xl font-extrabold tracking-tight">Sales Dashboard</h1>
//             </div>
//             <p className="text-xs text-muted-foreground/60 font-medium tracking-wide">{periodLabel}</p>
//           </div>
//           <div className="flex items-center gap-1.5 flex-wrap">
//             <Button
//               variant={showTargets ? "default" : "ghost"}
//               size="sm"
//               className="text-[11px] gap-1.5 h-7 rounded-lg px-3"
//               onClick={() => setShowTargets(!showTargets)}
//             >
//               <Target className="h-3 w-3" />
//               Targets
//             </Button>
//             <Button
//               variant={compareMode ? "default" : "ghost"}
//               size="sm"
//               className="text-[11px] gap-1.5 h-7 rounded-lg px-3"
//               onClick={() => setCompareMode(!compareMode)}
//             >
//               <GitCompareArrows className="h-3 w-3" />
//               Compare
//             </Button>
//             {canSetTargets && (
//               <Button
//                 variant="ghost"
//                 size="sm"
//                 className="text-[11px] gap-1.5 h-7 rounded-lg px-3"
//                 onClick={() => navigate("/sales/targets")}
//               >
//                 <Settings2 className="h-3 w-3" />
//                 Set Targets
//               </Button>
//             )}
//             <div className="h-5 w-px bg-border/40 mx-1" />
//             <ToggleGroup
//               type="single"
//               value={period}
//               onValueChange={(v) => v && setPeriod(v as PeriodKey)}
//               className="bg-muted/40 dark:bg-muted/20 rounded-lg p-0.5 gap-0"
//             >
//               {(["week", "month", "year", "custom"] as const).map((p) => (
//                 <ToggleGroupItem key={p} value={p} className="text-[11px] px-3 h-7 rounded-md data-[state=on]:bg-card data-[state=on]:shadow-sm data-[state=on]:font-bold capitalize">
//                   {p === "week" ? "Week" : p === "month" ? "Month" : p === "year" ? "Year" : "Custom"}
//                 </ToggleGroupItem>
//               ))}
//             </ToggleGroup>

//             {period === "custom" && (
//               <div className="flex gap-1">
//                 {(["from", "to"] as const).map((edge) => (
//                   <Popover key={edge}>
//                     <PopoverTrigger asChild>
//                       <Button variant="outline" size="sm" className="text-[11px] gap-1 h-7 rounded-lg px-2.5">
//                         <CalendarIcon className="h-3 w-3" />
//                         {customRange[edge] ? format(customRange[edge]!, "MMM d") : edge === "from" ? "From" : "To"}
//                       </Button>
//                     </PopoverTrigger>
//                     <PopoverContent className="w-auto p-0" align="end">
//                       <Calendar
//                         mode="single"
//                         selected={customRange[edge]}
//                         onSelect={(d) => setCustomRange((r) => ({ ...r, [edge]: d ?? undefined }))}
//                         className="p-3 pointer-events-auto"
//                       />
//                     </PopoverContent>
//                   </Popover>
//                 ))}
//               </div>
//             )}
//           </div>
//         </div>

//         {/* ─── باقي الـ Dashboard كما هو ─── */}
//         {isLoading ? (
//           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
//             {[1, 2, 3, 4].map((i) => (
//               <Card key={i}><CardContent className="p-6 space-y-4">
//                 <Skeleton className="h-3 w-20" /><Skeleton className="h-10 w-24 mx-auto" /><Skeleton className="h-16 w-full" />
//               </CardContent></Card>
//             ))}
//           </div>
//         ) : data && prev ? (
//           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
//             {/* ── CLIENTS ── (نفس الكود) */}
//             <SectionCard icon={Users} title="Clients" accentBorder="">
//               <HeroStat
//                 label="Ordering Clients"
//                 tip={{
//                   what: "Unique companies that produced at least one Won opportunity in this period — i.e. clients that actually bought.",
//                   formula: "COUNT DISTINCT customer_account_id WHERE won_at ∈ range",
//                   example: "Acme won 3 deals + Globex won 1 → 2 ordering clients.",
//                 }}
//                 value={data.clients.ordering}
//                 accentClass=""
//                 delta={<DeltaBadge current={data.clients.ordering} previous={prev.clients.ordering} />}
//                 prevValue={prev.clients.ordering} compareMode={compareMode}
//                 targetBar={showTargets ? <TargetProgress current={data.clients.ordering} target={targets.orderingClients} /> : undefined}
//               />
//               <div className="flex items-end justify-around pt-1">
//                 <InlineKpi label="Engaged" value={data.clients.engaged} prevValue={prev.clients.engaged} compareMode={compareMode} delta={<DeltaBadge current={data.clients.engaged} previous={prev.clients.engaged} />}
//                   tip={{
//                     what: "Unique companies your team had at least one logged conversation with during the period (call, WhatsApp, meeting, email…).",
//                     formula: "COUNT DISTINCT account_id FROM communications WHERE occurred_at ∈ range",
//                     example: "5 calls with Acme + 1 with Globex → 2 engaged.",
//                   }}
//                   targetBar={t(<TargetProgress current={data.clients.engaged} target={targets.engagedClients} />)} />
//                 <InlineKpi label="New" value={data.clients.new} prevValue={prev.clients.new} compareMode={compareMode} delta={<DeltaBadge current={data.clients.new} previous={prev.clients.new} />}
//                   tip={{
//                     what: "Engaged clients whose account was created INSIDE this period — brand-new logos you started talking to.",
//                     formula: "engaged ∩ accounts.created_at ∈ range",
//                     example: "Initech added Jan 5 + first call Jan 6 → counted as new.",
//                   }}
//                   targetBar={t(<TargetProgress current={data.clients.new} target={targets.newClients} />)} />
//               </div>
//               <div className="h-px bg-border/30 dark:bg-border/15" />
//               <div className="bg-muted/60 dark:bg-muted/35 border border-border/50 rounded-xl p-3">
//                 <RowMetric label="Conversion Rate" value={pct(data.clients.conversionRate)} prevValue={pct(prev.clients.conversionRate)} compareMode={compareMode} delta={<DeltaBadge current={data.clients.conversionRate} previous={prev.clients.conversionRate} />}
//                   tip={{
//                     what: "Of every engaged client, what share actually placed an order. Higher = your conversations turn into sales.",
//                     formula: "ordering ÷ engaged",
//                     example: "20 engaged, 5 ordering → 25%.",
//                   }}
//                   targetBar={t(<TargetProgress current={data.clients.conversionRate ?? 0} target={targets.conversionRate} format="percent" />)} />
//               </div>
//               <RowMetric label="Retention Rate" value={pct(data.clients.retentionRate)} prevValue={pct(prev.clients.retentionRate)} compareMode={compareMode} delta={<DeltaBadge current={data.clients.retentionRate} previous={prev.clients.retentionRate} />}
//                 tip={{
//                   what: "Of clients who bought this period, what share were already in your system before the period started — i.e. repeat customers.",
//                   formula: "(ordering clients with accounts.created_at < range.start) ÷ ordering",
//                   example: "10 ordering, 7 already existed → 70%.",
//                 }}
//                 targetBar={t(<TargetProgress current={data.clients.retentionRate ?? 0} target={targets.retentionRate} format="percent" />)} />
//               <RowMetric label="Activation Rate" value={pct(data.clients.activationRate)} prevValue={pct(prev.clients.activationRate)} compareMode={compareMode} delta={<DeltaBadge current={data.clients.activationRate} previous={prev.clients.activationRate} />}
//                 tip={{
//                   what: "Of brand-new clients added in the period, what share already converted to a sale within the same period.",
//                   formula: "ordering ÷ new",
//                   example: "8 new clients, 2 won → 25%.",
//                 }}
//                 targetBar={t(<TargetProgress current={data.clients.activationRate ?? 0} target={targets.activationRate} format="percent" />)} />
//             </SectionCard>

//             {/* ── PIPELINE ── (نفس الكود) */}
//             <SectionCard icon={TrendingUp} title="Pipeline" accentBorder="">
//               <HeroStat
//                 label="Won"
//                 tip={{
//                   what: "Number of opportunities that reached the Won stage during this period.",
//                   formula: "COUNT opportunities WHERE won_at ∈ range",
//                   note: "When stage→Won, a DB trigger auto-accepts the latest quotation so revenue is never lost.",
//                 }}
//                 value={data.pipeline.won}
//                 accentClass=""
//                 delta={<DeltaBadge current={data.pipeline.won} previous={prev.pipeline.won} />}
//                 prevValue={prev.pipeline.won} compareMode={compareMode}
//                 targetBar={showTargets ? <TargetProgress current={data.pipeline.won} target={targets.wonDeals} /> : undefined}
//                 sub={sar(data.pipeline.wonAmount)}
//               />
//               <div className="flex items-end justify-around pt-1">
//                 <InlineKpi label="Created" value={data.pipeline.created} prevValue={prev.pipeline.created} compareMode={compareMode} delta={<DeltaBadge current={data.pipeline.created} previous={prev.pipeline.created} />}
//                   tip={{
//                     what: "Opportunities (deals) opened during the period. The amount below sums every quotation attached to those deals (any status).",
//                     formula: "COUNT opportunities WHERE created_at ∈ range",
//                     example: "Two new deals with quotes of SAR 10k + 25k → 2 deals, SAR 35k.",
//                   }}
//                   targetBar={t(<TargetProgress current={data.pipeline.created} target={targets.pipelineCreated} />)} sub={sar(data.pipeline.createdAmount)} />
//               </div>
//               <div className="h-px bg-border/30 dark:bg-border/15" />
//               <div className="bg-muted/60 dark:bg-muted/35 border border-border/50 rounded-xl p-3">
//                 <RowMetric label="Pipeline Conv. Rate" value={pct(data.pipeline.conversionRate)} prevValue={pct(prev.pipeline.conversionRate)} compareMode={compareMode} delta={<DeltaBadge current={data.pipeline.conversionRate} previous={prev.pipeline.conversionRate} />}
//                   tip={{
//                     what: "Of every deal opened, what share was eventually won. Higher = healthier pipeline.",
//                     formula: "won ÷ created",
//                     example: "20 created, 4 won → 20%.",
//                   }}
//                   targetBar={t(<TargetProgress current={data.pipeline.conversionRate ?? 0} target={targets.pipelineConvRate} format="percent" />)} />
//               </div>
//               <RowMetric label="Avg. Deal Cycle" value={data.pipeline.avgCycleDays !== null ? `${Math.round(data.pipeline.avgCycleDays)}d` : "—"} prevValue={prev.pipeline.avgCycleDays !== null ? `${Math.round(prev.pipeline.avgCycleDays)}d` : "—"} compareMode={compareMode} delta={<DeltaBadge current={data.pipeline.avgCycleDays} previous={prev.pipeline.avgCycleDays} invert />}
//                 tip={{
//                   what: "Average days from opportunity creation to Won — how long it takes to close a deal end-to-end.",
//                   formula: "AVG(won_at − created_at) over won opps",
//                   example: "Deals closing in 30/60/90 days → 60 days avg.",
//                 }}
//                 targetBar={t(<TargetProgress current={data.pipeline.avgCycleDays ?? 0} target={targets.avgCycleDays} format="days" invert />)} />
//               <RowMetric label="Avg. Stage Time" value={data.pipeline.avgStageTimeDays !== null ? `${Math.round(data.pipeline.avgStageTimeDays)}d` : "—"} prevValue={prev.pipeline.avgStageTimeDays !== null ? `${Math.round(prev.pipeline.avgStageTimeDays)}d` : "—"} compareMode={compareMode} delta={<DeltaBadge current={data.pipeline.avgStageTimeDays} previous={prev.pipeline.avgStageTimeDays} invert />}
//                 tip={{
//                   what: "Average time a deal spends in a single stage (e.g. RFP → Negotiation) before moving forward.",
//                   formula: "AVG(time between stage_change events) per opp",
//                   note: "Falls back to (Avg Deal Cycle ÷ 4) if no stage-change events have been logged yet.",
//                 }}
//                 targetBar={t(<TargetProgress current={data.pipeline.avgStageTimeDays ?? 0} target={targets.avgStageTimeDays} format="days" invert />)} />
//             </SectionCard>

//             {/* ── SALES ── (نفس الكود) */}
//             <SectionCard icon={Zap} title="Sales" accentBorder="">
//               <HeroStat
//                 label="Revenue"
//                 tip={{
//                   what: "Total value of accepted quotations on Won deals — your booked revenue for the period.",
//                   formula: "SUM(quotations.total) WHERE status='accepted' AND opp ∈ won",
//                   example: "Acme deal won with accepted quote of SAR 50k → +SAR 50k.",
//                 }}
//                 value={sar(data.sales.amount)}
//                 accentClass=""
//                 delta={<DeltaBadge current={data.sales.amount} previous={prev.sales.amount} />}
//                 prevValue={sar(prev.sales.amount)} compareMode={compareMode}
//                 targetBar={showTargets ? <TargetProgress current={data.sales.amount} target={targets.revenue} format="currency" /> : undefined}
//               />
//               <div className="flex items-end justify-around pt-1">
//                 <InlineKpi label="Deals" value={data.sales.count} prevValue={prev.sales.count} compareMode={compareMode} delta={<DeltaBadge current={data.sales.count} previous={prev.sales.count} />}
//                   tip={{
//                     what: "Number of Won opportunities in the period (same as the Won number above).",
//                     formula: "COUNT won opps WHERE won_at ∈ range",
//                   }}
//                   targetBar={t(<TargetProgress current={data.sales.count} target={targets.salesCount} />)} />
//               </div>
//               <div className="h-px bg-border/30 dark:bg-border/15" />
//               <div className="bg-muted/60 dark:bg-muted/35 border border-border/50 rounded-xl p-3">
//                 <RowMetric label="Avg. Sale Size" value={data.sales.avgSize !== null ? sar(data.sales.avgSize) : "—"} prevValue={prev.sales.avgSize !== null ? sar(prev.sales.avgSize) : "—"} compareMode={compareMode} delta={<DeltaBadge current={data.sales.avgSize} previous={prev.sales.avgSize} />}
//                   tip={{
//                     what: "Average value of one closed deal.",
//                     formula: "revenue ÷ deals",
//                     example: "SAR 200k / 4 deals → SAR 50k.",
//                   }}
//                   targetBar={t(<TargetProgress current={data.sales.avgSize ?? 0} target={targets.avgSaleSize} format="currency" />)} />
//               </div>
//               <RowMetric label="Avg. Orders/Client" value={data.sales.avgOrdersPerClient !== null ? data.sales.avgOrdersPerClient.toFixed(1) : "—"} prevValue={prev.sales.avgOrdersPerClient !== null ? prev.sales.avgOrdersPerClient.toFixed(1) : "—"} compareMode={compareMode} delta={<DeltaBadge current={data.sales.avgOrdersPerClient} previous={prev.sales.avgOrdersPerClient} />}
//                 tip={{
//                   what: "How many separate deals each ordering client closed on average.",
//                   formula: "deals ÷ ordering clients",
//                   example: "8 deals across 4 clients → 2.0.",
//                 }}
//                 targetBar={t(<TargetProgress current={data.sales.avgOrdersPerClient ?? 0} target={targets.avgOrdersPerClient} format="decimal" />)} />
//               <RowMetric label="Revenue/Client" value={data.sales.revenuePerClient !== null ? sar(data.sales.revenuePerClient) : "—"} prevValue={prev.sales.revenuePerClient !== null ? sar(prev.sales.revenuePerClient) : "—"} compareMode={compareMode} delta={<DeltaBadge current={data.sales.revenuePerClient} previous={prev.sales.revenuePerClient} />}
//                 tip={{
//                   what: "Average revenue generated per ordering client — your spend-per-customer.",
//                   formula: "revenue ÷ ordering clients",
//                   example: "SAR 200k / 4 clients → SAR 50k.",
//                 }}
//                 targetBar={t(<TargetProgress current={data.sales.revenuePerClient ?? 0} target={targets.revenuePerClient} format="currency" />)} />
//               <RowMetric label="Revenue Retention" value={pct(data.sales.revenueRetentionRate)} prevValue={pct(prev.sales.revenueRetentionRate)} compareMode={compareMode} delta={<DeltaBadge current={data.sales.revenueRetentionRate} previous={prev.sales.revenueRetentionRate} />}
//                 tip={{
//                   what: "Of total revenue, what share came from clients you already had before the period started — recurring/repeat money.",
//                   formula: "revenue from accounts created BEFORE range.start ÷ total revenue",
//                   example: "SAR 200k revenue, SAR 150k from existing clients → 75%.",
//                 }}
//                 targetBar={t(<TargetProgress current={data.sales.revenueRetentionRate ?? 0} target={targets.revenueRetentionRate} format="percent" />)} />
//             </SectionCard>

//             {/* ── COLLECTION ── (نفس الكود) */}
//             <SectionCard icon={Banknote} title="Collection" accentBorder="">
//               <div className="flex items-center justify-end -mt-1 -mb-1">
//                 <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/40 font-bold bg-muted/30 px-2 py-0.5 rounded-md">Coming Soon</span>
//               </div>
//               <HeroStat label="Outstanding" tip={{ what: "Unpaid balance: total invoiced minus collected.", formula: "total claim − collected" }} value="—" accentClass="" />
//               <div className="flex items-end justify-around pt-1">
//                 <InlineKpi label="Total Claim" value="—" tip={{ what: "Sum of all invoices issued in the period." }} />
//                 <InlineKpi label="Collected" value="—" tip={{ what: "Sum of all payments received in the period." }} />
//               </div>
//               <div className="h-px bg-border/30 dark:bg-border/15" />
//               <div className="bg-muted/60 dark:bg-muted/35 border border-border/50 rounded-xl p-3">
//                 <RowMetric label="Collection Rate" value="—" tip={{ what: "Share of invoiced amount that was actually collected.", formula: "collected ÷ total claim" }} />
//               </div>
//               <RowMetric label="Grace Compliance" value="—" tip={{ what: "Share of payments received within the agreed grace period." }} />
//               <RowMetric label="Avg. Collection Period" value="—" tip={{ what: "Average days from invoice issuance to payment receipt." }} />
//             </SectionCard>
//           </div>
//         ) : null}

//         {/* ─── Section 2: Funnels + Follow-ups ─── */}
//         {data && prev && (
//           <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
//             <Card className="lg:col-span-1">
//               <CardHeader className="pb-2">
//                 <div className="flex items-center justify-between">
//                   <CardTitle className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground/60">Pipeline by Stage</CardTitle>
//                   <span className="text-[9px] text-muted-foreground/40 font-medium bg-muted/40 px-1.5 py-0.5 rounded">{periodLabel}</span>
//                 </div>
//               </CardHeader>
//               <CardContent>
//                 <FunnelBar items={data.funnel.stages} prevItems={prev.funnel.stages} colors={STAGE_COLORS} labels={STAGE_LABELS} />
//               </CardContent>
//             </Card>

//             <Card className="lg:col-span-1">
//               <CardHeader className="pb-2">
//                 <div className="flex items-center justify-between">
//                   <CardTitle className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground/60">By Interest Level</CardTitle>
//                   <span className="text-[9px] text-muted-foreground/40 font-medium bg-muted/40 px-1.5 py-0.5 rounded">{periodLabel}</span>
//                 </div>
//               </CardHeader>
//               <CardContent>
//                 <FunnelBar items={data.funnel.interestLevels} prevItems={prev.funnel.interestLevels} colors={INTEREST_COLORS} labels={INTEREST_LABELS} />
//               </CardContent>
//             </Card>

//             <Card className="lg:col-span-1">
//               <CardHeader className="pb-2">
//                 <div className="flex items-center justify-between">
//                   <CardTitle className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground/60">Follow-up KPIs</CardTitle>
//                   <span className="text-[9px] text-muted-foreground/40 font-medium bg-muted/40 px-1.5 py-0.5 rounded">{periodLabel}</span>
//                 </div>
//               </CardHeader>
//               <CardContent>
//                 <div className="grid grid-cols-3 gap-2.5">
//                   <FollowUpStat icon={Clock} label="Created" value={data.communication.created} variant="neutral" prevValue={prev.communication.created} compareMode={compareMode} targetBar={t(<TargetProgress current={data.communication.created} target={targets.followUpsCreated} />)} />
//                   <FollowUpStat icon={CheckCircle} label="On-time" value={data.communication.onTime} variant="success" prevValue={prev.communication.onTime} compareMode={compareMode} targetBar={t(<TargetProgress current={data.communication.onTime} target={targets.followUpsOnTime} />)} />
//                   <FollowUpStat icon={AlertTriangle} label="Overdue" value={data.communication.overdue} variant="danger" prevValue={prev.communication.overdue} compareMode={compareMode} targetBar={t(<TargetProgress current={data.communication.overdue} target={targets.followUpsOverdue} label="Max" invert />)} />
//                 </div>
//               </CardContent>
//             </Card>
//           </div>
//         )}
//       </div>
//       </TooltipProvider>
//     </AppLayout>
//   );
// }