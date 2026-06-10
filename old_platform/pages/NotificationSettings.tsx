import { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Bell, BellRing, Moon, RotateCcw, Check } from 'lucide-react';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const NotificationSettings = () => {
  const { preferences, updatePreferences, resetPreferences } = useNotificationPreferences();
  const { isSupported, permission, requestPermission, sendNotification } = useBrowserNotifications();
  const [testSent, setTestSent] = useState(false);

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast.success('Browser notifications enabled!');
    } else {
      toast.error('Permission denied. Please enable in browser settings.');
    }
  };

  const handleTestNotification = () => {
    if (permission !== 'granted') {
      toast.error('Please enable browser notifications first');
      return;
    }
    
    sendNotification({
      title: '🔔 Test Notification',
      body: 'If you see this, notifications are working!',
      tag: 'test-notification',
    });
    
    setTestSent(true);
    toast.success('Test notification sent!');
    setTimeout(() => setTestSent(false), 3000);
  };

  const handleReset = () => {
    resetPreferences();
    toast.success('Preferences reset to defaults');
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Notification Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Customize how and when you receive follow-up reminders
          </p>
        </div>

        {/* Browser Permission Card */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Browser Notifications</CardTitle>
                <CardDescription>
                  Receive alerts even when the app isn't in focus
                </CardDescription>
              </div>
              <Badge 
                variant={permission === 'granted' ? 'default' : permission === 'denied' ? 'destructive' : 'secondary'}
                className={cn(
                  permission === 'granted' && 'bg-green-600'
                )}
              >
                {permission === 'granted' ? 'Enabled' : permission === 'denied' ? 'Blocked' : 'Not enabled'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isSupported ? (
              <p className="text-sm text-muted-foreground">
                Your browser doesn't support notifications.
              </p>
            ) : permission === 'denied' ? (
              <p className="text-sm text-muted-foreground">
                Notifications are blocked. Please enable them in your browser settings.
              </p>
            ) : permission !== 'granted' ? (
              <Button onClick={handleEnableNotifications} className="w-full">
                <BellRing className="h-4 w-4 mr-2" />
                Enable Browser Notifications
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleTestNotification}
                  className="flex-1"
                  disabled={testSent}
                >
                  {testSent ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-600" />
                      Sent!
                    </>
                  ) : (
                    'Send Test Notification'
                  )}
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Label htmlFor="enable-all" className="flex flex-col">
                <span>Enable notifications</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Master switch for all notifications
                </span>
              </Label>
              <Switch
                id="enable-all"
                checked={preferences.enableBrowserNotifications}
                onCheckedChange={(checked) => updatePreferences({ enableBrowserNotifications: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Alert Types Card */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Alert Types</CardTitle>
            <CardDescription>
              Choose which types of follow-ups trigger notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="notify-overdue" className="flex flex-col">
                <span className="flex items-center gap-2">
                  Overdue follow-ups
                  <Badge variant="destructive" className="text-[10px]">High priority</Badge>
                </span>
                <span className="text-xs text-muted-foreground font-normal">
                  Alert when a follow-up is past its due date
                </span>
              </Label>
              <Switch
                id="notify-overdue"
                checked={preferences.notifyOverdue}
                onCheckedChange={(checked) => updatePreferences({ notifyOverdue: checked })}
                disabled={!preferences.enableBrowserNotifications}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Label htmlFor="notify-due-today" className="flex flex-col">
                <span className="flex items-center gap-2">
                  Due today
                  <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary">Reminder</Badge>
                </span>
                <span className="text-xs text-muted-foreground font-normal">
                  Alert when a follow-up is due today
                </span>
              </Label>
              <Switch
                id="notify-due-today"
                checked={preferences.notifyDueToday}
                onCheckedChange={(checked) => updatePreferences({ notifyDueToday: checked })}
                disabled={!preferences.enableBrowserNotifications}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Label htmlFor="notify-new" className="flex flex-col">
                <span>New follow-ups assigned to me</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Alert when a new follow-up is created
                </span>
              </Label>
              <Switch
                id="notify-new"
                checked={preferences.notifyNewFollowUps}
                onCheckedChange={(checked) => updatePreferences({ notifyNewFollowUps: checked })}
                disabled={!preferences.enableBrowserNotifications}
              />
            </div>
          </CardContent>
        </Card>

        {/* Quiet Hours Card */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Moon className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-lg">Quiet Hours</CardTitle>
                <CardDescription>
                  Pause notifications during specific times
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="quiet-hours" className="flex flex-col">
                <span>Enable quiet hours</span>
                <span className="text-xs text-muted-foreground font-normal">
                  No notifications during specified time range
                </span>
              </Label>
              <Switch
                id="quiet-hours"
                checked={preferences.quietHoursEnabled}
                onCheckedChange={(checked) => updatePreferences({ quietHoursEnabled: checked })}
                disabled={!preferences.enableBrowserNotifications}
              />
            </div>

            {preferences.quietHoursEnabled && (
              <div className="flex items-center gap-4 pt-2">
                <div className="flex-1">
                  <Label htmlFor="quiet-start" className="text-xs text-muted-foreground">
                    Start time
                  </Label>
                  <Input
                    id="quiet-start"
                    type="time"
                    value={preferences.quietHoursStart}
                    onChange={(e) => updatePreferences({ quietHoursStart: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="quiet-end" className="text-xs text-muted-foreground">
                    End time
                  </Label>
                  <Input
                    id="quiet-end"
                    type="time"
                    value={preferences.quietHoursEnd}
                    onChange={(e) => updatePreferences({ quietHoursEnd: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reset Button */}
        <Button variant="outline" onClick={handleReset} className="w-full">
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
      </div>
    </Layout>
  );
};

export default NotificationSettings;
