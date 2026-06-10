import { useState, useEffect, useCallback } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

interface DeviceInfo {
  deviceType: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
  isReady: boolean;
}

// Breakpoints
const MOBILE_MAX = 767;
const TABLET_MIN = 768;
const TABLET_MAX = 1024;
const DESKTOP_MIN = 1025;

export function useDeviceType(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => {
    // Safe initial state - assume desktop to prevent layout flash
    const width = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const height = typeof window !== 'undefined' ? window.innerHeight : 800;
    
    return {
      deviceType: getDeviceType(width),
      isMobile: width <= MOBILE_MAX,
      isTablet: width >= TABLET_MIN && width <= TABLET_MAX,
      isDesktop: width >= DESKTOP_MIN,
      width: Math.max(width, 1), // Prevent 0 width
      height: Math.max(height, 1), // Prevent 0 height
      isReady: typeof window !== 'undefined',
    };
  });

  const updateDeviceInfo = useCallback(() => {
    // Safety check for SSR or unusual environments
    if (typeof window === 'undefined') return;
    
    const width = Math.max(window.innerWidth, 1);
    const height = Math.max(window.innerHeight, 1);
    const deviceType = getDeviceType(width);

    setDeviceInfo({
      deviceType,
      isMobile: width <= MOBILE_MAX,
      isTablet: width >= TABLET_MIN && width <= TABLET_MAX,
      isDesktop: width >= DESKTOP_MIN,
      width,
      height,
      isReady: true,
    });
  }, []);

  useEffect(() => {
    // Initial update
    updateDeviceInfo();

    // Debounced resize handler for performance
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateDeviceInfo, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      clearTimeout(timeoutId);
    };
  }, [updateDeviceInfo]);

  return deviceInfo;
}

function getDeviceType(width: number): DeviceType {
  if (width <= MOBILE_MAX) return 'mobile';
  if (width >= TABLET_MIN && width <= TABLET_MAX) return 'tablet';
  return 'desktop';
}

// Export constants for consistent usage
export const BREAKPOINTS = {
  MOBILE_MAX,
  TABLET_MIN,
  TABLET_MAX,
  DESKTOP_MIN,
} as const;
