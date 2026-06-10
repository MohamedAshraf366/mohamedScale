import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ListTodo, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";

interface CustomerTasksTabProps {
  customerId: string;
}

const priorityColors: Record<string, string> = {
  high: "border-red-500 text-red-600",
  medium: "border-yellow-500 text-yellow-600",
  low: "border-gray-400 text-gray-500",
};

export function CustomerTasksTab({ customerId }: CustomerTasksTabProps) {
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["customer-tasks-full", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("customer_account_id", customerId)
        .order("due_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No tasks found for this customer
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (status: string, dueAt?: string) => {
    if (status === "completed" || status === "done") {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (dueAt && isPast(new Date(dueAt)) && !isToday(new Date(dueAt))) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const isOverdue = task.due_at && isPast(new Date(task.due_at)) && !isToday(new Date(task.due_at)) && task.status !== "completed" && task.status !== "done";
        const isDueToday = task.due_at && isToday(new Date(task.due_at));

        return (
          <Card
            key={task.id}
            className={cn(
              "hover:shadow-md transition-shadow cursor-pointer",
              isOverdue && "border-red-200 dark:border-red-900"
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center",
                    task.status === "completed" || task.status === "done"
                      ? "bg-green-100 dark:bg-green-950/50"
                      : isOverdue
                        ? "bg-red-100 dark:bg-red-950/50"
                        : "bg-muted"
                  )}>
                    {getStatusIcon(task.status, task.due_at || undefined)}
                  </div>
                  <div>
                    <div className="font-medium">{task.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className={cn("text-xs", priorityColors[task.priority])}
                      >
                        {task.priority}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {task.task_type.replace("_", " ")}
                      </Badge>
                      {task.channel && (
                        <Badge variant="outline" className="text-xs">
                          {task.channel}
                        </Badge>
                      )}
                    </div>
                    {task.description && (
                      <div className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {task.description}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <Badge
                    variant={
                      task.status === "completed" || task.status === "done"
                        ? "secondary"
                        : task.status === "open"
                          ? "default"
                          : "outline"
                    }
                  >
                    {task.status}
                  </Badge>
                  {task.due_at && (
                    <div className={cn(
                      "text-xs mt-1",
                      isOverdue ? "text-red-500 font-medium" : isDueToday ? "text-primary font-medium" : "text-muted-foreground"
                    )}>
                      {isOverdue ? "Overdue: " : isDueToday ? "Today: " : "Due: "}
                      {format(new Date(task.due_at), "MMM d, yyyy")}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
