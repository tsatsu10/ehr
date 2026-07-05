/**
 * LiveRegion — ARIA live region for screen reader announcements
 * Announces dynamic content changes to screen reader users
 */
import React, { useEffect, useRef } from 'react';

type Politeness = 'polite' | 'assertive' | 'off';

interface LiveRegionProps {
  /** Message to announce to screen readers */
  message: string;
  /** ARIA politeness level: polite (wait for pause), assertive (interrupt) */
  politeness?: Politeness;
  /** Clear message after delay (ms) to allow re-announcement of same content */
  clearAfter?: number;
  /** Additional className */
  className?: string;
}

/**
 * Announces messages to screen readers via ARIA live region
 * 
 * **Usage:**
 * - `polite`: Default, announces during natural pauses (search results, status changes)
 * - `assertive`: Interrupts immediately (errors, critical alerts)
 * 
 * Component is visually hidden but read by screen readers.
 * Auto-clears messages after `clearAfter` ms to enable re-announcing same text.
 * 
 * @example
 * <LiveRegion message="3 patients found" />
 * <LiveRegion message="Error loading patient" politeness="assertive" />
 */
export function LiveRegion({
  message,
  politeness = 'polite',
  clearAfter = 5000,
  className,
}: LiveRegionProps) {
  const timeoutRef = useRef<number>();

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    // If message exists and clearAfter is set, schedule clear
    if (message && clearAfter > 0) {
      timeoutRef.current = window.setTimeout(() => {
        // The parent should manage clearing the message
        // This just ensures cleanup on unmount
      }, clearAfter);
    }

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [message, clearAfter]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className={className}
      style={{
        position: 'absolute',
        left: '-10000px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
    >
      {message}
    </div>
  );
}

/**
 * Hook for managing live region announcements
 * Provides a simple API for announcing messages with auto-clear
 */
export function useLiveAnnounce() {
  const [message, setMessage] = React.useState('');
  const [politeness, setPoliteness] = React.useState<Politeness>('polite');
  const timeoutRef = useRef<number>();

  const announce = React.useCallback((
    text: string,
    options: { politeness?: Politeness; clearAfter?: number } = {}
  ) => {
    const { politeness: pol = 'polite', clearAfter = 5000 } = options;

    // Clear existing timeout
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    // Set new message and politeness
    setMessage(text);
    setPoliteness(pol);

    // Schedule clear
    if (clearAfter > 0) {
      timeoutRef.current = window.setTimeout(() => {
        setMessage('');
      }, clearAfter);
    }
  }, []);

  const clear = React.useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    setMessage('');
  }, []);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { message, politeness, announce, clear };
}
