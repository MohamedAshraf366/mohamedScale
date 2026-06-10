import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TimelineItem = {
  id: string;
  type: "communication" | "task" | "quotation" | "created" | "audit";
  action?: string | null;
  requestId?: string | null;
  occurred_at: string;
  title: string;
  subtitle?: string | null;
  channel?: string | null;
  status?: string | null;
  due_at?: string | null;
  outcome?: string | null;
  taskChannel?: string | null;
  quoteChanges?: string | null;
  completed_at?: string | null;
  resolvedTask?: {
    id: string;
    title: string;
    due_at?: string | null;
  } | null;
  communicationType?: string | null;
  // Entity context labels
  entityLabel?: string | null;
};

export type EntityLevel = "customer" | "project" | "opportunity";

interface UseEntityTimelineParams {
  entityType: EntityLevel;
  entityId: string | undefined;
  entityCreatedAt?: string;
}

export function useEntityTimeline({ entityType, entityId, entityCreatedAt }: UseEntityTimelineParams) {
  return useQuery({
    queryKey: ["entity-timeline", entityType, entityId],
    queryFn: async () => {
      if (!entityId) return [];

      // Build filter based on entity type
      let commQuery = supabase
        .from("communications")
        .select("id, occurred_at, channel, summary, outcome, metadata, account_id, project_id, opportunity_id")
        .is("deleted_at", null)
        .order("occurred_at", { ascending: false })
        .limit(100);

      let taskQuery = supabase
        .from("tasks")
        .select("id, created_at, due_at, title, status, task_type, completed_at, outcome, channel, communication_id, project_id, opportunity_id, customer_account_id")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (entityType === "customer") {
        commQuery = commQuery.eq("account_id", entityId);
        taskQuery = taskQuery.eq("customer_account_id", entityId);
      } else if (entityType === "project") {
        commQuery = commQuery.eq("project_id", entityId);
        taskQuery = taskQuery.eq("project_id", entityId);
      } else {
        commQuery = commQuery.eq("opportunity_id", entityId);
        taskQuery = taskQuery.eq("opportunity_id", entityId);
      }

      // Audit-log query: rows where entity_id == entityId (covers the entity itself)
      const auditQuery = supabase
        .from("activity_log")
        .select("id, created_at, action, entity_type, entity_id, summary, request_id")
        .eq("entity_id", entityId)
        .not("summary", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);

      const [
        { data: communications, error: commError },
        { data: tasks, error: taskError },
        { data: auditRows, error: auditError },
      ] = await Promise.all([commQuery, taskQuery, auditQuery]);

      if (commError) throw commError;
      if (taskError) throw taskError;
      if (auditError) {
        // Audit may be admin-restricted; degrade gracefully.
        console.warn("[useEntityTimeline] audit fetch failed", auditError);
      }

      // Match completed tasks to resolving communications (within 1 min)
      const taskByCompletedCommId = new Map<string, (typeof tasks)[0]>();
      const completedTaskIds = new Set<string>();

      const completedTasks = tasks?.filter(t => t.status === "done" || t.status === "completed") || [];
      completedTasks.forEach((task) => {
        if (!task.completed_at) return;
        const taskCompletedTime = new Date(task.completed_at).getTime();
        const resolvingComm = communications?.find((c) => {
          const timeDiff = Math.abs(new Date(c.occurred_at).getTime() - taskCompletedTime);
          return timeDiff < 60000;
        });
        if (resolvingComm) {
          taskByCompletedCommId.set(resolvingComm.id, task);
          completedTaskIds.add(task.id);
        }
      });

      const items: TimelineItem[] = [];

      // Communications
      communications?.forEach((c) => {
        const metadata = c.metadata as any;
        const resolvedTask = taskByCompletedCommId.get(c.id);
        items.push({
          id: c.id,
          type: "communication",
          occurred_at: c.occurred_at,
          title: c.summary || "Communication logged",
          subtitle: c.outcome,
          channel: c.channel,
          quoteChanges: metadata?.quote_changes_summary || null,
          communicationType: metadata?.type || metadata?.context_type || null,
          resolvedTask: resolvedTask ? {
            id: resolvedTask.id,
            title: resolvedTask.title || `${resolvedTask.task_type} task`,
            due_at: resolvedTask.due_at,
          } : null,
        });
      });

      // Tasks (exclude merged completed tasks)
      tasks?.forEach((t) => {
        const isCompleted = t.status === "done" || t.status === "completed";
        if (isCompleted && completedTaskIds.has(t.id)) return;
        items.push({
          id: t.id,
          type: "task",
          occurred_at: isCompleted && t.completed_at ? t.completed_at : t.created_at,
          title: t.title || `${t.task_type} task`,
          status: t.status,
          due_at: t.due_at,
          outcome: t.outcome,
          taskChannel: t.channel,
          completed_at: t.completed_at,
        });
      });

      // Audit-log entries (deduped per request_id when present, to collapse multi-table writes)
      const seenRequestIds = new Set<string>();
      auditRows?.forEach((a) => {
        if (a.request_id) {
          if (seenRequestIds.has(a.request_id)) return;
          seenRequestIds.add(a.request_id);
        }
        items.push({
          id: `audit-${a.id}`,
          type: "audit",
          occurred_at: a.created_at,
          title: a.summary || `${a.action} on ${a.entity_type}`,
          action: a.action,
          requestId: a.request_id,
        });
      });

      // Sort descending
      items.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

      // Add created marker
      if (entityCreatedAt) {
        items.push({
          id: "created",
          type: "created",
          occurred_at: entityCreatedAt,
          title: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} created`,
        });
      }

      return items;
    },
    enabled: !!entityId,
  });
}
