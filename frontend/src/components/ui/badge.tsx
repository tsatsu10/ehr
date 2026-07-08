import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/* Clinical Console: squared chip, uppercase micro-label, dense clinical tints */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-[0.125rem] border px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--oe-nc-primary)] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:   'border-transparent bg-[var(--oe-nc-primary)] text-white',
        success:   'border-[#a9d6c4] bg-[#e9f5f0] text-[#045d44]',
        warning:   'border-[#ecd1ae] bg-[#faf1e4] text-[#8f3c06]',
        danger:    'border-[#ecc3bf] bg-[#f9ecea] text-[#8f1c13]',
        info:      'border-[#b9c9da] bg-[var(--oe-nc-primary-tint,#e8eef5)] text-[var(--oe-nc-primary,#1b3a5f)]',
        neutral:   'border-[#ccd6de] bg-[#eef1f4] text-[#42525f]',
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
