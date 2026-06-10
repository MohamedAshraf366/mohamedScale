import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Target, Plus, Pin, MoreHorizontal, Copy, CalendarClock,
  Search as SearchIcon, Handshake, FileText, Scale, Trophy, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  StageBadge, InterestBadge, ActivityIndicator, DateCell, CodeCell,
  INTEREST_CHIP_COLORS,
} from "@/components/shared/TableCellRenderers";
import {
  DataTableToolbar,
  type SortOption,
  type FilterColumnDef,
  type SmartFilterRule,
} from "@/components/shared/DataTableToolbar";
import { GlobalActivitySheet, type GlobalActivityContext } from "@/components/global/GlobalActivitySheet";
import { format, differenceInDays, isPast, isToday } from "date-fns";

type PipelineSortColumn =
  | "title"
  | "customer"
  | "project"
  | "stage"
  | "interest"
  | "value"
  | "created_at"
  | "last_activity"
  | "next_followup"
  | "expected_close_date";

type SortDirection = "asc" | "desc";

interface PipelineFilterState {
  searchQuery: string;
  stageFilters: string[];
  interestFilters: string[];
  sortColumn: PipelineSortColumn;
  sortDirection: SortDirection;
  showClosedStages: boolean;
}

const STAGES = ["discovery", "rfp", "negotiation", "won", "lost"] as const;
const INTEREST_LEVELS = ["High", "Medium", "Low", "Not interested"] as const;
const DEFAULT_HIDDEN_STAGES = new Set(["won", "lost"]);
const PIPELINE_FILTERS_STORAGE_KEY = "sales_pipeline_filters_v2";
const DEFAULT_SORT: SortOption = { column: "last_activity", direction: "desc" };
const SORT_COLUMNS: { value: string; label: string }[] = [
  { value: "last_activity", label: "Last activity" },
  { value: "next_followup", label: "Next follow-up" },
  { value: "created_at", label: "Date added" },
  { value: "expected_close_date", label: "Expected close date" },
  { value: "value", label: "Quoted value" },
  { value: "title", label: "Title" },
  { value: "customer", label: "Customer" },
  { value: "project", label: "Project" },
  { value: "stage", label: "Stage" },
  { value: "interest", label: "Interest" },
];

const PIPELINE_FILTER_COLUMNS: FilterColumnDef[] = [
  { id: "visibility", label: "Visibility", type: "select", options: [
    { value: "Hide closed", label: "Hide closed" },
  ]},
  { id: "stage", label: "Stage", type: "select", options: [
    { value: "discovery", label: "Discovery" },
    { value: "rfp", label: "RFP" },
    { value: "negotiation", label: "Negotiation" },
    { value: "won", label: "Won" },
    { value: "lost", label: "Lost" },
  ]},
  { id: "interest", label: "Interest", type: "select", options: [
    { value: "High", label: "High" },
    { value: "Medium", label: "Medium" },
    { value: "Low", label: "Low" },
    { value: "Not interested", label: "Not Interested" },
  ]},
  { id: "customer", label: "Customer", type: "text" },
  { id: "project", label: "Project", type: "text" },
  { id: "source", label: "Source", type: "text" },
  { id: "priority", label: "Priority", type: "select", options: [
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ]},
];

function isSortColumn(value: string | null): value is PipelineSortColumn {
  return !!value && SORT_COLUMNS.some((o) => o.value === value);
}
function isSortDirection(value: string | null): value is SortDirection {
  return value === "asc" || value === "desc";
}

function readStoredPipelineFilters(): Partial<PipelineFilterState> {
  try {
    const raw = window.localStorage?.getItem(PIPELINE_FILTERS_STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Partial<PipelineFilterState>;
    return {
      searchQuery: typeof p.searchQuery === "string" ? p.searchQuery : "",
      stageFilters: Array.isArray(p.stageFilters) ? p.stageFilters : [],
      interestFilters: Array.isArray(p.interestFilters) ? p.interestFilters : [],
      sortColumn: isSortColumn(p.sortColumn ?? null) ? p.sortColumn : undefined,
      sortDirection: isSortDirection(p.sortDirection ?? null) ? p.sortDirection : undefined,
      showClosedStages: p.showClosedStages === true,
    };
  } catch { return {}; }
}

function buildPipelineFilterState(sp: URLSearchParams): PipelineFilterState {
  const stored = readStoredPipelineFilters();
  return {
    searchQuery: sp.get("q") ?? stored.searchQuery ?? "",
    stageFilters: (sp.get("stages")?.split(",").filter(Boolean)) ?? stored.stageFilters ?? [],
    interestFilters: (sp.get("interest")?.split(",").filter(Boolean)) ?? stored.interestFilters ?? [],
    sortColumn: (isSortColumn(sp.get("sortCol")) ? sp.get("sortCol") : stored.sortColumn ?? DEFAULT_SORT.column) as PipelineSortColumn,
    sortDirection: (isSortDirection(sp.get("sortDir")) ? sp.get("sortDir") : stored.sortDirection ?? DEFAULT_SORT.direction) as SortDirection,
    showClosedStages: sp.has("showClosed") ? sp.get("showClosed") === "1" : stored.showClosedStages ?? false,
  };
}

function areSetsEqual(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function compareNullableValues(a: string | number | null | undefined, b: string | number | null | undefined, dir: SortDirection) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return dir === "asc" ? a - b : b - a;
  const r = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  return dir === "asc" ? r : -r;
}

function getQuotationValue(opp: any) {
  return ((opp.quotations ?? []) as { total: number | null }[]).reduce((s, q) => s + (Number(q.total) || 0), 0);
}

export default function Pipeline() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialFilters] = useState(() => buildPipelineFilterState(searchParams));
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [activityContext, setActivityContext] = useState<GlobalActivityContext>({ action: "create", entityType: "opportunity" });

  const [searchQuery, setSearchQuery] = useState(initialFilters.searchQuery);
  const [stageFilters, setStageFilters] = useState<Set<string>>(() => new Set(initialFilters.stageFilters));
  const [interestFilters, setInterestFilters] = useState<Set<string>>(() => new Set(initialFilters.interestFilters));
  const [sortColumn, setSortColumn] = useState<PipelineSortColumn>(initialFilters.sortColumn);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialFilters.sortDirection);
  const [showClosedStages, setShowClosedStages] = useState(initialFilters.showClosedStages);

  // Sync from URL
  useEffect(() => {
    const next = buildPipelineFilterState(searchParams);
    setSearchQuery((p) => p === next.searchQuery ? p : next.searchQuery);
    setStageFilters((p) => { const n = new Set(next.stageFilters); return areSetsEqual(p, n) ? p : n; });
    setInterestFilters((p) => { const n = new Set(next.interestFilters); return areSetsEqual(p, n) ? p : n; });
    setSortColumn((p) => p === next.sortColumn ? p : next.sortColumn);
    setSortDirection((p) => p === next.sortDirection ? p : next.sortDirection);
    setShowClosedStages((p) => p === next.showClosedStages ? p : next.showClosedStages);
  }, [searchParams]);

  // Sync to URL + localStorage
  useEffect(() => {
    const state: PipelineFilterState = {
      searchQuery, stageFilters: [...stageFilters], interestFilters: [...interestFilters],
      sortColumn, sortDirection, showClosedStages,
    };
    const params = new URLSearchParams();
    if (state.searchQuery) params.set("q", state.searchQuery);
    if (state.stageFilters.length > 0) params.set("stages", state.stageFilters.join(","));
    if (state.interestFilters.length > 0) params.set("interest", state.interestFilters.join(","));
    params.set("sortCol", state.sortColumn);
    params.set("sortDir", state.sortDirection);
    if (state.showClosedStages) params.set("showClosed", "1");
    window.localStorage?.setItem(PIPELINE_FILTERS_STORAGE_KEY, JSON.stringify(state));
    if (params.toString() !== searchParams.toString()) setSearchParams(params, { replace: true });
  }, [searchQuery, stageFilters, interestFilters, sortColumn, sortDirection, showClosedStages, searchParams, setSearchParams]);

  const toggleFilter = (set: Set<string>, value: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    setter(next);
  };

  const clearAllFilters = () => {
    setStageFilters(new Set());
    setInterestFilters(new Set());
    setSearchQuery("");
    setShowClosedStages(false);
    setSortColumn(DEFAULT_SORT.column as PipelineSortColumn);
    setSortDirection(DEFAULT_SORT.direction);
  };

  // ── Data fetching ─────────────────────────────────
  const { data: opportunities, isLoading } = useQuery({
    queryKey: ["pipeline-opportunities"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select(`
          *,
          customer:customers!opportunities_customer_account_id_fkey(
            account:accounts!customers_account_id_fkey(id, display_name)
          ),
          project:projects(id, name),
          quotations(total, status)
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

  const opportunityIds = opportunities?.map(o => o.id) || [];

  const { data: lastActivities } = useQuery({
    queryKey: ["pipeline-last-activities", opportunityIds],
    queryFn: async () => {
      if (opportunityIds.length === 0) return {};
      const { data, error } = await supabase
        .from("communications")
        .select("opportunity_id, occurred_at")
        .in("opportunity_id", opportunityIds)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach(c => { if (c.opportunity_id && !map[c.opportunity_id]) map[c.opportunity_id] = c.occurred_at; });
      return map;
    },
    enabled: opportunityIds.length > 0,
  });

  const { data: nextFollowUps } = useQuery({
    queryKey: ["pipeline-next-followups", opportunityIds],
    queryFn: async () => {
      if (opportunityIds.length === 0) return {};
      const { data, error } = await supabase
        .from("tasks")
        .select("opportunity_id, due_at, title, status")
        .in("opportunity_id", opportunityIds)
        .in("status", ["open", "pending", "in_progress"])
        .is("deleted_at", null)
        .not("due_at", "is", null)
        .order("due_at", { ascending: true });
      if (error) throw error;
      const map: Record<string, { due_at: string; title: string }> = {};
      data?.forEach(t => { if (t.opportunity_id && !map[t.opportunity_id] && t.due_at) map[t.opportunity_id] = { due_at: t.due_at, title: t.title }; });
      return map;
    },
    enabled: opportunityIds.length > 0,
  });

  // ── Filter + Sort ─────────────────────────────────
  const filtered = useMemo(() => {
    return opportunities?.filter(opp => {
      
      if (!showClosedStages && stageFilters.size === 0 && DEFAULT_HIDDEN_STAGES.has(opp.stage)) return false;
      if (stageFilters.size > 0 && !stageFilters.has(opp.stage)) return false;
      if (interestFilters.size > 0 && !interestFilters.has(opp.interest_level || "")) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const cn = opp.customer?.account?.display_name?.toLowerCase() || "";
        const pn = opp.project?.name?.toLowerCase() || "";
        if (!opp.title.toLowerCase().includes(q) && !cn.includes(q) && !pn.includes(q) && !(opp.code || "").toLowerCase().includes(q)) return false;
      }
      return true;
    }) || [];
  }, [opportunities, stageFilters, interestFilters, searchQuery, showClosedStages]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aPinned = 0;
      const bPinned = 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      switch (sortColumn) {
        case "created_at": return compareNullableValues(new Date(a.created_at).getTime(), new Date(b.created_at).getTime(), sortDirection);
        case "last_activity": return compareNullableValues(lastActivities?.[a.id] ? new Date(lastActivities[a.id]).getTime() : null, lastActivities?.[b.id] ? new Date(lastActivities[b.id]).getTime() : null, sortDirection);
        case "expected_close_date": return compareNullableValues(a.expected_close_date ? new Date(a.expected_close_date).getTime() : null, b.expected_close_date ? new Date(b.expected_close_date).getTime() : null, sortDirection);
        case "next_followup": return compareNullableValues(nextFollowUps?.[a.id]?.due_at ? new Date(nextFollowUps[a.id].due_at).getTime() : null, nextFollowUps?.[b.id]?.due_at ? new Date(nextFollowUps[b.id].due_at).getTime() : null, sortDirection);
        case "value": return compareNullableValues(getQuotationValue(a), getQuotationValue(b), sortDirection);
        case "customer": return compareNullableValues(a.customer?.account?.display_name, b.customer?.account?.display_name, sortDirection);
        case "project": return compareNullableValues(a.project?.name, b.project?.name, sortDirection);
        case "stage": return compareNullableValues(a.stage, b.stage, sortDirection);
        case "interest": return compareNullableValues(a.interest_level, b.interest_level, sortDirection);
        case "title": default: return compareNullableValues(a.title, b.title, sortDirection);
      }
    });
  }, [filtered, sortColumn, sortDirection, lastActivities, nextFollowUps]);

  // Counts for chips
  const stageCounts = useMemo(() => {
    const c: Record<string, number> = { discovery: 0, rfp: 0, negotiation: 0, won: 0, lost: 0 };
    opportunities?.forEach(o => { if (c[o.stage] !== undefined) c[o.stage]++; });
    return c;
  }, [opportunities]);

  const interestCounts = useMemo(() => {
    const c: Record<string, number> = {};
    INTEREST_LEVELS.forEach(l => { c[l] = 0; });
    opportunities?.forEach(o => { if (o.interest_level && c[o.interest_level] !== undefined) c[o.interest_level]++; });
    return c;
  }, [opportunities]);

  // No chip groups — KPI cards handle visual filtering now

  const handleDuplicate = (opp: any) => {
    const meta = opp.metadata as any;
    setActivityContext({
      action: "create",
      entityType: "opportunity",
      customerId: opp.customer_account_id,
      customerName: opp.customer?.account?.display_name,
      projectId: opp.project_id,
      projectName: opp.project?.name,
      opportunityPrefill: {
        title: `${opp.title} (copy)`,
        interestLevel: opp.interest_level || "Medium",
        contactId: opp.contact_id || "",
        notes: opp.notes || "",
        materialCategoryIds: meta?.material_category_ids || [],
      },
    });
    setShowAddSheet(true);
  };

  // Smart filters derived from stage/interest filter state + closed stages visibility
  const pipelineSmartFilters = useMemo<SmartFilterRule[]>(() => {
    const rules: SmartFilterRule[] = [];
    // Default behavior: when no stage filters and closed hidden, show as a filter
    if (!showClosedStages && stageFilters.size === 0) {
      rules.push({ id: "hide_closed", column: "visibility", value: "Hide closed" });
    }
    stageFilters.forEach(s => rules.push({ id: `stage_${s}`, column: "stage", value: s }));
    interestFilters.forEach(i => rules.push({ id: `interest_${i}`, column: "interest", value: i }));
    return rules;
  }, [stageFilters, interestFilters, showClosedStages]);

  const handleSmartFiltersChange = useCallback((newRules: SmartFilterRule[]) => {
    const newStages = new Set(newRules.filter(r => r.column === "stage").map(r => r.value));
    const newInterest = new Set(newRules.filter(r => r.column === "interest").map(r => r.value));
    setStageFilters(newStages);
    setInterestFilters(newInterest);
    // If "hide closed" badge was removed, show closed stages
    const hasHideClosed = newRules.some(r => r.column === "visibility" && r.value === "Hide closed");
    if (!hasHideClosed && !showClosedStages && stageFilters.size === 0) setShowClosedStages(true);
    // Auto-show closed stages if won/lost selected
    if (newStages.has("won") || newStages.has("lost")) setShowClosedStages(true);
  }, [showClosedStages, stageFilters]);

  const STAGE_KPI = [
    { key: "all", label: "Total", icon: Target, colorClass: "bg-primary/10 text-primary" },
    { key: "discovery", label: "Discovery", icon: SearchIcon, colorClass: "bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400" },
    { key: "rfp", label: "RFP", icon: FileText, colorClass: "bg-violet-100 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400" },
    { key: "negotiation", label: "Negotiation", icon: Scale, colorClass: "bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400" },
    { key: "won", label: "Won", icon: Trophy, colorClass: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400" },
    { key: "lost", label: "Lost", icon: XCircle, colorClass: "bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400" },
  ] as const;

  const totalNonExample = useMemo(() =>
    opportunities?.length ?? 0,
  [opportunities]);

  return (
    <AppLayout>
      <div className="space-y-5 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Pipeline</h1>
            <p className="text-sm text-muted-foreground">
              {sorted.length} active opportunit{sorted.length === 1 ? "y" : "ies"}
            </p>
          </div>
          <TooltipProvider>
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" onClick={() => {
                    setActivityContext({ action: "update", entityType: "opportunity" });
                    setShowAddSheet(true);
                  }}>
                    Add Update
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Log a call, meeting, or note on an existing opportunity</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => {
                    setActivityContext({ action: "create", entityType: "opportunity" });
                    setShowAddSheet(true);
                  }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Opportunity
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Create a new sales opportunity</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {/* KPI Cards */}
        {/* KPI Cards — grouped by column */}
        <div className="space-y-3">
          {/* Stage row */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 px-0.5">By Stage</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {STAGE_KPI.map(({ key, label, icon: Icon, colorClass }) => {
                const count = key === "all" ? totalNonExample : (stageCounts[key] || 0);
                const isActive = key === "all"
                  ? stageFilters.size === 0
                  : stageFilters.has(key);
                return (
                  <Card
                    key={key}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-sm",
                      isActive && key !== "all" && "ring-2 ring-primary/50 shadow-sm",
                    )}
                    onClick={() => {
                      if (key === "all") {
                        setStageFilters(new Set());
                        setShowClosedStages(false);
                      } else {
                        if (DEFAULT_HIDDEN_STAGES.has(key) && !showClosedStages) setShowClosedStages(true);
                        toggleFilter(stageFilters, key, setStageFilters);
                      }
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", colorClass)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xl font-bold">{count}</p>
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Interest level row */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 px-0.5">By Interest</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {INTEREST_LEVELS.map(level => {
                const count = interestCounts[level] || 0;
                const isActive = interestFilters.has(level);
                const colorMap: Record<string, string> = {
                  "High": "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400",
                  "Medium": "bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400",
                  "Low": "bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400",
                  "Not interested": "bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400",
                };
                return (
                  <Card
                    key={level}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-sm",
                      isActive && "ring-2 ring-primary/50 shadow-sm",
                    )}
                    onClick={() => toggleFilter(interestFilters, level, setInterestFilters)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", colorMap[level] || "bg-muted text-muted-foreground")}>
                          <Handshake className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xl font-bold">{count}</p>
                          <p className="text-[10px] text-muted-foreground">{level === "Not interested" ? "Not Int." : level}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* Unified Filter Bar — no chip groups, smart filters wired to state */}
        <DataTableToolbar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search title, customer, project, code..."
          filterColumns={PIPELINE_FILTER_COLUMNS}
          activeSmartFilters={pipelineSmartFilters}
          onSmartFiltersChange={handleSmartFiltersChange}
          sortOptions={SORT_COLUMNS}
          activeSort={{ column: sortColumn, direction: sortDirection }}
          defaultSort={DEFAULT_SORT}
          onSortChange={(sort) => {
            if (sort) {
              setSortColumn(sort.column as PipelineSortColumn);
              setSortDirection(sort.direction);
            } else {
              setSortColumn(DEFAULT_SORT.column as PipelineSortColumn);
              setSortDirection(DEFAULT_SORT.direction);
            }
          }}
          extraActions={
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showClosedStages ? "default" : "outline"}
                    size="sm"
                    className="h-8"
                    onClick={() => setShowClosedStages((p) => !p)}
                  >
                    Closed stages
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Show or hide Won and Lost opportunities</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          }
          onClear={clearAllFilters}
        />

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-lg border p-12 text-center text-muted-foreground">
            <Target className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p className="font-medium">No opportunities found</p>
            <p className="text-sm">
              {stageFilters.size + interestFilters.size + (searchQuery ? 1 : 0) > 0
                ? "Try adjusting your filters"
                : "Create your first opportunity to get started"}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TooltipProvider delayDuration={300}>
                    <TableRow>
                      <TableHead className="w-[80px]">Code</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>
                        <Tooltip><TooltipTrigger className="cursor-default">Stage</TooltipTrigger>
                          <TooltipContent>Sales stage: Discovery → RFP → Negotiation → Won/Lost</TooltipContent></Tooltip>
                      </TableHead>
                      <TableHead>
                        <Tooltip><TooltipTrigger className="cursor-default">Interest</TooltipTrigger>
                          <TooltipContent>Client's interest level based on last interaction</TooltipContent></Tooltip>
                      </TableHead>
                      <TableHead>
                        <Tooltip><TooltipTrigger className="cursor-default">Value</TooltipTrigger>
                          <TooltipContent>Total quoted value (sum of all quotations)</TooltipContent></Tooltip>
                      </TableHead>
                      <TableHead>
                        <Tooltip><TooltipTrigger className="cursor-default">Last Activity</TooltipTrigger>
                          <TooltipContent>Most recent communication or update</TooltipContent></Tooltip>
                      </TableHead>
                      <TableHead>
                        <Tooltip><TooltipTrigger className="cursor-default">Next Follow-Up</TooltipTrigger>
                          <TooltipContent>Earliest open task due date</TooltipContent></Tooltip>
                      </TableHead>
                      <TableHead>
                        <Tooltip><TooltipTrigger className="cursor-default">Close Date</TooltipTrigger>
                          <TooltipContent>Expected closing date for this opportunity</TooltipContent></Tooltip>
                      </TableHead>
                      <TableHead className="w-[40px]" />
                    </TableRow>
                  </TooltipProvider>
                </TableHeader>
                <TableBody>
                  {sorted.map(opp => {
                    const customerName = opp.customer?.account?.display_name || "—";
                    const projectName = opp.project?.name || "—";
                    const followUp = nextFollowUps?.[opp.id];
                    return (
                      <TableRow
                        key={opp.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => navigate(`/sales/opportunities/${opp.id}`)}
                      >
                        <TableCell><CodeCell code={opp.code} /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{opp.title}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <button className="text-sm hover:text-primary hover:underline"
                            onClick={(e) => { e.stopPropagation(); navigate(`/sales/customers/${opp.customer_account_id}`); }}>
                            {customerName}
                          </button>
                        </TableCell>
                        <TableCell>
                          <button className="text-sm hover:text-primary hover:underline"
                            onClick={(e) => { e.stopPropagation(); if (opp.project_id) navigate(`/sales/projects/${opp.project_id}`); }}>
                            {projectName}
                          </button>
                        </TableCell>
                        <TableCell><StageBadge stage={opp.stage} /></TableCell>
                        <TableCell><InterestBadge level={opp.interest_level} /></TableCell>
                        <TableCell>
                          {(() => {
                            const totalValue = getQuotationValue(opp);
                            if (totalValue === 0) return <span className="text-xs text-muted-foreground">—</span>;
                            return (
                              <span className="text-sm font-medium tabular-nums">
                                {new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(totalValue)}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell><ActivityIndicator date={lastActivities?.[opp.id] || null} /></TableCell>
                        <TableCell><FollowUpCell followUp={followUp} /></TableCell>
                        <TableCell><DateCell date={opp.expected_close_date} icon /></TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(opp); }}>
                                <Copy className="mr-2 h-3.5 w-3.5" />
                                Duplicate
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <GlobalActivitySheet
          open={showAddSheet}
          onOpenChange={setShowAddSheet}
          context={activityContext}
        />
      </div>
    </AppLayout>
  );
}

/* ─── Follow-Up Cell ─────────────────────────────── */
function FollowUpCell({ followUp }: { followUp?: { due_at: string; title: string } }) {
  if (!followUp) return <span className="text-xs text-muted-foreground">—</span>;
  const dueDate = new Date(followUp.due_at);
  const overdue = isPast(dueDate) && !isToday(dueDate);
  const today = isToday(dueDate);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex max-w-[140px] cursor-default items-center gap-1.5">
            <CalendarClock className={cn(
              "h-3.5 w-3.5 shrink-0",
              overdue ? "text-red-500" : today ? "text-amber-500" : "text-muted-foreground",
            )} />
            <span className={cn(
              "block text-xs",
              overdue ? "font-medium text-red-600" : today ? "font-medium text-amber-600" : "text-muted-foreground",
            )}>
              {overdue ? "Overdue" : today ? "Today" : format(dueDate, "MMM d")}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>{followUp.title}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
