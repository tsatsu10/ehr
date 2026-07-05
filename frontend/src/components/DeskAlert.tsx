import type { HTMLAttributes, ReactNode } from 'react';
import { deskCalloutClass, type DeskCalloutTone } from '@components/deskCalloutStyles';
import { cn } from '@/lib/utils';

interface DeskAlertProps extends HTMLAttributes<HTMLDivElement> {
  tone: DeskCalloutTone;
  children: ReactNode;
}

/** Desk callout shell — warn / error / info / success feedback boxes. */
export function DeskAlert({ tone, className, children, ...props }: DeskAlertProps) {
  return (
    <div className={cn(deskCalloutClass(tone), className)} {...props}>
      {children}
    </div>
  );
}
