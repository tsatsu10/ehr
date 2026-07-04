import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  indicatorClassName?: string;
}

/** shadcn-style progress bar mapped to New Clinic tokens (UI plan §9 Phase B). */
export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, indicatorClassName, ...props }, ref) => {
    const clamped = Math.min(Math.max(value, 0), max);
    const pct = max > 0 ? (clamped / max) * 100 : 0;

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clamped}
        className={cn(
          'relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--oe-nc-border)]',
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            'h-full rounded-full bg-[var(--oe-nc-primary)] transition-[width] duration-400 ease-out',
            indicatorClassName,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  },
);
Progress.displayName = 'Progress';
