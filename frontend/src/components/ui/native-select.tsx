import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NativeSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

/** Styled native `<select>` — use for multi-select or when Radix Select is a poor fit. */
export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex min-h-10 w-full rounded-lg border border-[var(--oe-nc-border)] bg-white px-3 py-2 text-sm text-[var(--oe-nc-text)] transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oe-nc-primary)] focus-visible:ring-offset-0 focus-visible:border-[var(--oe-nc-primary)]',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--oe-nc-bg-tint)]',
        className
      )}
      {...props}
    />
  )
);
NativeSelect.displayName = 'NativeSelect';
