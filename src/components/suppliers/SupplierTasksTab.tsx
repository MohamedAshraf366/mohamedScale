import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ListTodo, Clock, CheckCircle, AlertCircle, Plus, Phone, MessageSquare, Users, Calendar } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface SupplierTasksTabProps {
  supplierAccountId: string;
}

const taskTypeIcons: Record<string, React.ReactNode> = {
  follow_up: <Phone className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
  visit: <Users className="h-4 w-4" />,
  meeting: <Users className="h-4 w-4" />,
  message: <MessageSquare className="h-4 w-4" />,
  reminder: <Calendar className="h-4 w-4" />,
};

const priorityColors: Record<string, string> = {
  high: "border-red-500 text-red-600",
  medium: "border-yellow-500 text-yellow-600",
  low: "border-gray-400 text-gray-500",
};

export function SupplierTasksTab({ supplierAccountId }: SupplierTasksTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    task_type: "follow_up",
    priority: "medium",
    channel: "",
    due_at: "",
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["supplier-tasks", supplierAccountId],
    queryFn: async () => {
      const query = supabase
        .from("tasks")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      // supplier_account_id is a new column, use filter to avoid deep type issues
      const { data, error } = await (query as any).eq("supplier_account_id", supplierAccountId);
      if (error) throw error;
      return data as any[];
    },
  });

  const createTask = useMutation({
    mutationFn: async (task: typeof newTask) => {
      const { error } = await supabase.from("tasks").insert({
        supplier_account_id: supplierAccountId,
        title: task.title,
        description: task.description || null,
        task_type: task.task_type,
        priority: task.priority,
        channel: task.channel || null,
        due_at: task.due_at || null,
        created_by: user?.id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-tasks", supplierAccountId] });
      toast.success("Task created");
      setCreateOpen(false);
      setNewTask({ title: "", description: "", task_type: "follow_up", priority: "medium", channel: "", due_at: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleComplete = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const isDone = currentStatus === "done" || currentStatus === "completed";
      const { error } = await supabase
        .from("tasks")
        .update({
          status: isDone ? "open" : "done",
          completed_at: isDone ? null : new Date().toISOString(),
          updated_by: user?.id || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-tasks", supplierAccountId] });
    },
  });

  const getStatusIcon = (status: string, dueAt?: string) => {
    if (status === "completed" || status === "done") {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (dueAt && isPast(new Date(dueAt)) && !isToday(new Date(dueAt))) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  // Split into open and completed
  const openTasks = tasks?.filter(t => t.status !== "done" && t.status !== "completed") || [];
  const completedTasks = tasks?.filter(t => t.status === "done" || t.status === "completed") || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Follow-up
        </Button>
      </div>

      {/* Timeline */}
      {tasks?.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No follow-ups yet
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Open tasks */}
          {openTasks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Open ({openTasks.length})</h3>
              <div className="relative border-l-2 border-primary/20 ml-4 space-y-4 pl-6">
                {openTasks.map((task) => {
                  const isOverdue = task.due_at && isPast(new Date(task.due_at)) && !isToday(new Date(task.due_at));
                  const isDueToday = task.due_at && isToday(new Date(task.due_at));
                  return (
                    <div key={task.id} className="relative">
                      <div className={cn(
                        "absolute -left-[31px] top-2 h-4 w-4 rounded-full border-2 bg-background",
                        isOverdue ? "border-red-500" : "border-primary"
                      )} />
                      <Card className={cn(
                        "hover:shadow-md transition-shadow",
                        isOverdue && "border-red-200 dark:border-red-900"
                      )}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1">
                              <button
                                className="mt-0.5 shrink-0"
                                onClick={() => toggleComplete.mutate({ id: task.id, currentStatus: task.status })}
                              >
                                {getStatusIcon(task.status, task.due_at || undefined)}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium">{task.title}</div>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <Badge variant="outline" className={cn("text-xs", priorityColors[task.priority])}>
                                    {task.priority}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs gap-1">
                                    {taskTypeIcons[task.task_type] || <ListTodo className="h-3 w-3" />}
                                    {task.task_type.replace("_", " ")}
                                  </Badge>
                                  {task.channel && (
                                    <Badge variant="outline" className="text-xs">{task.channel}</Badge>
                                  )}
                                </div>
                                {task.description && (
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              {task.due_at && (
                                <div className={cn(
                                  "text-xs",
                                  isOverdue ? "text-red-500 font-medium" : isDueToday ? "text-primary font-medium" : "text-muted-foreground"
                                )}>
                                  {isOverdue ? "Overdue: " : isDueToday ? "Today: " : "Due: "}
                                  {format(new Date(task.due_at), "MMM d, yyyy")}
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground mt-1">
                                {format(new Date(task.created_at), "MMM d")}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed tasks */}
          {completedTasks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Completed ({completedTasks.length})</h3>
              <div className="relative border-l-2 border-muted ml-4 space-y-3 pl-6">
                {completedTasks.map((task) => (
                  <div key={task.id} className="relative">
                    <div className="absolute -left-[31px] top-2 h-4 w-4 rounded-full border-2 border-green-500 bg-green-500/20" />
                    <Card className="opacity-70">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <button
                              className="shrink-0"
                              onClick={() => toggleComplete.mutate({ id: task.id, currentStatus: task.status })}
                            >
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </button>
                            <span className="text-sm line-through">{task.title}</span>
                            <Badge variant="secondary" className="text-xs">
                              {task.task_type.replace("_", " ")}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {task.completed_at ? format(new Date(task.completed_at), "MMM d") : ""}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Follow-up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Input
                placeholder="Title *"
                value={newTask.title}
                onChange={(e) => setNewTask(p => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select value={newTask.task_type} onValueChange={(v) => setNewTask(p => ({ ...p, task_type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["follow_up", "call", "visit", "meeting", "message", "reminder"].map(t => (
                      <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Priority</label>
                <Select value={newTask.priority} onValueChange={(v) => setNewTask(p => ({ ...p, priority: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["low", "medium", "high"].map(p => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Channel</label>
                <Select value={newTask.channel} onValueChange={(v) => setNewTask(p => ({ ...p, channel: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {["whatsapp", "phone", "email", "in_person"].map(c => (
                      <SelectItem key={c} value={c} className="capitalize">{c.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Due date</label>
                <Input
                  type="date"
                  className="mt-1"
                  value={newTask.due_at}
                  onChange={(e) => setNewTask(p => ({ ...p, due_at: e.target.value }))}
                />
              </div>
            </div>
            <Textarea
              placeholder="Notes..."
              value={newTask.description}
              onChange={(e) => setNewTask(p => ({ ...p, description: e.target.value }))}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              disabled={!newTask.title.trim() || createTask.isPending}
              onClick={() => createTask.mutate(newTask)}
            >
              {createTask.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
