import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { Bell, BellOff, BellRing, Settings } from 'lucide-react';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';
import { useToast } from '@/hooks/use-toast';
import { parseISO, isToday, isBefore, startOfDay, differenceInMinutes } from 'date-fns';
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

interface TaskNotificationManagerProps {
  tasks: Task[];
  onTaskClick?: (taskId: string) => void;
}

const NOTIFICATION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const NOTIFICATION_STORAGE_KEY = 'task-notification-settings';
const NOTIFIED_TASKS_KEY = 'notified-task-ids';

const TaskNotificationManager = ({ tasks, onTaskClick }: TaskNotificationManagerProps) => {
  const { toast } = useToast();
  const { 
    isSupported, 
    permission, 
    requestPermission, 
    sendOverdueNotification, 
    sendDueTodayNotification 
  } = useBrowserNotifications();

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    return stored ? JSON.parse(stored).enabled : false;
  });

  const [notifyOverdue, setNotifyOverdue] = useState(() => {
    const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    return stored ? JSON.parse(stored).notifyOverdue !== false : true;
  });

  const [notifyDueToday, setNotifyDueToday] = useState(() => {
    const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    return stored ? JSON.parse(stored).notifyDueToday !== false : true;
  });

  const [notifiedTaskIds, setNotifiedTaskIds] = useState<Set<string>>(() => {
    const stored = localStorage.getItem(NOTIFIED_TASKS_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify({
      enabled: notificationsEnabled,
      notifyOverdue,
      notifyDueToday,
    }));
  }, [notificationsEnabled, notifyOverdue, notifyDueToday]);

  // Save notified task IDs
  useEffect(() => {
    localStorage.setItem(NOTIFIED_TASKS_KEY, JSON.stringify([...notifiedTaskIds]));
  }, [notifiedTaskIds]);

  // Get active tasks (not closed)
  const activeTasks = tasks.filter(t => 
    t.status_after !== 'Closed' && t.status_after !== 'Completed'
  );

  const today = startOfDay(new Date());

  const overdueTasks = activeTasks.filter(t => {
    if (!t.follow_up_date) return false;
    const taskDate = startOfDay(parseISO(t.follow_up_date));
    return isBefore(taskDate, today);
  });

  const dueTodayTasks = activeTasks.filter(t => {
    if (!t.follow_up_date) return false;
    return isToday(parseISO(t.follow_up_date));
  });

  const checkAndSendNotifications = useCallback(() => {
    if (!notificationsEnabled || permission !== 'granted') return;

    const newNotifiedIds = new Set(notifiedTaskIds);

    // Notify overdue tasks
    if (notifyOverdue) {
      overdueTasks.forEach(task => {
        const notificationKey = `overdue-${task.id}`;
        if (!notifiedTaskIds.has(notificationKey)) {
          const companyName = task.isGeneralTask 
            ? 'General Task' 
            : (task.communication_log?.company_name || 'Unknown');
          
          sendOverdueNotification(
            companyName,
            task.action,
            () => onTaskClick?.(task.id)
          );
          newNotifiedIds.add(notificationKey);
        }
      });
    }

    // Notify due today tasks
    if (notifyDueToday) {
      dueTodayTasks.forEach(task => {
        const notificationKey = `today-${task.id}`;
        if (!notifiedTaskIds.has(notificationKey)) {
          const companyName = task.isGeneralTask 
            ? 'General Task' 
            : (task.communication_log?.company_name || 'Unknown');
          
          sendDueTodayNotification(
            companyName,
            task.action,
            () => onTaskClick?.(task.id)
          );
          newNotifiedIds.add(notificationKey);
        }
      });
    }

    if (newNotifiedIds.size !== notifiedTaskIds.size) {
      setNotifiedTaskIds(newNotifiedIds);
    }
  }, [
    notificationsEnabled, 
    permission, 
    notifyOverdue, 
    notifyDueToday, 
    overdueTasks, 
    dueTodayTasks, 
    notifiedTaskIds, 
    sendOverdueNotification, 
    sendDueTodayNotification,
    onTaskClick
  ]);

  // Check for notifications periodically
  useEffect(() => {
    if (!notificationsEnabled || permission !== 'granted') return;

    // Initial check
    checkAndSendNotifications();

    // Set up interval
    const interval = setInterval(checkAndSendNotifications, NOTIFICATION_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [notificationsEnabled, permission, checkAndSendNotifications]);

  const handleEnableNotifications = async () => {
    if (permission === 'denied') {
      toast({
        title: 'Notifications Blocked',
        description: 'Please enable notifications in your browser settings.',
        variant: 'destructive',
      });
      return;
    }

    if (permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        toast({
          title: 'Permission Required',
          description: 'Please allow notifications to receive task reminders.',
          variant: 'destructive',
        });
        return;
      }
    }

    setNotificationsEnabled(true);
    // Clear notified IDs to allow fresh notifications
    setNotifiedTaskIds(new Set());
    
    toast({
      title: 'Notifications Enabled',
      description: 'You will receive reminders for overdue and due today tasks.',
    });
  };

  const handleDisableNotifications = () => {
    setNotificationsEnabled(false);
    toast({
      title: 'Notifications Disabled',
      description: 'You will no longer receive task reminders.',
    });
  };

  const pendingCount = overdueTasks.length + dueTodayTasks.length;

  if (!isSupported) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={cn(
            "gap-2 relative",
            notificationsEnabled && pendingCount > 0 && "border-orange-300"
          )}
        >
          {notificationsEnabled ? (
            pendingCount > 0 ? (
              <BellRing className="h-4 w-4 text-orange-500" />
            ) : (
              <Bell className="h-4 w-4" />
            )
          ) : (
            <BellOff className="h-4 w-4 text-muted-foreground" />
          )}
          Reminders
          {notificationsEnabled && pendingCount > 0 && (
            <Badge variant="destructive" className="h-5 min-w-5 text-[10px] px-1">
              {pendingCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="font-medium">Task Reminders</span>
            </div>
            {permission === 'denied' && (
              <Badge variant="destructive" className="text-[10px]">Blocked</Badge>
            )}
          </div>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="notifications-toggle" className="text-sm">
              Enable notifications
            </Label>
            <Switch
              id="notifications-toggle"
              checked={notificationsEnabled}
              onCheckedChange={(checked) => {
                if (checked) {
                  handleEnableNotifications();
                } else {
                  handleDisableNotifications();
                }
              }}
              disabled={permission === 'denied'}
            />
          </div>

          {notificationsEnabled && (
            <>
              <div className="border-t pt-3 space-y-3">
                <p className="text-xs text-muted-foreground">Notify me about:</p>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="notify-overdue" className="text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    Overdue tasks
                  </Label>
                  <Switch
                    id="notify-overdue"
                    checked={notifyOverdue}
                    onCheckedChange={setNotifyOverdue}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="notify-today" className="text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Due today
                  </Label>
                  <Switch
                    id="notify-today"
                    checked={notifyDueToday}
                    onCheckedChange={setNotifyDueToday}
                  />
                </div>
              </div>

              {/* Current Status */}
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground mb-2">Current status:</p>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span>{overdueTasks.length} overdue</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>{dueTodayTasks.length} due today</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {permission === 'denied' && (
            <p className="text-xs text-muted-foreground">
              Notifications are blocked. Enable them in your browser settings to receive task reminders.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TaskNotificationManager;
