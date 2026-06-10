import { useState, useEffect, useCallback } from 'react';

export type NotificationPermission = 'default' | 'granted' | 'denied';

interface BrowserNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  onClick?: () => void;
}

export const useBrowserNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const supported = 'Notification' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission as NotificationPermission);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn('Browser notifications are not supported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermission);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  const sendNotification = useCallback((options: BrowserNotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      return null;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        tag: options.tag,
        requireInteraction: true,
      });

      if (options.onClick) {
        notification.onclick = () => {
          window.focus();
          options.onClick?.();
          notification.close();
        };
      }

      return notification;
    } catch (error) {
      console.error('Error sending notification:', error);
      return null;
    }
  }, [isSupported, permission]);

  const sendOverdueNotification = useCallback((
    companyName: string, 
    actionRequired: string | null,
    onClick?: () => void
  ) => {
    return sendNotification({
      title: '⚠️ Overdue Follow-up',
      body: `${companyName}: ${actionRequired || 'Action required'}`,
      tag: `overdue-${companyName}`,
      onClick,
    });
  }, [sendNotification]);

  const sendDueTodayNotification = useCallback((
    companyName: string, 
    actionRequired: string | null,
    onClick?: () => void
  ) => {
    return sendNotification({
      title: '📅 Follow-up Due Today',
      body: `${companyName}: ${actionRequired || 'Action required'}`,
      tag: `due-today-${companyName}`,
      onClick,
    });
  }, [sendNotification]);

  return {
    isSupported,
    permission,
    requestPermission,
    sendNotification,
    sendOverdueNotification,
    sendDueTodayNotification,
  };
};
