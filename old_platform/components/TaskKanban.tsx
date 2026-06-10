import { useState } from 'react';
import { format, isToday, isBefore, startOfDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MoreHorizontal, 
  Clock,
  ArrowRight,
  GripVertical,
  CheckCircle2,
  Pencil,
  Trash2,
  ClipboardList,
  Building2,
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getChannelInfo } from '@/constants/communicationChannels';
interface Task {
  id: string;
  action: string;
  follow_up_date: string;
  created_at: string;
  status_after: string | null;
  notes: string | null;
  communication_log_id: string;
  follow_up_number?: number;
  follow_up_channel?: string | null;
  isGeneralTask?: boolean;
  priority?: string | null;
  communication_log: {
    id: string;
    company_name: string;
    contact_info: string;
    person_name: string;
    assigned_to: string | null;
    related_supplier_id: string | null;
  } | null;
}

interface TaskKanbanProps {
  tasks: Task[];
  onStatusChange: (taskId: string, newStatus: string, isGeneralTask: boolean) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onComplete: (task: Task) => void;
  onViewCommunication?: (communicationId: string) => void;
  onAddClientResponse?: (task: Task) => void;
}

const KANBAN_COLUMNS = [
  { 
    id: 'Open', 
    label: 'Open', 
    color: 'bg-amber-500',
    bgColor: 'bg-amber-500/5',
    borderColor: 'border-amber-500/20',
    textColor: 'text-amber-600'
  },
  { 
    id: 'Done', 
    label: 'Done', 
    color: 'bg-green-500',
    bgColor: 'bg-green-500/5',
    borderColor: 'border-green-500/20',
    textColor: 'text-green-600'
  },
  { 
    id: 'Cancelled', 
    label: 'Cancelled', 
    color: 'bg-red-500',
    bgColor: 'bg-red-500/5',
    borderColor: 'border-red-500/20',
    textColor: 'text-red-600'
  },
];

export function TaskKanban({ 
  tasks, 
  onStatusChange, 
  onEdit, 
  onDelete, 
  onComplete,
  onViewCommunication,
  onAddClientResponse
}: TaskKanbanProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const getTasksByStatus = (status: string) => {
    return tasks
      .filter(task => {
        const mappedStatus = task.status_after === 'Closed' || task.status_after === 'In Follow-up' 
          ? 'Done' 
          : (task.status_after || 'Open');
        return mappedStatus === status;
      })
      .sort((a, b) => new Date(b.follow_up_date).getTime() - new Date(a.follow_up_date).getTime());
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedItem(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedItem) return;

    const task = tasks.find(t => t.id === draggedItem);
    if (!task) {
      setDraggedItem(null);
      return;
    }

    const currentStatus = task.status_after === 'Closed' || task.status_after === 'In Follow-up' 
      ? 'Done' 
      : (task.status_after || 'Open');
    
    if (currentStatus === newStatus) {
      setDraggedItem(null);
      return;
    }

    onStatusChange(task.id, newStatus, !!task.isGeneralTask);
    setDraggedItem(null);
  };

  const isOverdue = (dateStr: string) => {
    return isBefore(new Date(dateStr), startOfDay(new Date()));
  };

  const isTodayDate = (dateStr: string) => {
    return isToday(new Date(dateStr));
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
      {KANBAN_COLUMNS.map((column) => {
        const columnTasks = getTasksByStatus(column.id);
        const isDropTarget = dragOverColumn === column.id;

        return (
          <div
            key={column.id}
            className={cn(
              "flex-1 min-w-[300px] max-w-[350px] rounded-xl border transition-all duration-200",
              column.bgColor,
              column.borderColor,
              isDropTarget && "ring-2 ring-primary/50 scale-[1.01]"
            )}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className="p-4 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full", column.color)} />
                  <h3 className={cn("font-semibold", column.textColor)}>
                    {column.label}
                  </h3>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {columnTasks.length}
                </Badge>
              </div>
            </div>

            {/* Column Content */}
            <ScrollArea className="h-[450px]">
              <div className="p-3 space-y-3">
                {columnTasks.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    No tasks
                  </div>
                ) : (
                  columnTasks.map((task) => {
                    const taskIsOverdue = isOverdue(task.follow_up_date) && column.id === 'Open';
                    const taskIsToday = isTodayDate(task.follow_up_date);
                    const channelInfo = task.follow_up_channel ? getChannelInfo(task.follow_up_channel) : null;

                    return (
                      <Card
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        className={cn(
                          "p-3 cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md group",
                          draggedItem === task.id && "opacity-50 scale-95",
                          taskIsOverdue && "border-destructive/50 bg-destructive/5"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground/50 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          <div className="flex-1 min-w-0">
                            {/* Task Type Badge */}
                            <div className="flex items-center gap-2 mb-2">
                              {task.isGeneralTask ? (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <ClipboardList className="h-3 w-3" />
                                  General
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <Building2 className="h-3 w-3" />
                                  Follow-up
                                </Badge>
                              )}
                            </div>

                            {/* Action/Title */}
                            <p className="font-medium text-sm line-clamp-2 mb-2">
                              {task.action || 'Task'}
                            </p>

                            {/* Company Name (for follow-ups) */}
                            {!task.isGeneralTask && task.communication_log?.company_name && (
                              <p className="text-xs text-muted-foreground mb-2 truncate">
                                {task.communication_log.company_name}
                              </p>
                            )}

                            {/* Date */}
                            <div className={cn(
                              "flex items-center gap-1.5 text-xs mb-2",
                              taskIsOverdue
                                ? "text-destructive font-medium"
                                : taskIsToday
                                ? "text-amber-600 font-medium"
                                : "text-muted-foreground"
                            )}>
                              <Clock className="h-3 w-3" />
                              {format(new Date(task.follow_up_date), 'MMM d, yyyy')}
                              {taskIsOverdue && <span>(Overdue)</span>}
                              {taskIsToday && !taskIsOverdue && <span>(Today)</span>}
                            </div>

                            {/* Channel Badge */}
                            {channelInfo && (
                              <div className="flex items-center gap-1.5 mb-2">
                                <channelInfo.icon className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">{channelInfo.label}</span>
                              </div>
                            )}

                            {/* Notes Preview */}
                            {task.notes && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {task.notes}
                              </p>
                            )}
                          </div>

                          {/* Actions Menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {column.id === 'Open' && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => onComplete(task)}
                                    className="gap-2"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Mark as Done
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem
                                onClick={() => onEdit(task)}
                                className="gap-2"
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              {!task.isGeneralTask && onViewCommunication && (
                                <DropdownMenuItem
                                  onClick={() => onViewCommunication(task.communication_log_id)}
                                  className="gap-2"
                                >
                                  View Communication
                                </DropdownMenuItem>
                              )}
                              {!task.isGeneralTask && onAddClientResponse && (
                                <DropdownMenuItem
                                  onClick={() => onAddClientResponse(task)}
                                  className="gap-2"
                                >
                                  <MessageSquare className="h-4 w-4" />
                                  Add Client Response
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {KANBAN_COLUMNS.filter(c => {
                                const currentStatus = task.status_after === 'Closed' || task.status_after === 'In Follow-up' 
                                  ? 'Done' 
                                  : (task.status_after || 'Open');
                                return c.id !== currentStatus;
                              }).map((col) => (
                                <DropdownMenuItem
                                  key={col.id}
                                  onClick={() => onStatusChange(task.id, col.id, !!task.isGeneralTask)}
                                  className="gap-2"
                                >
                                  <ArrowRight className="h-4 w-4" />
                                  Move to {col.label}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onDelete(task)}
                                className="gap-2 text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
