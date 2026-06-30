import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-lg border border-[var(--oe-nc-border)] bg-white px-3 py-2 text-sm text-[var(--oe-nc-text)] placeholder:text-[var(--oe-nc-text-muted)] transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oe-nc-primary)] focus-visible:ring-offset-0 focus-visible:border-[var(--oe-nc-primary)]',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--oe-nc-bg-tint)]',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = 'Input';
