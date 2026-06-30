import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oe-nc-primary)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:   'bg-[var(--oe-nc-primary)] text-white shadow hover:bg-[var(--oe-nc-primary)]/90',
        cta:       'bg-[var(--oe-nc-cta)] text-white shadow hover:bg-[var(--oe-nc-cta)]/90',
        danger:    'bg-[var(--oe-nc-danger,#dc2626)] text-white shadow hover:bg-[var(--oe-nc-danger,#dc2626)]/90',
        outline:   'border border-[var(--oe-nc-border)] bg-transparent text-[var(--oe-nc-text)] shadow-sm hover:bg-[var(--oe-nc-bg-tint)]',
        ghost:     'bg-transparent text-[var(--oe-nc-text)] hover:bg-[var(--oe-nc-bg-tint)]',
        secondary: 'bg-[var(--oe-nc-bg-tint)] text-[var(--oe-nc-text)] shadow-sm hover:bg-[var(--oe-nc-border)]',
        link:      'text-[var(--oe-nc-primary)] underline-offset-4 hover:underline',
        warning:   'bg-amber-500 text-white shadow hover:bg-amber-600',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm:      'h-8 rounded-md px-3 text-xs',
        lg:      'h-11 rounded-lg px-6 text-base',
        xl:      'h-12 rounded-lg px-8 text-base font-semibold',
        icon:    'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';

export { buttonVariants };
