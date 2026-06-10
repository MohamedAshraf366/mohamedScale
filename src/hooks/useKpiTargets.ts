import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ─── Primary inputs: the only values the user edits (monthly) ─── */
export interface PrimaryInputs {
  orderingClients: number;
  engagedClients: number;
  newClients: number;
  wonDeals: number;
  pipelineCreated: number;
  revenue: number;
}

/* ─── Advanced overrides (optional, have defaults) ─── */
export interface AdvancedOverrides {
  retentionRate: number;
  revenueRetentionRate: number;
  avgCycleDays: number;
  followUpsCreated: number;
  followUpsOnTime: number;
  followUpsOverdue: number;
}

/* ─── Full target object (backward-compatible shape) ─── */
export interface KpiTargetValues {
  engagedClients: number;
  newClients: number;
  orderingClients: number;
  conversionRate: number;
  retentionRate: number;
  activationRate: number;
  pipelineCreated: number;
  wonDeals: number;
  pipelineConvRate: number;
  avgCycleDays: number;
  avgStageTimeDays: number;
  revenue: number;
  salesCount: number;
  avgSaleSize: number;
  avgOrdersPerClient: number;
  revenuePerClient: number;
  revenueRetentionRate: number;
  followUpsCreated: number;
  followUpsOnTime: number;
  followUpsOverdue: number;
}

type PeriodKey = "week" | "month" | "year";

export const DEFAULT_PRIMARY: PrimaryInputs = {
  orderingClients: 5,
  engagedClients: 30,
  newClients: 10,
  wonDeals: 10,
  pipelineCreated: 15,
  revenue: 500_000,
};

export const DEFAULT_OVERRIDES: AdvancedOverrides = {
  retentionRate: 0.6,
  revenueRetentionRate: 0.65,
  avgCycleDays: 21,
  followUpsCreated: 50,
  followUpsOnTime: 40,
  followUpsOverdue: 10,
};

/* ─── Compute derived metrics from primary inputs + overrides ─── */
export function computeDerived(p: PrimaryInputs, o: AdvancedOverrides): KpiTargetValues {
  const safe = (n: number, d: number) => (d > 0 ? n / d : 0);
  return {
    engagedClients: p.engagedClients,
    newClients: p.newClients,
    orderingClients: p.orderingClients,
    pipelineCreated: p.pipelineCreated,
    wonDeals: p.wonDeals,
    revenue: p.revenue,
    conversionRate: safe(p.orderingClients, p.engagedClients),
    activationRate: safe(p.orderingClients, p.newClients),
    pipelineConvRate: safe(p.wonDeals, p.pipelineCreated),
    avgStageTimeDays: Math.round(o.avgCycleDays / 4),
    salesCount: p.wonDeals,
    avgSaleSize: safe(p.revenue, p.wonDeals),
    avgOrdersPerClient: safe(p.wonDeals, p.orderingClients),
    revenuePerClient: safe(p.revenue, p.orderingClients),
    retentionRate: o.retentionRate,
    revenueRetentionRate: o.revenueRetentionRate,
    avgCycleDays: o.avgCycleDays,
    followUpsCreated: o.followUpsCreated,
    followUpsOnTime: o.followUpsOnTime,
    followUpsOverdue: o.followUpsOverdue,
  };
}

/* ─── Scale monthly values to a given number of days ─── */
function scaleCountByDays(monthly: number, days: number): number {
  return Math.round(monthly * days / 30);
}

function scalePrimaryByDays(m: PrimaryInputs, days: number): PrimaryInputs {
  if (days === 30) return m;
  return {
    orderingClients: scaleCountByDays(m.orderingClients, days),
    engagedClients: scaleCountByDays(m.engagedClients, days),
    newClients: scaleCountByDays(m.newClients, days),
    wonDeals: scaleCountByDays(m.wonDeals, days),
    pipelineCreated: scaleCountByDays(m.pipelineCreated, days),
    revenue: Math.round(m.revenue * days / 30),
  };
}

function scaleOverridesByDays(o: AdvancedOverrides, days: number): AdvancedOverrides {
  return {
    retentionRate: o.retentionRate,
    revenueRetentionRate: o.revenueRetentionRate,
    avgCycleDays: o.avgCycleDays,
    followUpsCreated: scaleCountByDays(o.followUpsCreated, days),
    followUpsOnTime: scaleCountByDays(o.followUpsOnTime, days),
    followUpsOverdue: scaleCountByDays(o.followUpsOverdue, days),
  };
}

const PERIOD_DAYS: Record<PeriodKey, number> = { week: 7, month: 30, year: 365 };

/* ─── Parse stored targets (supports legacy flat format + new format) ─── */
function parseStoredTargets(row: any): { primary: PrimaryInputs; overrides: AdvancedOverrides } {
  let primary = { ...DEFAULT_PRIMARY };
  let overrides = { ...DEFAULT_OVERRIDES };

  if (!row?.targets) return { primary, overrides };

  const t = row.targets as any;
  if (t.primary) {
    primary = { ...DEFAULT_PRIMARY, ...t.primary };
    overrides = { ...DEFAULT_OVERRIDES, ...t.overrides };
  } else {
    // Legacy flat format
    if (t.orderingClients !== undefined) primary.orderingClients = t.orderingClients;
    if (t.engagedClients !== undefined) primary.engagedClients = t.engagedClients;
    if (t.newClients !== undefined) primary.newClients = t.newClients;
    if (t.wonDeals !== undefined) primary.wonDeals = t.wonDeals;
    if (t.pipelineCreated !== undefined) primary.pipelineCreated = t.pipelineCreated;
    if (t.revenue !== undefined) primary.revenue = t.revenue;
    if (t.retentionRate !== undefined) overrides.retentionRate = t.retentionRate;
    if (t.revenueRetentionRate !== undefined) overrides.revenueRetentionRate = t.revenueRetentionRate;
    if (t.avgCycleDays !== undefined) overrides.avgCycleDays = t.avgCycleDays;
    if (t.followUpsCreated !== undefined) overrides.followUpsCreated = t.followUpsCreated;
    if (t.followUpsOnTime !== undefined) overrides.followUpsOnTime = t.followUpsOnTime;
    if (t.followUpsOverdue !== undefined) overrides.followUpsOverdue = t.followUpsOverdue;
  }

  return { primary, overrides };
}

export interface KpiTargetsResult extends Record<PeriodKey, KpiTargetValues> {
  _primary: PrimaryInputs;
  _overrides: AdvancedOverrides;
  /** Get targets for an arbitrary number of days (for custom date ranges) */
  forDays: (days: number) => KpiTargetValues;
}

export function useKpiTargets() {
  return useQuery<KpiTargetsResult>({
    queryKey: ["kpi-targets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_targets" as any)
        .select("period_key, targets")
        .eq("period_key", "month");
      if (error) throw error;

      const row = (data as any[])?.[0];
      const { primary, overrides } = parseStoredTargets(row);

      const result: KpiTargetsResult = {
        week: computeDerived(
          scalePrimaryByDays(primary, PERIOD_DAYS.week),
          scaleOverridesByDays(overrides, PERIOD_DAYS.week)
        ),
        month: computeDerived(primary, overrides),
        year: computeDerived(
          scalePrimaryByDays(primary, PERIOD_DAYS.year),
          scaleOverridesByDays(overrides, PERIOD_DAYS.year)
        ),
        _primary: primary,
        _overrides: overrides,
        forDays: (days: number) =>
          computeDerived(
            scalePrimaryByDays(primary, days),
            scaleOverridesByDays(overrides, days)
          ),
      };

      return result;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateKpiTargets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ primary, overrides }: { primary: PrimaryInputs; overrides: AdvancedOverrides }) => {
      const { error } = await supabase
        .from("kpi_targets" as any)
        .upsert(
          { period_key: "month", targets: { primary, overrides }, updated_at: new Date().toISOString() } as any,
          { onConflict: "period_key" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-targets"] });
      toast.success("Targets saved");
    },
    onError: (e: any) => toast.error(e.message || "Failed to save targets"),
  });
}
