import { useState, useEffect, useCallback } from 'react';

export interface NotificationPreferences {
  enableBrowserNotifications: boolean;
  notifyDueToday: boolean;
  notifyOverdue: boolean;
  notifyNewFollowUps: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:mm format
  quietHoursEnd: string; // HH:mm format
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enableBrowserNotifications: true,
  notifyDueToday: true,
  notifyOverdue: true,
  notifyNewFollowUps: false,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
};

const STORAGE_KEY = 'scale-notification-preferences';

export const useNotificationPreferences = () => {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
      } catch (e) {
        console.error('Error parsing notification preferences:', e);
      }
    }
    setIsLoaded(true);
  }, []);

  const updatePreferences = useCallback((updates: Partial<NotificationPreferences>) => {
    setPreferences(prev => {
      const newPrefs = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));
      return newPrefs;
    });
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PREFERENCES));
  }, []);

  const isInQuietHours = useCallback(() => {
    if (!preferences.quietHoursEnabled) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = preferences.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = preferences.quietHoursEnd.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }, [preferences.quietHoursEnabled, preferences.quietHoursStart, preferences.quietHoursEnd]);

  const shouldNotify = useCallback((type: 'dueToday' | 'overdue' | 'newFollowUp'): boolean => {
    if (!preferences.enableBrowserNotifications) return false;
    if (isInQuietHours()) return false;

    switch (type) {
      case 'dueToday':
        return preferences.notifyDueToday;
      case 'overdue':
        return preferences.notifyOverdue;
      case 'newFollowUp':
        return preferences.notifyNewFollowUps;
      default:
        return false;
    }
  }, [preferences, isInQuietHours]);

  return {
    preferences,
    isLoaded,
    updatePreferences,
    resetPreferences,
    isInQuietHours,
    shouldNotify,
  };
};
