import { useState, useEffect, useRef } from 'react';
import { Bell, BellRing, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, isToday, isBefore, startOfDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { toast } from 'sonner';

interface FollowUpNotification {
  id: string;
  follow_up_date: string;
  action: string | null;
  notes: string | null;
  communication_log_id: string;
  company_name: string | null;
  person_name: string | null;
  status: 'due' | 'overdue';
}

const FollowUpNotifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<FollowUpNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const sentNotificationsRef = useRef<Set<string>>(new Set());
  
  const { 
    isSupported, 
    permission, 
    requestPermission, 
    sendOverdueNotification, 
    sendDueTodayNotification 
  } = useBrowserNotifications();

  const { preferences, shouldNotify, isLoaded } = useNotificationPreferences();

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Set up real-time subscription
      const channel = supabase
        .channel('follow-up-notifications')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'follow_up_history',
          },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();

      // Check every minute for updates
      const interval = setInterval(fetchNotifications, 60000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(interval);
      };
    }
  }, [user]);

  // Send browser notifications when new overdue/due items are detected
  useEffect(() => {
    if (permission !== 'granted' || !isLoaded) return;

    notifications.forEach((notification) => {
      const notificationKey = `${notification.id}-${notification.status}`;
      
      // Only send if we haven't already sent this notification
      if (!sentNotificationsRef.current.has(notificationKey)) {
        sentNotificationsRef.current.add(notificationKey);
        
        const companyName = notification.company_name || 'Unknown Company';
        const onClick = () => {
          navigate(`/tasks?followUpId=${notification.id}`);
        };

        if (notification.status === 'overdue' && shouldNotify('overdue')) {
          sendOverdueNotification(companyName, notification.action, onClick);
        } else if (notification.status === 'due' && shouldNotify('dueToday')) {
          sendDueTodayNotification(companyName, notification.action, onClick);
        }
      }
    });
  }, [notifications, permission, isLoaded, navigate, sendOverdueNotification, sendDueTodayNotification, shouldNotify]);

  const fetchNotifications = async () => {
    const today = startOfDay(new Date());
    
    // Fetch open follow-ups that are due today or overdue
    const { data: followUps, error } = await supabase
      .from('follow_up_history')
      .select(`
        id,
        follow_up_date,
        action,
        notes,
        communication_log_id
      `)
      .eq('status_after', 'Open')
      .lte('follow_up_date', format(new Date(), 'yyyy-MM-dd'))
      .order('follow_up_date', { ascending: true });

    if (error) {
      console.error('Error fetching follow-up notifications:', error);
      return;
    }

    if (!followUps || followUps.length === 0) {
      setNotifications([]);
      return;
    }

    // Get communication details for each follow-up
    const commIds = [...new Set(followUps.map(f => f.communication_log_id))];
    const { data: communications } = await supabase
      .from('communication_log')
      .select('id, company_name, person_name')
      .in('id', commIds);

    const commMap = new Map(communications?.map(c => [c.id, c]) || []);

    const notificationsWithDetails: FollowUpNotification[] = followUps.map(f => {
      const comm = commMap.get(f.communication_log_id);
      const followUpDate = new Date(f.follow_up_date);
      const isDueToday = isToday(followUpDate);
      const isOverdue = isBefore(followUpDate, today);

      return {
        id: f.id,
        follow_up_date: f.follow_up_date,
        action: f.action,
        notes: f.notes,
        communication_log_id: f.communication_log_id,
        company_name: comm?.company_name || null,
        person_name: comm?.person_name || null,
        status: isOverdue && !isDueToday ? 'overdue' : 'due',
      };
    });

    setNotifications(notificationsWithDetails);
  };

  const handleNotificationClick = (notification: FollowUpNotification) => {
    setIsOpen(false);
    navigate(`/tasks?followUpId=${notification.id}`);
  };

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast.success('Browser notifications enabled!');
    } else {
      toast.error('Permission denied. Enable in browser settings.');
    }
  };

  const overdueCount = notifications.filter(n => n.status === 'overdue').length;
  const dueCount = notifications.filter(n => n.status === 'due').length;
  const totalCount = notifications.length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        >
          {totalCount > 0 ? (
            <BellRing className="h-5 w-5 animate-pulse" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {totalCount > 0 && (
            <span className={cn(
              "absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white",
              overdueCount > 0 ? "bg-destructive animate-pulse" : "bg-primary"
            )}>
              {totalCount > 99 ? '99+' : totalCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0" 
        align="end"
        sideOffset={8}
      >
        <div className="p-3 border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Follow-up Reminders</h4>
            <div className="flex items-center gap-1">
              {isSupported && permission !== 'granted' && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-[10px] text-primary hover:text-primary"
                  onClick={handleEnableNotifications}
                >
                  <Bell className="h-3 w-3 mr-1" />
                  Enable
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/notification-settings');
                }}
              >
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
          <div className="flex gap-2 mt-1 flex-wrap">
            {overdueCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {overdueCount} overdue
              </Badge>
            )}
            {dueCount > 0 && (
              <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary">
                {dueCount} due today
              </Badge>
            )}
            {permission === 'granted' && preferences.enableBrowserNotifications && (
              <Badge variant="outline" className="text-[10px] text-green-600 border-green-600/30">
                Alerts on
              </Badge>
            )}
          </div>
        </div>
        
        <ScrollArea className="max-h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No pending follow-ups
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "w-full p-3 text-left hover:bg-muted/50 transition-colors",
                    notification.status === 'overdue' && "bg-destructive/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {notification.company_name || 'Unknown Company'}
                      </p>
                      {notification.person_name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {notification.person_name}
                        </p>
                      )}
                      {notification.action && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {notification.action}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge 
                        variant={notification.status === 'overdue' ? 'destructive' : 'secondary'}
                        className="text-[10px] whitespace-nowrap"
                      >
                        {notification.status === 'overdue' ? 'Overdue' : 'Due Today'}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(notification.follow_up_date), 'MMM d')}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {notifications.length > 0 && (
          <div className="p-2 border-t bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                setIsOpen(false);
                navigate('/tasks');
              }}
            >
              View all tasks
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default FollowUpNotifications;
