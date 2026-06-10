import { useRef, useEffect, useCallback } from 'react';

interface SwipeConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number; // Minimum distance to trigger swipe
  edgeThreshold?: number; // Distance from edge to detect edge swipes
  enabled?: boolean;
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  isEdgeSwipe: boolean;
}

export function useSwipeGesture(config: SwipeConfig) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    edgeThreshold = 30,
    enabled = true,
  } = config;

  const touchState = useRef<TouchState | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;
    
    const touch = e.touches[0];
    const isLeftEdge = touch.clientX <= edgeThreshold;
    const isRightEdge = touch.clientX >= window.innerWidth - edgeThreshold;
    
    touchState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      isEdgeSwipe: isLeftEdge || isRightEdge,
    };
  }, [enabled, edgeThreshold]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!enabled || !touchState.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchState.current.startX;
    const deltaY = touch.clientY - touchState.current.startY;
    const deltaTime = Date.now() - touchState.current.startTime;
    
    // Calculate velocity for more responsive detection
    const velocityX = Math.abs(deltaX) / deltaTime;
    const velocityY = Math.abs(deltaY) / deltaTime;
    
    // Determine if it's a horizontal or vertical swipe
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
    const isVertical = Math.abs(deltaY) > Math.abs(deltaX);
    
    // Check if swipe meets threshold (either distance or velocity)
    const meetsThreshold = Math.abs(deltaX) > threshold || velocityX > 0.5;
    const meetsVerticalThreshold = Math.abs(deltaY) > threshold || velocityY > 0.5;

    if (isHorizontal && meetsThreshold) {
      if (deltaX > 0) {
        // Swipe right - for edge swipes from left, open sidebar
        if (touchState.current.startX <= edgeThreshold) {
          onSwipeRight?.();
        } else {
          onSwipeRight?.();
        }
      } else {
        // Swipe left - close sidebar
        onSwipeLeft?.();
      }
    } else if (isVertical && meetsVerticalThreshold) {
      if (deltaY > 0) {
        onSwipeDown?.();
      } else {
        onSwipeUp?.();
      }
    }

    touchState.current = null;
  }, [enabled, threshold, edgeThreshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  const handleTouchCancel = useCallback(() => {
    touchState.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Add passive: false to allow preventDefault if needed
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [enabled, handleTouchStart, handleTouchEnd, handleTouchCancel]);
}

// Hook for element-specific swipe detection
export function useElementSwipe(
  ref: React.RefObject<HTMLElement>,
  config: SwipeConfig
) {
  const {
    onSwipeLeft,
    onSwipeRight,
    threshold = 50,
    enabled = true,
  } = config;

  const touchState = useRef<TouchState | null>(null);

  useEffect(() => {
    if (!enabled || !ref.current) return;

    const element = ref.current;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchState.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        isEdgeSwipe: false,
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchState.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchState.current.startX;
      const deltaY = touch.clientY - touchState.current.startY;

      const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);

      if (isHorizontal && Math.abs(deltaX) > threshold) {
        if (deltaX > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      }

      touchState.current = null;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [ref, enabled, threshold, onSwipeLeft, onSwipeRight]);
}
