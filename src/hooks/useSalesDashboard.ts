import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";


export interface DateRange {
  start: Date;
  end: Date;
}

export interface SalesDashboardData {
  clients: {
    engaged: number;
    new: number;
    ordering: number;
    conversionRate: number | null;
    retentionRate: number | null;
    activationRate: number | null;
  };
  pipeline: {
    created: number;
    createdAmount: number;
    won: number;
    wonAmount: number;
    conversionRate: number | null;
    avgCycleDays: number | null;
    avgStageTimeDays: number | null;
  };
  sales: {
    amount: number;
    count: number;
    avgSize: number | null;
    avgOrdersPerClient: number | null;
    revenuePerClient: number | null;
    revenueRetentionRate: number | null;
  };
  funnel: {
    stages: Record<string, number>;
    interestLevels: Record<string, number>;
  };
  communication: {
    created: number;
    onTime: number;
    overdue: number;
  };
}

export interface SalesDashboardResult {
  current: SalesDashboardData;
  previous: SalesDashboardData;
}

const safeDivide = (a: number, b: number): number | null =>
  b === 0 ? null : a / b;

/**
 * Calculate real average stage time from activity_log stage_change events.
 * Groups transitions by opportunity, calculates time between consecutive
 * stage changes, and averages across all transitions.
 * Falls back to avgCycleDays / 4 if no activity_log data exists yet.
 */
function calculateAvgStageTime(
  stageChanges: Array<{ entity_id: string; created_at: string; old_data: unknown; new_data: unknown }>,
  wonOpps: Array<{ id: string; created_at: string; won_at: string | null }>,
  avgCycleDaysFallback: number | null
): number | null {
  if (stageChanges.length === 0) {
    // No activity_log data yet — fall back to approximation
    return avgCycleDaysFallback !== null ? avgCycleDaysFallback / 4 : null;
  }

  // Group stage changes by opportunity
  const byOpp = new Map<string, Array<{ at: number }>>();
  stageChanges.forEach((sc) => {
    const list = byOpp.get(sc.entity_id) ?? [];
    list.push({ at: new Date(sc.created_at).getTime() });
    byOpp.set(sc.entity_id, list);
  });

  // Also add opportunity creation time as the first "stage entry" for won opps
  const oppCreatedMap = new Map(wonOpps.map((o) => [o.id, new Date(o.created_at).getTime()]));

  let totalDurationDays = 0;
  let transitionCount = 0;

  byOpp.forEach((events, oppId) => {
    // Sort by timestamp
    events.sort((a, b) => a.at - b.at);

    // Prepend creation time if available
    const createdAt = oppCreatedMap.get(oppId);
    const timeline = createdAt ? [{ at: createdAt }, ...events] : events;

    for (let i = 1; i < timeline.length; i++) {
      const durationDays = (timeline[i].at - timeline[i - 1].at) / (1000 * 60 * 60 * 24);
      if (durationDays >= 0) {
        totalDurationDays += durationDays;
        transitionCount++;
      }
    }
  });

  return transitionCount > 0 ? totalDurationDays / transitionCount : avgCycleDaysFallback !== null ? avgCycleDaysFallback / 4 : null;
}

async function fetchPeriodData(startISO: string, endISO: string, rangeStart: Date, rangeEnd: Date): Promise<SalesDashboardData> {
  // First get account IDs matching the current mode
  const { data: modeAccounts } = await supabase
    .from("accounts")
    .select("id, created_at")
    .is("deleted_at", null);
  const modeAccountIds = modeAccounts?.map(a => a.id) || [];

  const [
    commsRes,
    wonOppsRes,
    createdOppsRes,
    allWonOppsRes,
    quotationsRes,
    stageChangesRes,
    tasksRes,
  ] = await Promise.all([
    modeAccountIds.length > 0
      ? supabase
          .from("communications")
          .select("account_id")
          .gte("occurred_at", startISO)
          .lte("occurred_at", endISO)
          .is("deleted_at", null)
          .not("account_id", "is", null)
          .in("account_id", modeAccountIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    modeAccountIds.length > 0
      ? supabase
          .from("opportunities")
          .select("id, customer_account_id, created_at, won_at")
          .gte("won_at", startISO)
          .lte("won_at", endISO)
          .is("deleted_at", null)
          .in("customer_account_id", modeAccountIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    modeAccountIds.length > 0
      ? supabase
          .from("opportunities")
          .select("id, customer_account_id")
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .is("deleted_at", null)
          .in("customer_account_id", modeAccountIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    modeAccountIds.length > 0
      ? supabase
          .from("opportunities")
          .select("id, stage, interest_level, created_at")
          .is("deleted_at", null)
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .in("customer_account_id", modeAccountIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    modeAccountIds.length > 0
      ? supabase
          .from("quotations")
          .select("id, total, opportunity_id, status")
          .not("opportunity_id", "is", null)
          .in("customer_account_id", modeAccountIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    supabase
      .from("activity_log")
      .select("entity_id, created_at, old_data, new_data")
      .eq("entity_type", "opportunity")
      .eq("action", "stage_change")
      .gte("created_at", startISO)
      .lte("created_at", endISO)
      .order("created_at", { ascending: true }),
    modeAccountIds.length > 0
      ? supabase
          .from("tasks")
          .select("id, created_at, due_at, completed_at, status")
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .is("deleted_at", null)
          .in("customer_account_id", modeAccountIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);
  const accountsRes = { data: modeAccounts, error: null };

  const engagedAccountIds = new Set(
    (commsRes.data ?? []).map((c) => c.account_id).filter(Boolean)
  );
  const engaged = engagedAccountIds.size;

  const accountCreatedMap = new Map(
    (accountsRes.data ?? []).map((a) => [a.id, new Date(a.created_at)])
  );

  let newClients = 0;
  engagedAccountIds.forEach((id) => {
    const created = accountCreatedMap.get(id!);
    if (created && created >= rangeStart && created <= rangeEnd) {
      newClients++;
    }
  });

  const orderingAccountIds = new Set(
    (wonOppsRes.data ?? []).map((o) => o.customer_account_id)
  );
  const ordering = orderingAccountIds.size;

  const createdCount = createdOppsRes.data?.length ?? 0;
  const wonCount = wonOppsRes.data?.length ?? 0;

  let totalCycleDays = 0;
  let cycleCount = 0;
  (wonOppsRes.data ?? []).forEach((o) => {
    if (o.created_at && o.won_at) {
      const days =
        (new Date(o.won_at).getTime() - new Date(o.created_at).getTime()) /
        (1000 * 60 * 60 * 24);
      totalCycleDays += days;
      cycleCount++;
    }
  });

  const allQuotations = quotationsRes.data ?? [];
  const wonOppIds = new Set((wonOppsRes.data ?? []).map((o) => o.id));
  const acceptedWonQuotations = allQuotations.filter((q) =>
    q.status === "accepted" && wonOppIds.has(q.opportunity_id!)
  );
  const salesAmount = acceptedWonQuotations.reduce(
    (sum, q) => sum + (Number(q.total) || 0),
    0
  );
  const matchedQuotations = acceptedWonQuotations;

  // Amount for created opportunities: sum latest quotation per opp (any status)
  const createdOppIds = new Set((createdOppsRes.data ?? []).map((o) => o.id));
  const createdOppAmount = allQuotations
    .filter((q) => createdOppIds.has(q.opportunity_id!))
    .reduce((sum, q) => sum + (Number(q.total) || 0), 0);

  let revenueFromExisting = 0;
  (wonOppsRes.data ?? []).forEach((opp) => {
    const accountCreated = accountCreatedMap.get(opp.customer_account_id);
    if (accountCreated && accountCreated < rangeStart) {
      const oppQuotes = matchedQuotations.filter(
        (q) => q.opportunity_id === opp.id
      );
      oppQuotes.forEach((q) => {
        revenueFromExisting += Number(q.total) || 0;
      });
    }
  });

  const stages: Record<string, number> = {
    discovery: 0, rfp: 0, negotiation: 0, won: 0, lost: 0,
  };
  const interestLevels: Record<string, number> = {
    High: 0, Medium: 0, Low: 0, "Not interested": 0,
  };

  (allWonOppsRes.data ?? []).forEach((o) => {
    if (o.stage && stages.hasOwnProperty(o.stage)) stages[o.stage]++;
    if (o.interest_level && interestLevels.hasOwnProperty(o.interest_level)) interestLevels[o.interest_level]++;
  });

  const tasks = tasksRes.data ?? [];
  const tasksCreated = tasks.length;
  const now = new Date();
  let onTime = 0;
  let overdue = 0;
  tasks.forEach((t) => {
    const completedStatuses = ["completed", "done"];
    const isCompleted = completedStatuses.includes(t.status);
    if (isCompleted && t.completed_at && t.due_at) {
      if (new Date(t.completed_at) <= new Date(t.due_at)) onTime++;
    } else if (isCompleted && !t.due_at) {
      onTime++;
    }
    if (!isCompleted && t.due_at && new Date(t.due_at) < now) overdue++;
  });

  // Retention = ordering clients whose account existed BEFORE this period (i.e. repeat customers)
  // divided by total ordering clients in this period.
  let returningOrdering = 0;
  orderingAccountIds.forEach((id) => {
    const created = accountCreatedMap.get(id);
    if (created && created < rangeStart) returningOrdering++;
  });

  return {
    clients: {
      engaged,
      new: newClients,
      ordering,
      conversionRate: safeDivide(ordering, engaged),
      retentionRate: safeDivide(returningOrdering, ordering),
      activationRate: safeDivide(ordering, newClients),
    },
    pipeline: {
      created: createdCount,
      createdAmount: createdOppAmount,
      won: wonCount,
      wonAmount: salesAmount,
      conversionRate: safeDivide(wonCount, createdCount),
      avgCycleDays: cycleCount > 0 ? totalCycleDays / cycleCount : null,
      avgStageTimeDays: calculateAvgStageTime(stageChangesRes.data ?? [], wonOppsRes.data ?? [], cycleCount > 0 ? totalCycleDays / cycleCount : null),
    },
    sales: {
      amount: salesAmount,
      count: wonCount,
      avgSize: safeDivide(salesAmount, wonCount),
      avgOrdersPerClient: safeDivide(wonCount, ordering),
      revenuePerClient: safeDivide(salesAmount, ordering),
      revenueRetentionRate: safeDivide(revenueFromExisting, salesAmount),
    },
    funnel: { stages, interestLevels },
    communication: {
      created: tasksCreated,
      onTime,
      overdue,
    },
  };
}

export function useSalesDashboard(range: DateRange) {
  const startISO = range.start.toISOString();
  const endISO = range.end.toISOString();

  // Calculate previous period (same duration, immediately before)
  const durationMs = range.end.getTime() - range.start.getTime();
  const prevStart = new Date(range.start.getTime() - durationMs);
  const prevEnd = new Date(range.start.getTime());
  const prevStartISO = prevStart.toISOString();
  const prevEndISO = prevEnd.toISOString();

  return useQuery({
    queryKey: ["sales-dashboard", startISO, endISO],
    queryFn: async (): Promise<SalesDashboardResult> => {
      const [current, previous] = await Promise.all([
        fetchPeriodData(startISO, endISO, range.start, range.end),
        fetchPeriodData(prevStartISO, prevEndISO, prevStart, prevEnd),
      ]);
      return { current, previous };
    },
  });
}
