import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import {
  MessageCircle, Phone, Users, Mail, Calendar,
  MoreHorizontal, Clock, CheckCircle2, AlertCircle,
  FileText, Target, Send, StickyNote, Trophy, XCircle, Ban, History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEntityTimeline, type EntityLevel } from "@/hooks/useEntityTimeline";

interface EntityTimelineProps {
  entityType: EntityLevel;
  entityId: string;
  entityCreatedAt?: string;
}

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  whatsapp: MessageCircle,
  call: Phone,
  in_person: Users,
  email: Mail,
  meeting: Calendar,
  sms: MoreHorizontal,
  internal: StickyNote,
  other: MoreHorizontal,
};

export function EntityTimeline({ entityType, entityId, entityCreatedAt }: EntityTimelineProps) {
  const { data: timeline, isLoading } = useEntityTimeline({ entityType, entityId, entityCreatedAt });

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
            if (item.communicationType === "status_change") {
              // Determine won vs lost from metadata via subtitle or title
              const isWon = item.title?.toLowerCase().includes("won");
              if (isWon) {
                icon = <Trophy className="h-4 w-4" />;
                iconBg = "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400";
              } else {
                icon = <Ban className="h-4 w-4" />;
                iconBg = "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400";
              }
            } else if (item.communicationType === "quotation_sent") {
              icon = <Send className="h-4 w-4" />;
              iconBg = "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400";
            } else if (item.channel === "internal" || item.communicationType === "internal_note") {
              icon = <StickyNote className="h-4 w-4" />;
              iconBg = "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400";
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
          } else if (item.type === "audit") {
            icon = <History className="h-4 w-4" />;
            iconBg = "bg-muted text-muted-foreground";
          } else {
            icon = <FileText className="h-4 w-4" />;
            iconBg = "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400";
          }

          return (
            <div key={item.id} className="relative flex gap-3 pl-0">
              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0 z-10", iconBg)}>
                {icon}
              </div>
              <div className="flex-1 min-w-0 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    {item.subtitle && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.subtitle}</p>
                    )}
                    {item.type === "communication" && item.resolvedTask && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3" />
                        <span className="font-medium">Completed:</span>
                        <span className="text-muted-foreground">{item.resolvedTask.title}</span>
                      </div>
                    )}
                    {item.type === "communication" && item.quoteChanges && (
                      <p className="text-xs text-primary/80 mt-1 flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {item.quoteChanges}
                      </p>
                    )}
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
