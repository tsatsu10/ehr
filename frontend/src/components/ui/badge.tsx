import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--oe-nc-primary)] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:   'border-transparent bg-[var(--oe-nc-primary)] text-white',
        success:   'border-transparent bg-emerald-100 text-emerald-800',
        warning:   'border-transparent bg-amber-100 text-amber-800',
        danger:    'border-transparent bg-red-100 text-red-800',
        info:      'border-transparent bg-sky-100 text-sky-800',
        neutral:   'border-transparent bg-slate-100 text-slate-700',
        outline:   'border-[var(--oe-nc-border)] text-[var(--oe-nc-text)]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
