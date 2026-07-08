/**
 * Radix Accordion primitives — shadcn target for RegistrationForm sections.
 */
import { ChevronDown } from 'lucide-react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Accordion = AccordionPrimitive.Root;

export const AccordionItem = forwardRef<
  ElementRef<typeof AccordionPrimitive.Item>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn(
      'mb-2 overflow-hidden rounded-[0.25rem] border border-[var(--oe-nc-border,#d3dce3)] bg-white',
      'data-[state=open]:border-[var(--oe-nc-primary,#1b3a5f)] data-[state=open]:shadow-[0_0_0_3px_rgba(27,58,95,0.08)]',
      className,
    )}
    {...props}
  />
));
AccordionItem.displayName = 'AccordionItem';

export const AccordionTrigger = forwardRef<
  ElementRef<typeof AccordionPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="m-0">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        'flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-[var(--oe-nc-bg-tint,#f8fafc)] px-4 py-3.5 text-left font-display text-[0.9375rem] font-semibold text-[var(--oe-nc-text,#111827)]',
        'hover:bg-[var(--oe-nc-bg,#eff6ff)] focus-visible:outline-none focus-visible:shadow-[inset_var(--oe-nc-focus-ring)]',
        'data-[state=open]:border-b data-[state=open]:border-[var(--oe-nc-border,#e2e8f0)] data-[state=open]:bg-[var(--oe-nc-bg,#eff6ff)] group',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown
        className="h-3.5 w-3.5 shrink-0 text-[var(--oe-nc-text-muted)] transition-transform duration-150 group-data-[state=open]:rotate-180"
        aria-hidden="true"
      />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

export const AccordionContent = forwardRef<
  ElementRef<typeof AccordionPrimitive.Content>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn('overflow-hidden p-4 text-sm', className)}
    {...props}
  >
    {children}
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = AccordionPrimitive.Content.displayName;
