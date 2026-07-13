import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '@/lib/utils';

export const Checkbox = forwardRef<
  ElementRef<typeof CheckboxPrimitive.Root>,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      // nc-checkbox owns ALL visual styling (base + checked) as unlayered
      // BEM CSS in the shell's components.css. Tailwind class names that
      // collide with Bootstrap 4 utilities (`bg-white`, `border`,
      // `rounded-sm` — all `!important` in BS4) must NOT be used here:
      // BS4's .bg-white kept the box white in both states, so toggles
      // looked dead (2026-07-11 Admin Hub "read-only" bug). Only
      // non-colliding layout/focus utilities remain below.
      'nc-checkbox',
      'peer h-4 w-4 shrink-0',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oe-nc-primary)] focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      <Check className="h-3 w-3" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;
