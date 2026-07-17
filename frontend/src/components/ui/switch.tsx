import * as SwitchPrimitive from '@radix-ui/react-switch';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '@/lib/utils';

export const Switch = forwardRef<
  ElementRef<typeof SwitchPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      // nc-switch owns ALL visual styling (track + thumb, both states) as
      // unlayered BEM CSS — see ui-primitives.css. Bootstrap-4-colliding
      // Tailwind utility names must not be used here (see checkbox.tsx).
      'nc-switch',
      'peer shrink-0',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oe-nc-primary)] focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="nc-switch__thumb" />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;
