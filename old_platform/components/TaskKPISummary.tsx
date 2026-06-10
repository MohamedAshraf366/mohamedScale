import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CalendarClock, AlertTriangle, RefreshCw 
} from 'lucide-react';
import { format, isToday, isBefore, startOfDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

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

interface TaskKPISummaryProps {
  tasks: Task[];
  onFilterDueToday: () => void;
  onFilterOverdue: () => void;
  onRefresh: () => void;
  activeFilter?: 'dueToday' | 'overdue' | null;
}

const TaskKPISummary = ({
  tasks,
  onFilterDueToday,
  onFilterOverdue,
  onRefresh,
  activeFilter
}: TaskKPISummaryProps) => {
  const today = startOfDay(new Date());

  // Filter to only active tasks (exclude Done, Closed, Completed, Cancelled)
  const activeTasks = useMemo(() => {
    return tasks.filter(t => 
      t.status_after !== 'Closed' && 
      t.status_after !== 'Done' && 
      t.status_after !== 'Completed' && 
      t.status_after !== 'Cancelled'
    );
  }, [tasks]);

  // Due Today stats
  const dueTodayStats = useMemo(() => {
    const dueTodayTasks = activeTasks.filter(t => {
      if (!t.follow_up_date) return false;
      const taskDate = parseISO(t.follow_up_date);
      return isToday(taskDate);
    });

    const highCount = dueTodayTasks.filter(t => t.priority === 'High').length;
    const mediumCount = dueTodayTasks.filter(t => t.priority === 'Medium').length;
    const lowCount = dueTodayTasks.filter(t => t.priority === 'Low' || !t.priority).length;

    return {
      total: dueTodayTasks.length,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
    };
  }, [activeTasks]);

  // Overdue stats
  const overdueStats = useMemo(() => {
    const overdueTasks = activeTasks.filter(t => {
      if (!t.follow_up_date) return false;
      const taskDate = startOfDay(parseISO(t.follow_up_date));
      return isBefore(taskDate, today);
    });

    let oldestDate: Date | null = null;
    overdueTasks.forEach(t => {
      if (t.follow_up_date) {
        const taskDate = parseISO(t.follow_up_date);
        if (!oldestDate || isBefore(taskDate, oldestDate)) {
          oldestDate = taskDate;
        }
      }
    });

    return {
      total: overdueTasks.length,
      oldestDate,
    };
  }, [activeTasks, today]);


  const kpiCards = [
    {
      id: 'dueToday',
      label: 'Due Today',
      value: dueTodayStats.total,
      icon: CalendarClock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      subtext: dueTodayStats.total > 0 
        ? `H: ${dueTodayStats.high} · M: ${dueTodayStats.medium} · L: ${dueTodayStats.low}`
        : 'No tasks due',
      onClick: onFilterDueToday,
    },
    {
      id: 'overdue',
      label: 'Overdue',
      value: overdueStats.total,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      subtext: overdueStats.oldestDate 
        ? `Oldest: ${format(overdueStats.oldestDate, 'MMM dd')}`
        : 'All caught up!',
      onClick: onFilterOverdue,
      urgent: overdueStats.total > 0,
    },
  ];

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">Quick Stats</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          className="h-8 w-8 p-0"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          const isActive = activeFilter === card.id;
          
          return (
            <Card
              key={card.id}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-md",
                card.bgColor,
                isActive && "ring-2 ring-primary ring-offset-1",
                card.urgent && "animate-pulse"
              )}
              onClick={card.onClick}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {card.label}
                    </p>
                    <p className={cn("text-2xl font-bold", card.color)}>
                      {card.value}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">
                      {card.subtext}
                    </p>
                  </div>
                  <div className={cn("p-2 rounded-lg", card.bgColor)}>
                    <Icon className={cn("h-5 w-5", card.color)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default TaskKPISummary;
