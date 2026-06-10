import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isPast, isTomorrow, isThisWeek, formatDistanceToNow, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar as CalendarIcon,
  Building2,
  Target,
  ChevronRight,
  Flame,
  CalendarClock,
  Inbox,
  AlertCircle,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GlobalActivitySheet } from "@/components/global/GlobalActivitySheet";
import { DataTableToolbar, type FilterColumnDef, type SmartFilterRule, type SortOption } from "@/components/shared/DataTableToolbar";
import { cn } from "@/lib/utils";



interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  task_type: string;
  due_at: string | null;
  channel: string | null;
  opportunity_id: string | null;
  customer_account_id: string | null;
  supplier_account_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
  opportunity?: {
    id: string;
    title: string;
    code?: string | null;
    interest_level?: string | null;
    customer_account_id?: string;
    customer?: {
      account_id: string;
      account?: {
        display_name: string | null;
        status?: string | null;
      };
    };
    project?: {
      id: string;
      name: string;
    };
  };
  customer?: {
    account_id: string;
    account?: {
      display_name: string | null;
      status?: string | null;
    };
  };
}

type UrgencyKey = "overdue" | "today" | "tomorrow" | "thisWeek" | "later" | "noDue" | "completed";
type TaskSortColumn = "due_at" | "created_at" | "title" | "customer" | "opportunity" | "opportunity_code" | "interest_level" | "channel";
type SortDirection = "asc" | "desc";

const URGENCY_CONFIG: Record<UrgencyKey, {
  label: string;
  icon: React.ElementType;
  color: string;
  dotColor: string;
}> = {
  overdue: {
    label: "Overdue",
    icon: Flame,
    color: "text-destructive",
    dotColor: "bg-destructive",
  },
  today: {
    label: "Due Today",
    icon: AlertTriangle,
    color: "text-amber-600 dark:text-amber-400",
    dotColor: "bg-amber-500",
  },
  tomorrow: {
    label: "Tomorrow",
    icon: CalendarClock,
    color: "text-blue-600 dark:text-blue-400",
    dotColor: "bg-blue-500",
  },
  thisWeek: {
    label: "This Week",
    icon: CalendarIcon,
    color: "text-muted-foreground",
    dotColor: "bg-muted-foreground",
  },
  later: {
    label: "Later",
    icon: Clock,
    color: "text-muted-foreground",
    dotColor: "bg-muted-foreground/60",
  },
  noDue: {
    label: "No Due Date",
    icon: Inbox,
    color: "text-muted-foreground",
    dotColor: "bg-muted-foreground/40",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    dotColor: "bg-emerald-500",
  },
};

const TASKS_FILTERS_STORAGE_KEY = "tasks_filters_v2";
const DEFAULT_TASK_SORT: SortOption = {
  column: "due_at",
  direction: "asc",
};
const TASK_SORT_OPTIONS: { value: TaskSortColumn; label: string }[] = [
  { value: "due_at", label: "Due date" },
  { value: "created_at", label: "Created" },
  { value: "customer", label: "Customer" },
  { value: "opportunity", label: "Opportunity" },
  { value: "opportunity_code", label: "Opportunity code" },
  { value: "interest_level", label: "Interest level" },
  { value: "channel", label: "Channel" },
  { value: "title", label: "Task title" },
];

interface TaskFilterState {
  search: string;
  channel: string;
  showCompleted: boolean;
  sortColumn: TaskSortColumn;
  sortDirection: SortDirection;
}

function isTaskSortColumn(value: string | null | undefined): value is TaskSortColumn {
  return TASK_SORT_OPTIONS.some((option) => option.value === value);
}

function isSortDirection(value: string | null | undefined): value is SortDirection {
  return value === "asc" || value === "desc";
}

function readStoredTaskFilters(): Partial<TaskFilterState> {
  try {
    const raw = localStorage.getItem(TASKS_FILTERS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<TaskFilterState>;

    return {
      search: typeof parsed.search === "string" ? parsed.search : "",
      channel: typeof parsed.channel === "string" ? parsed.channel : "all",
      showCompleted: parsed.showCompleted === true,
      sortColumn: isTaskSortColumn(parsed.sortColumn) ? parsed.sortColumn : undefined,
      sortDirection: isSortDirection(parsed.sortDirection) ? parsed.sortDirection : undefined,
    };
  } catch {
    return {};
  }
}

function getTaskCustomerName(task: Task) {
  // ✅ متجيبش اسم العميل لو status = 'deleted'
  if (task.opportunity?.customer?.account?.status === 'deleted') return null;
  if (task.customer?.account?.status === 'deleted') return null;
  
  return task.opportunity?.customer?.account?.display_name || 
         task.customer?.account?.display_name || 
         null;
}


function compareNullableValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  direction: SortDirection,
) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (typeof a === "number" && typeof b === "number") {
    return direction === "asc" ? a - b : b - a;
  }

  const result = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  return direction === "asc" ? result : -result;
}

function getTaskSortValue(task: Task, column: TaskSortColumn) {
  switch (column) {
    case "due_at":
      return task.due_at ? new Date(task.due_at).getTime() : null;
    case "created_at":
      return task.created_at ? new Date(task.created_at).getTime() : null;
    case "title":
      return task.title;
    case "customer":
      return getTaskCustomerName(task);
    case "opportunity":
      return task.opportunity?.title ?? null;
    case "opportunity_code":
      return task.opportunity?.code ?? null;
    case "interest_level":
      return task.opportunity?.interest_level ?? null;
    case "channel":
      return task.channel ?? null;
    default:
      return null;
  }
}

function TasksContent() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const stored = useRef(readStoredTaskFilters()).current;
  const [showActivity, setShowActivity] = useState(false);
  const [search, setSearch] = useState(searchParams.get("q") ?? stored.search ?? "");
  const [channelFilter, setChannelFilter] = useState(searchParams.get("channel") ?? stored.channel ?? "all");
  const [showCompleted, setShowCompleted] = useState(
    searchParams.has("tab") ? searchParams.get("tab") === "done" : stored.showCompleted ?? false,
  );
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | "overdue" | "today">("all");
  const [activeSort, setActiveSort] = useState<SortOption>(() => ({
    column: (isTaskSortColumn(searchParams.get("sortCol"))
      ? searchParams.get("sortCol")
      : stored.sortColumn ?? DEFAULT_TASK_SORT.column) as TaskSortColumn,
    direction: (isSortDirection(searchParams.get("sortDir"))
      ? searchParams.get("sortDir")
      : stored.sortDirection ?? DEFAULT_TASK_SORT.direction) as SortDirection,
  }));

  const syncParams = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (channelFilter !== "all") params.set("channel", channelFilter);
    if (showCompleted) params.set("tab", "done");
    if (activeSort.column !== DEFAULT_TASK_SORT.column) params.set("sortCol", activeSort.column);
    if (activeSort.direction !== DEFAULT_TASK_SORT.direction) params.set("sortDir", activeSort.direction);

    const filterState: TaskFilterState = {
      search,
      channel: channelFilter,
      showCompleted,
      sortColumn: activeSort.column as TaskSortColumn,
      sortDirection: activeSort.direction,
    };
    localStorage.setItem(TASKS_FILTERS_STORAGE_KEY, JSON.stringify(filterState));

    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [search, channelFilter, showCompleted, activeSort, searchParams, setSearchParams]);

  useEffect(() => { syncParams(); }, [syncParams]);


  const selectFields = `
    *,
    opportunity:opportunities!tasks_opportunity_id_fkey(
      id,
      title,
      code,
      interest_level,
      customer_account_id,
      customer:customers!opportunities_customer_account_id_fkey(
        account_id,
        account:accounts!customers_account_id_fkey(display_name)
      ),
      project:projects!opportunities_project_id_fkey(id, name)
    ),
    customer:customers!tasks_customer_account_id_fkey(
      account_id,
      account:accounts!customers_account_id_fkey(display_name)
    )
  `;

// 1. جيب الـ tasks أولاً
const { data: rawOpenTasks = [], isLoading: loadingOpen } = useQuery({
  queryKey: ["sales-tasks-open"],
  refetchInterval: 60_000,
  queryFn: async () => {
    // Step 1: جيب الـ tasks الأساسية
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        description,
        status,
        priority,
        task_type,
        due_at,
        channel,
        opportunity_id,
        customer_account_id,
        supplier_account_id,
        created_at,
        metadata
      `)
      .in("status", ["open", "in_progress"])
      .is("deleted_at", null)
      .order("due_at", { ascending: true, nullsFirst: false });
      
    if (tasksError) throw tasksError;
    if (!tasks || tasks.length === 0) return [];
    
    console.log("📋 Tasks fetched:", tasks.length);
    
    // Step 2: جيب الـ opportunities للـ tasks اللي ليها opportunity_id
    const opportunityIds = tasks
      .filter(t => t.opportunity_id)
      .map(t => t.opportunity_id)
      .filter((v, i, a) => a.indexOf(v) === i);
    
    let opportunitiesMap = new Map();
    if (opportunityIds.length > 0) {
      const { data: opportunities, error: oppError } = await supabase
        .from("opportunities")
        .select(`
          id,
          title,
          code,
          interest_level,
          customer_account_id,
          project_id
        `)
        .in("id", opportunityIds);
      
      if (!oppError && opportunities) {
        // Step 3: جيب الـ customers للـ opportunities
        const customerIds = opportunities
          .map(o => o.customer_account_id)
          .filter((v, i, a) => a.indexOf(v) === i);
        
        if (customerIds.length > 0) {
          const { data: customers, error: custError } = await supabase
            .from("customers")
            .select(`
              account_id,
              account:accounts!customers_account_id_fkey(
                id,
                display_name,
                status
              )
            `)
            .in("account_id", customerIds);
          
          if (!custError && customers) {
            const customersMap = new Map();
            customers.forEach(c => {
              customersMap.set(c.account_id, c.account);
            });
            
            opportunities.forEach((opp: any) => {
              const customerAccount = customersMap.get(opp.customer_account_id);
              opp.customer = customerAccount ? {
                account_id: opp.customer_account_id,
                account: customerAccount
              } : null;
            });
          }
        }
        
        opportunities.forEach(opp => {
          opportunitiesMap.set(opp.id, opp);
        });
      }
    }
    
    // Step 4: جيب الـ customers المباشرة للـ tasks
    const directCustomerIds = tasks
      .filter(t => t.customer_account_id && !t.opportunity_id)
      .map(t => t.customer_account_id)
      .filter((v, i, a) => a.indexOf(v) === i);
    
    let directCustomersMap = new Map();
    if (directCustomerIds.length > 0) {
      const { data: customers, error: custError } = await supabase
        .from("customers")
        .select(`
          account_id,
          account:accounts!customers_account_id_fkey(
            id,
            display_name,
            status
          )
        `)
        .in("account_id", directCustomerIds);
      
      if (!custError && customers) {
        customers.forEach(c => {
          directCustomersMap.set(c.account_id, {
            account_id: c.account_id,
            account: c.account
          });
        });
      }
    }
    
    // Step 5: دمج البيانات
    const enrichedTasks = tasks.map(task => ({
      ...task,
      opportunity: task.opportunity_id ? opportunitiesMap.get(task.opportunity_id) : null,
      customer: task.customer_account_id && !task.opportunity_id 
        ? directCustomersMap.get(task.customer_account_id) 
        : null
    }));
    
    console.log("✅ Enriched tasks count:", enrichedTasks.length);
    return enrichedTasks as Task[];
  },
});

const { data: rawDoneTasks = [], isLoading: loadingDone } = useQuery({
  queryKey: ["sales-tasks-done"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select(`
        *,
        opportunity:opportunities!tasks_opportunity_id_fkey(
          id,
          title,
          code,
          interest_level,
          customer_account_id,
          customer:customers!opportunities_customer_account_id_fkey(
            account_id,
            account:accounts!customers_account_id_fkey(
              id,
              display_name,
              status
            )
          ),
          project:projects!opportunities_project_id_fkey(id, name)
        ),
        customer:customers!tasks_customer_account_id_fkey(
          account_id,
          account:accounts!customers_account_id_fkey(
            id,
            display_name,
            status
          )
        )
      `)
      .eq("status", "done")
      .is("tasks.deleted_at", null)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(100);

    if (error) throw error;
    return (data || []) as Task[];
  },
});

// ✅ تصفية المهام - استبعد اللي status بتاعها = 'deleted'
const tasks = useMemo(() => {
  const sourceTasks = showCompleted ? rawDoneTasks : rawOpenTasks;
  return sourceTasks.filter(task => {
    if (!task.customer_account_id) return true;
    // استبعد لو customer status = 'deleted'
    if (task.opportunity?.customer?.account?.status === 'deleted') return false;
    if (task.customer?.account?.status === 'deleted') return false;
    return true;
  });
}, [rawOpenTasks, rawDoneTasks, showCompleted]);
   const isLoading = showCompleted ? loadingDone : loadingOpen;


  const channelFilterColumns = useMemo<FilterColumnDef[]>(() => {
    const channels = Array.from(
      new Set(
        [...rawOpenTasks, ...rawDoneTasks]
          .map((task) => task.channel)
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b));

    return [
      { id: "urgency", label: "Urgency", type: "select" as const, options: [
        { value: "overdue", label: "Overdue" },
        { value: "today", label: "Due Today" },
      ]},
      { id: "tab", label: "Tab", type: "select" as const, options: [
        { value: "open", label: "Open" },
        { value: "done", label: "Done" },
      ]},
      {
        id: "channel",
        label: "Channel",
        type: "select" as const,
        options: channels.map((channel) => ({ value: channel, label: channel })),
      },
      { id: "customer", label: "Customer", type: "text" as const },
      { id: "opportunity", label: "Opportunity", type: "text" as const },
      { id: "interest_level", label: "Interest Level", type: "select" as const, options: [
        { value: "High", label: "High" },
        { value: "Medium", label: "Medium" },
        { value: "Low", label: "Low" },
      ]},
      { id: "status", label: "Status", type: "select" as const, options: [
        { value: "open", label: "Open" },
        { value: "in_progress", label: "In Progress" },
        { value: "done", label: "Done" },
      ]},
    ];
  }, [rawOpenTasks, rawDoneTasks]);

  // Build unified smart filter rules from all filter state
  const allSmartFilters = useMemo<SmartFilterRule[]>(() => {
    const rules: SmartFilterRule[] = [];
    if (urgencyFilter !== "all") rules.push({ id: "urg_0", column: "urgency", value: urgencyFilter });
    if (showCompleted) rules.push({ id: "tab_0", column: "tab", value: "done" });
    if (channelFilter !== "all") rules.push({ id: "ch_0", column: "channel", value: channelFilter });
    return rules;
  }, [urgencyFilter, showCompleted, channelFilter]);

  const handleSmartFiltersChange = useCallback((rules: SmartFilterRule[]) => {
    const urg = rules.find(r => r.column === "urgency");
    setUrgencyFilter(urg ? urg.value as "overdue" | "today" : "all");
    const tab = rules.find(r => r.column === "tab");
    setShowCompleted(tab?.value === "done");
    const ch = rules.find(r => r.column === "channel");
    setChannelFilter(ch ? ch.value : "all");
  }, []);

  const filtered = useMemo(() => {
    let list = [...tasks];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((task) => {
        const customerName = getTaskCustomerName(task)?.toLowerCase() ?? "";
        const opportunityTitle = task.opportunity?.title?.toLowerCase() ?? "";
        const opportunityCode = task.opportunity?.code?.toLowerCase() ?? "";

        return (
          task.title.toLowerCase().includes(q) ||
          customerName.includes(q) ||
          opportunityTitle.includes(q) ||
          opportunityCode.includes(q)
        );
      });
    }

    if (channelFilter !== "all") {
      list = list.filter((task) => task.channel === channelFilter);
    }

    // Urgency filter from KPI cards
    if (urgencyFilter === "overdue") {
      list = list.filter((task) => task.due_at && isPast(new Date(task.due_at)) && !isToday(new Date(task.due_at)));
    } else if (urgencyFilter === "today") {
      list = list.filter((task) => task.due_at && isToday(new Date(task.due_at)));
    }

    const uniqueTasks = new Map<string, Task>();
  for (const task of list) {
    if (!uniqueTasks.has(task.id)) {
      uniqueTasks.set(task.id, task);
    }
  }
  list = Array.from(uniqueTasks.values());

  // ✅ Log التحقق
  if (uniqueTasks.size !== tasks.length) {
    console.warn(`⚠️ Removed ${tasks.length - uniqueTasks.size} duplicate tasks`);
  }

  return list.sort((a, b) => compareNullableValues(
    getTaskSortValue(a, activeSort.column as TaskSortColumn),
    getTaskSortValue(b, activeSort.column as TaskSortColumn),
    activeSort.direction,
  ));
}, [tasks, search, channelFilter, urgencyFilter, activeSort]);
console.log("🔴 filtered count AFTER:", filtered.length);
console.log("🔴 filtered first 3 tasks:", filtered.slice(0, 3).map(t => ({ id: t.id, title: t.title, due_at: t.due_at, status: t.status })));


  const grouped = useMemo(() => {
  
    const g: Record<UrgencyKey, Task[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
      noDue: [],
      completed: [],
    };

    for (const task of filtered) {
      if (task.status === "done") {
        g.completed.push(task);
      } else if (task.due_at && isPast(new Date(task.due_at)) && !isToday(new Date(task.due_at))) {
        g.overdue.push(task);
      } else if (task.due_at && isToday(new Date(task.due_at))) {
        g.today.push(task);
      } else if (task.due_at && isTomorrow(new Date(task.due_at))) {
        g.tomorrow.push(task);
      } else if (
        task.due_at &&
        isThisWeek(new Date(task.due_at)) &&
        !isToday(new Date(task.due_at)) &&
        !isTomorrow(new Date(task.due_at)) &&
        !isPast(new Date(task.due_at))
      ) {
        g.thisWeek.push(task);
      } else if (task.due_at && !isPast(new Date(task.due_at))) {
        g.later.push(task);
      } else if (!task.due_at) {
        g.noDue.push(task);
      }
    }

    return g;
  }, [filtered]);
// بعد const grouped = useMemo(() => {...})
console.log("📊 grouped AFTER:", {
  overdue: grouped.overdue.length,
  today: grouped.today.length,
  tomorrow: grouped.tomorrow.length,
  thisWeek: grouped.thisWeek.length,
  later: grouped.later.length,
  noDue: grouped.noDue.length,
  completed: grouped.completed.length,
});

console.log("📊 showCompleted:", showCompleted);
console.log("⏳ isLoading:", isLoading);

  // KPI counts always reflect full unfiltered data
const openCount = rawOpenTasks.length;
const overdueCount = useMemo(() =>
  filtered.filter(t => t.due_at && isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at))).length,
[filtered]);
const todayCount = useMemo(() =>
  filtered.filter(t => t.due_at && isToday(new Date(t.due_at))).length,
[filtered]);


  const completedCount = rawDoneTasks.length;

  const visibleSections: UrgencyKey[] = showCompleted
    ? ["completed"]
    : ["overdue", "today", "tomorrow", "thisWeek", "later", "noDue"];

  return (
  <div className="flex min-h-0 flex-1 flex-col">
    <div className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-lg">
      <div className="px-6 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Tasks</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {openCount} open · {completedCount} done
            </p>
          </div>
          <Button size="sm" onClick={() => setShowActivity(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Log Activity
          </Button>
        </div>

        {/* KPI Cards - مبسطة */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="cursor-pointer" onClick={() => { setShowCompleted(false); setUrgencyFilter("all"); }}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold">{openCount}</p>
                  <p className="text-[10px] text-muted-foreground">Open</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer" onClick={() => { setShowCompleted(false); setUrgencyFilter("overdue"); }}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <Flame className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <p className="text-xl font-bold">{overdueCount}</p>
                  <p className="text-[10px] text-muted-foreground">Overdue</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer" onClick={() => { setShowCompleted(false); setUrgencyFilter("today"); }}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xl font-bold">{todayCount}</p>
                  <p className="text-[10px] text-muted-foreground">Due Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer" onClick={() => { setShowCompleted(true); setUrgencyFilter("all"); }}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xl font-bold">{completedCount}</p>
                  <p className="text-[10px] text-muted-foreground">Done</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DataTableToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search tasks..."
          filterColumns={channelFilterColumns}
          activeSmartFilters={allSmartFilters}
          onSmartFiltersChange={handleSmartFiltersChange}
          sortOptions={TASK_SORT_OPTIONS}
          activeSort={activeSort}
          defaultSort={DEFAULT_TASK_SORT}
          onSortChange={(sort) => setActiveSort(sort ?? DEFAULT_TASK_SORT)}
          onClear={() => {
            setSearch("");
            setChannelFilter("all");
            setUrgencyFilter("all");
            setActiveSort(DEFAULT_TASK_SORT);
          }}
        />
      </div>
    </div>

    {/* ✅ قسم عرض الـ Tasks - مبسط جداً */}
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue Section */}
          {grouped.overdue && grouped.overdue.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 px-1">
                <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                <span className="text-xs font-semibold uppercase tracking-wider text-destructive">
                  Overdue ({grouped.overdue.length})
                </span>
              </div>
              <div className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/50 bg-card">
                {grouped.overdue.map((task, index) => (
  <TaskRow 
    key={`overdue-${task.id}-${index}`}  // ✅ مفتاح فريد
    task={task} 
    navigate={navigate} 
  />
))}
              </div>
            </div>
          )}

          {/* Today Section */}
          {grouped.today && grouped.today.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 px-1">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Due Today ({grouped.today.length})
                </span>
              </div>
              <div className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/50 bg-card">
                {grouped.today.map((task) => (
                  <TaskRow key={task.id} task={task} navigate={navigate} />
                ))}
              </div>
            </div>
          )}

          {/* باقي الـ sections بنفس الطريقة... */}
          {grouped.tomorrow && grouped.tomorrow.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 px-1">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Tomorrow ({grouped.tomorrow.length})
                </span>
              </div>
              <div className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/50 bg-card">
                {grouped.tomorrow.map((task) => (
                  <TaskRow key={task.id} task={task} navigate={navigate} />
                ))}
              </div>
            </div>
          )}

          {grouped.thisWeek && grouped.thisWeek.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 px-1">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  This Week ({grouped.thisWeek.length})
                </span>
              </div>
              <div className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/50 bg-card">
                {grouped.thisWeek.map((task) => (
                  <TaskRow key={task.id} task={task} navigate={navigate} />
                ))}
              </div>
            </div>
          )}

          {grouped.later && grouped.later.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 px-1">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Later ({grouped.later.length})
                </span>
              </div>
              <div className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/50 bg-card">
                {grouped.later.map((task) => (
                  <TaskRow key={task.id} task={task} navigate={navigate} />
                ))}
              </div>
            </div>
          )}

          {grouped.noDue && grouped.noDue.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 px-1">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  No Due Date ({grouped.noDue.length})
                </span>
              </div>
              <div className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/50 bg-card">
                {grouped.noDue.map((task) => (
                  <TaskRow key={task.id} task={task} navigate={navigate} />
                ))}
              </div>
            </div>
          )}

          {(!grouped.overdue?.length && !grouped.today?.length && !grouped.tomorrow?.length && 
            !grouped.thisWeek?.length && !grouped.later?.length && !grouped.noDue?.length) && (
            <div className="py-16 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500/40" />
              <p className="text-sm font-medium">All caught up!</p>
              <p className="mt-1 text-xs text-muted-foreground">No open tasks to show</p>
            </div>
          )}
        </div>
      )}
    </div>

    <GlobalActivitySheet
      open={showActivity}
      onOpenChange={setShowActivity}
      context={{ action: "create", entityType: "customer" }}
    />
  </div>
);
}



function TaskRow({
  task,
  navigate,
}: {
  task: Task;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [newDueDate, setNewDueDate] = useState<Date | undefined>(task.due_at ? new Date(task.due_at) : undefined);
  const [editReason, setEditReason] = useState("");

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editReason.trim()) throw new Error("Please provide a reason for the change");
      const { error } = await supabase.from("tasks").update({
        due_at: newDueDate?.toISOString() || null,
      }).eq("id", task.id);
      if (error) throw error;
      await supabase.from("communications").insert({
        account_id: task.customer_account_id,
        opportunity_id: task.opportunity_id,
        channel: "internal",
        summary: `Task "${task.title}" rescheduled: ${editReason.trim()}`,
        metadata: { context_type: "internal_note", type: "task_edit", task_id: task.id },
      });
    },
    onSuccess: () => {
      toast.success("Task updated");
      queryClient.invalidateQueries({ queryKey: ["sales-tasks-open"] });
      queryClient.invalidateQueries({ queryKey: ["sales-tasks-done"] });
      queryClient.invalidateQueries({ queryKey: ["entity-timeline"] });
      setEditOpen(false);
      setEditReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isOverdue =
    task.status !== "done" &&
    task.due_at &&
    isPast(new Date(task.due_at)) &&
    !isToday(new Date(task.due_at));
  const isDone = task.status === "done";
  
  // ✅ التحقق من صحة العميل فقط
  const customerName = getTaskCustomerName(task);
  const isValidCustomer = customerName !== null && customerName.trim() !== '';
  const hasValidCustomer = task.customer_account_id && isValidCustomer;
  
  // ✅ الصف قابل للنقر فقط إذا كان هناك عميل صالح
  const isClickable = hasValidCustomer;

  // ✅ عند النقر: يودي إلى صفحة العميل مباشرة
  const handleRowClick = () => {
    if (!isClickable) {
      toast.error("Customer not found or has invalid display name");
      return;
    }
    
    navigate(`/sales/customers/${task.customer_account_id}`);
  };

  const opportunityCode = task.opportunity?.code ?? null;
  const opportunityInterest = task.opportunity?.interest_level ?? null;

  return (
    <div className={cn(
      "group flex items-center gap-3 transition-colors hover:bg-muted/50",
      isOverdue && "bg-destructive/[0.03]",
      !isClickable && "opacity-60"
    )}>
      <button
        className={cn(
          "flex flex-1 items-center gap-3 px-4 py-3 text-left",
          !isClickable && "cursor-not-allowed"
        )}
        onClick={handleRowClick}
        disabled={!isClickable}
      >
        <div
          className={cn(
            "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            isDone
              ? "border-emerald-500 bg-emerald-500"
              : isOverdue
              ? "border-destructive"
              : "border-border group-hover:border-muted-foreground",
          )}
        >
          {isDone && <CheckCircle2 className="h-3 w-3 text-white" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "truncate text-sm font-medium",
                isDone && "text-muted-foreground line-through",
              )}
            >
              {task.title}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2.5">
            {opportunityCode && (
              <span className="flex-shrink-0 font-mono text-[10px] text-muted-foreground/70">
                {opportunityCode}
              </span>
            )}
            {customerName && (
              <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{customerName}</span>
              </span>
            )}
            {!isValidCustomer && task.customer_account_id && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                <span>Customer missing</span>
              </span>
            )}
            {task.opportunity?.title && (
              <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                <Target className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{task.opportunity.title}</span>
              </span>
            )}
            {opportunityInterest && (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                {opportunityInterest}
              </Badge>
            )}
            {task.channel && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                {task.channel}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {task.due_at && (
            <span
              className={cn(
                "text-xs tabular-nums",
                isOverdue
                  ? "font-medium text-destructive"
                  : isToday(new Date(task.due_at))
                  ? "font-medium text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground",
              )}
            >
              {isOverdue
                ? formatDistanceToNow(new Date(task.due_at), { addSuffix: true })
                : isToday(new Date(task.due_at))
                ? "Today"
                : isTomorrow(new Date(task.due_at))
                ? "Tomorrow"
                : format(new Date(task.due_at), "MMM d")}
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
        </div>
      </button>

      {!isDone && (
        <Popover open={editOpen} onOpenChange={setEditOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              title="Reschedule task"
              className="mr-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <CalendarClock className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-2 border-b p-3">
              <Label className="text-xs text-muted-foreground">Reschedule task</Label>
              <div className="flex gap-1.5">
                {[
                  { label: "Tomorrow", d: addDays(new Date(), 1) },
                  { label: "+3 days", d: addDays(new Date(), 3) },
                  { label: "+1 week", d: addDays(new Date(), 7) },
                ].map(({ label, d }) => (
                  <Button key={label} variant="outline" size="sm" className="h-7 text-xs"
                    onClick={() => setNewDueDate(d)}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <Calendar
              mode="single"
              selected={newDueDate}
              onSelect={setNewDueDate}
              disabled={{ before: new Date() }}
              initialFocus
            />
            <div className="space-y-2 border-t p-3">
              <Label className="text-xs text-muted-foreground">Reason for change *</Label>
              <Textarea
                placeholder="e.g. Client requested delay, waiting for documents…"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                rows={2}
                className="text-xs"
              />
              <Button
                size="sm"
                className="w-full"
                disabled={!editReason.trim() || editMutation.isPending}
                onClick={() => editMutation.mutate()}
              >
                {editMutation.isPending ? "Saving…" : "Update Task"}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
export default function Tasks() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <TasksContent />
      </AppLayout>
    </ProtectedRoute>
  );
}
