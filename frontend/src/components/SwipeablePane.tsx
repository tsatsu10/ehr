/**
 * SwipeablePane — Mobile-optimized swipe gesture wrapper
 * Enables intuitive swipe navigation for mobile users
 */
import React, { useCallback } from 'react';
import { useSwipeable, SwipeableHandlers } from 'react-swipeable';
import { cn } from '@/lib/utils';

interface SwipeablePaneProps {
  /** Content to render */
  children: React.ReactNode;
  /** Callback when user swipes left */
  onSwipeLeft?: () => void;
  /** Callback when user swipes right */
  onSwipeRight?: () => void;
  /** Callback when user swipes up */
  onSwipeUp?: () => void;
  /** Callback when user swipes down */
  onSwipeDown?: () => void;
  /** Minimum swipe distance in pixels to trigger callback */
  threshold?: number;
  /** Enable/disable swipe detection */
  enabled?: boolean;
  /** Additional className */
  className?: string;
  /** ARIA label for screen readers */
  'aria-label'?: string;
}

/**
 * Swipeable container for mobile gesture navigation
 * 
 * **Gestures:**
 * - Swipe left: Navigate forward / dismiss
 * - Swipe right: Navigate back / show menu
 * - Swipe up: Show more details / scroll up
 * - Swipe down: Refresh / close drawer
 * 
 * **Accessibility:**
 * - Preserves keyboard navigation
 * - Does not interfere with scrolling
 * - Respects `prefers-reduced-motion`
 * 
 * @example
 * <SwipeablePane
 *   onSwipeLeft={() => console.log('Next')}
 *   onSwipeRight={() => console.log('Previous')}
 *   threshold={50}
 * >
 *   <div>Swipe me!</div>
 * </SwipeablePane>
 */
export function SwipeablePane({
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
  enabled = true,
  className,
  'aria-label': ariaLabel,
}: SwipeablePaneProps) {
  // Check for reduced motion preference
  const prefersReducedMotion = 
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const handlers = useSwipeable({
    onSwipedLeft: useCallback((eventData) => {
      if (enabled && !prefersReducedMotion && onSwipeLeft) {
        onSwipeLeft();
      }
    }, [enabled, prefersReducedMotion, onSwipeLeft]),
    
    onSwipedRight: useCallback((eventData) => {
      if (enabled && !prefersReducedMotion && onSwipeRight) {
        onSwipeRight();
      }
    }, [enabled, prefersReducedMotion, onSwipeRight]),
    
    onSwipedUp: useCallback((eventData) => {
      if (enabled && !prefersReducedMotion && onSwipeUp) {
        onSwipeUp();
      }
    }, [enabled, prefersReducedMotion, onSwipeUp]),
    
    onSwipedDown: useCallback((eventData) => {
      if (enabled && !prefersReducedMotion && onSwipeDown) {
        onSwipeDown();
      }
    }, [enabled, prefersReducedMotion, onSwipeDown]),
    
    delta: threshold,
    preventScrollOnSwipe: false, // Allow scrolling
    trackTouch: true,
    trackMouse: false, // Only track touch, not mouse
    rotationAngle: 0,
  });

  return (
    <div
      {...handlers}
      className={cn('nc-swipeable-pane', className)}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

/**
 * Hook for programmatic swipe gesture handling
 * Useful when you need swipe detection without wrapping content
 */
export function useSwipeGestures(options: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  enabled?: boolean;
}): SwipeableHandlers {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    enabled = true,
  } = options;

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return useSwipeable({
    onSwipedLeft: useCallback((eventData) => {
      if (enabled && !prefersReducedMotion && onSwipeLeft) {
        onSwipeLeft();
      }
    }, [enabled, prefersReducedMotion, onSwipeLeft]),
    
    onSwipedRight: useCallback((eventData) => {
      if (enabled && !prefersReducedMotion && onSwipeRight) {
        onSwipeRight();
      }
    }, [enabled, prefersReducedMotion, onSwipeRight]),
    
    onSwipedUp: useCallback((eventData) => {
      if (enabled && !prefersReducedMotion && onSwipeUp) {
        onSwipeUp();
      }
    }, [enabled, prefersReducedMotion, onSwipeUp]),
    
    onSwipedDown: useCallback((eventData) => {
      if (enabled && !prefersReducedMotion && onSwipeDown) {
        onSwipeDown();
      }
    }, [enabled, prefersReducedMotion, onSwipeDown]),
    
    delta: threshold,
    preventScrollOnSwipe: false,
    trackTouch: true,
    trackMouse: false,
    rotationAngle: 0,
  });
}
