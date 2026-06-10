import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import {
  MessageCircle,
  Phone,
  Users,
  Mail,
  Calendar,
  MoreHorizontal,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Target,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface OpportunityTimelineProps {
  opportunityId: string;
  opportunityCreatedAt?: string;
}

type TimelineItem = {
  id: string;
  type: "communication" | "task" | "quotation" | "created";
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
  // Merged task info (for communications that completed a task)
  resolvedTask?: {
    id: string;
    title: string;
    due_at?: string | null;
  } | null;
  // Communication type metadata
  communicationType?: string | null;
};

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  whatsapp: MessageCircle,
  call: Phone,
  in_person: Users,
  email: Mail,
  meeting: Calendar,
  // Legacy mapping
  WA: MessageCircle,
  "Phone call": Phone,
  "In person": Users,
  Email: Mail,
  Meeting: Calendar,
  Others: MoreHorizontal,
};

export function OpportunityTimeline({ opportunityId, opportunityCreatedAt }: OpportunityTimelineProps) {
  const { data: timeline, isLoading } = useQuery({
    queryKey: ["opportunity-timeline", opportunityId],
    queryFn: async () => {
      // Fetch communications with metadata for quote changes
      const { data: communications, error: commError } = await supabase
        .from("communications")
        .select("id, occurred_at, channel, summary, outcome, metadata")
        .eq("opportunity_id", opportunityId)
        .order("occurred_at", { ascending: false });

      if (commError) throw commError;

      // Fetch tasks with outcome, channel, and completed_at fields
      const { data: tasks, error: taskError } = await supabase
        .from("tasks")
        .select("id, created_at, due_at, title, status, task_type, completed_at, outcome, channel, communication_id")
        .eq("opportunity_id", opportunityId)
        .order("created_at", { ascending: false });

      if (taskError) throw taskError;

      // Create a map of communication_id -> task that was completed by it
      const taskByCompletedCommId = new Map<string, typeof tasks[0]>();
      const completedTaskIds = new Set<string>();
      
      tasks?.forEach((t) => {
        if ((t.status === "done" || t.status === "completed") && t.communication_id) {
          // Find the communication that happened right after this task was created
          // which should be the one that completed it
          // Actually, we look for comms that happened around the completed_at time
        }
      });

      // Match completed tasks to their resolving communication
      // A communication "resolves" a task if:
      // 1. The task was completed around the same time as the communication occurred
      // 2. The communication happened AFTER the task was created
      const completedTasks = tasks?.filter(t => t.status === "done" || t.status === "completed") || [];
      
      completedTasks.forEach((task) => {
        if (!task.completed_at) return;
        
        const taskCompletedTime = new Date(task.completed_at).getTime();
        
        // Find a communication that occurred within 1 minute of task completion
        // This handles the auto-complete flow where both are saved together
        const resolvingComm = communications?.find((c) => {
          const commTime = new Date(c.occurred_at).getTime();
          const timeDiff = Math.abs(commTime - taskCompletedTime);
          return timeDiff < 60000; // 1 minute tolerance
        });

        if (resolvingComm) {
          taskByCompletedCommId.set(resolvingComm.id, task);
          completedTaskIds.add(task.id);
        }
      });

      // Build timeline items - exclude completed tasks that are merged into communications
      const items: TimelineItem[] = [];

      // Add communication events with merged task info
      communications?.forEach((c) => {
        const metadata = c.metadata as any;
        const resolvedTask = taskByCompletedCommId.get(c.id);
        
        items.push({
          id: c.id,
          type: "communication" as const,
          occurred_at: c.occurred_at,
          title: c.summary || "Communication logged",
          subtitle: c.outcome,
          channel: c.channel,
          quoteChanges: metadata?.quote_changes_summary || null,
          communicationType: metadata?.type || null,
          resolvedTask: resolvedTask ? {
            id: resolvedTask.id,
            title: resolvedTask.title || `${resolvedTask.task_type} task`,
            due_at: resolvedTask.due_at,
          } : null,
        });
      });

      // Add only OPEN tasks (not completed ones that are merged)
      tasks?.forEach((t) => {
        const isCompleted = t.status === "done" || t.status === "completed";
        
        // Skip completed tasks that are already merged into a communication
        if (isCompleted && completedTaskIds.has(t.id)) return;
        
        items.push({
          id: t.id,
          type: "task" as const,
          occurred_at: isCompleted && t.completed_at ? t.completed_at : t.created_at,
          title: t.title || `${t.task_type} task`,
          status: t.status,
          due_at: t.due_at,
          outcome: t.outcome,
          taskChannel: t.channel,
          completed_at: t.completed_at,
        });
      });

      // Sort by date descending
      items.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

      // Always add the "created" event at the end if we have a creation date
      if (opportunityCreatedAt) {
        items.push({
          id: "created",
          type: "created",
          occurred_at: opportunityCreatedAt,
          title: "Opportunity created",
        });
      }

      return items;
    },
    enabled: !!opportunityId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!timeline || timeline.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No activity yet</p>
        <p className="text-xs">Add an update to start the timeline</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

      <div className="space-y-4">
        {timeline.map((item) => {
          const ChannelIcon = item.channel ? CHANNEL_ICONS[item.channel] || MessageCircle : null;

          let icon: React.ReactNode;
          let iconBg = "bg-muted";

          if (item.type === "created") {
            icon = <Target className="h-4 w-4" />;
            iconBg = "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400";
          } else if (item.type === "communication") {
            // Special icon for quotation sent
            if (item.communicationType === "quotation_sent") {
              icon = <Send className="h-4 w-4" />;
              iconBg = "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400";
            } else {
              icon = ChannelIcon ? <ChannelIcon className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />;
              iconBg = "bg-primary/10 text-primary";
            }
          } else if (item.type === "task") {
            const isCompleted = item.status === "done" || item.status === "completed";
            const isOverdue = item.due_at && isPast(new Date(item.due_at)) && !isCompleted;
            const isDueToday = item.due_at && isToday(new Date(item.due_at));
            
            if (isCompleted) {
              icon = <CheckCircle2 className="h-4 w-4" />;
              iconBg = "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400";
            } else if (isOverdue) {
              icon = <AlertCircle className="h-4 w-4" />;
              iconBg = "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400";
            } else if (isDueToday) {
              icon = <Clock className="h-4 w-4" />;
              iconBg = "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400";
            } else {
              icon = <Clock className="h-4 w-4" />;
              iconBg = "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400";
            }
          } else {
            icon = <FileText className="h-4 w-4" />;
            iconBg = "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400";
          }

          return (
            <div key={item.id} className="relative flex gap-3 pl-0">
              {/* Icon */}
              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0 z-10", iconBg)}>
                {icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    {item.subtitle && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.subtitle}</p>
                    )}
                    {/* Show resolved task info for communications */}
                    {item.type === "communication" && item.resolvedTask && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3" />
                        <span className="font-medium">Completed:</span>
                        <span className="text-muted-foreground">{item.resolvedTask.title}</span>
                      </div>
                    )}
                    {/* Show quote changes for communications */}
                    {item.type === "communication" && item.quoteChanges && (
                      <p className="text-xs text-primary/80 mt-1 flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {item.quoteChanges}
                      </p>
                    )}
                    {/* Show outcome for standalone completed tasks */}
                    {item.type === "task" && (item.status === "done" || item.status === "completed") && item.outcome && (
                      <p className="text-xs text-muted-foreground/80 mt-1 italic line-clamp-2">
                        "{item.outcome}"
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(item.occurred_at), { addSuffix: true })}
                    </p>
                    {/* Show completed badge for standalone completed tasks */}
                    {item.type === "task" && (item.status === "done" || item.status === "completed") && (
                      <Badge variant="outline" className="text-xs mt-1 border-green-300 text-green-600 dark:border-green-700 dark:text-green-400">
                        Completed
                      </Badge>
                    )}
                    {item.type === "task" && item.due_at && item.status !== "done" && item.status !== "completed" && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs mt-1",
                          isPast(new Date(item.due_at)) && "border-destructive/50 text-destructive",
                          isToday(new Date(item.due_at)) && !isPast(new Date(item.due_at)) && "border-amber-300 text-amber-600"
                        )}
                      >
                        Due {format(new Date(item.due_at), "MMM d")}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
