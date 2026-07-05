/**
 * cmdk Command primitives — shadcn target for PatientSearchWidget (server-side filter off).
 */
import { Command as CommandPrimitive } from 'cmdk';
import type { ComponentPropsWithoutRef, ElementRef, HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Command = forwardRef<
  ElementRef<typeof CommandPrimitive>,
  ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn('flex w-full flex-col', className)}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

type CommandInputProps = ComponentPropsWithoutRef<typeof CommandPrimitive.Input> & {
  wrapperClassName?: string;
  hideSearchIcon?: boolean;
};

export const CommandInput = forwardRef<
  ElementRef<typeof CommandPrimitive.Input>,
  CommandInputProps
>(({ className, wrapperClassName, hideSearchIcon = false, ...props }, ref) => (
  // cmdk requires this non-standard wrapper attribute for input layout
  <div
    className={cn(
      'relative flex items-center border-b border-[var(--oe-nc-border,#e2e8f0)] p-3',
      wrapperClassName,
    )}
    {...{ 'cmdk-input-wrapper': '' }}
  >
    {!hideSearchIcon && (
      <i
        className="fa fa-search pointer-events-none absolute left-5 text-[var(--oe-nc-text-muted)]"
        aria-hidden="true"
      />
    )}
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        'w-full rounded-[0.625rem] border-[1.5px] border-[var(--oe-nc-border,#e2e8f0)] bg-[var(--oe-nc-bg-tint,#f8fafc)] px-9 py-2 text-[0.9375rem] text-[var(--oe-nc-text)] transition-[border-color,box-shadow] duration-150',
        'placeholder:text-[var(--oe-nc-text-muted)] focus:border-[var(--oe-nc-primary,#2563eb)] focus:outline-none focus:shadow-[var(--oe-nc-focus-ring)]',
        className,
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

export const CommandList = forwardRef<
  ElementRef<typeof CommandPrimitive.List>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn('max-h-none overflow-visible', className)}
    {...props}
  />
));
CommandList.displayName = CommandPrimitive.List.displayName;

export const CommandEmpty = forwardRef<
  ElementRef<typeof CommandPrimitive.Empty>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className={cn('px-3 py-2 text-sm text-[var(--oe-nc-text-muted)]', className)}
    {...props}
  />
));
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

export const CommandGroup = forwardRef<
  ElementRef<typeof CommandPrimitive.Group>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group ref={ref} className={cn('p-0', className)} {...props} />
));
CommandGroup.displayName = CommandPrimitive.Group.displayName;

const commandItemClass =
  'flex w-full cursor-pointer items-start gap-3 border-0 border-l-[3px] border-l-transparent bg-transparent p-[0.65rem_0.75rem] text-left font-[inherit] text-inherit transition-[background-color,border-color] duration-150 hover:bg-cyan-50/60 hover:border-l-[var(--oe-nc-secondary,#22d3ee)] data-[selected=true]:bg-cyan-50/60 data-[selected=true]:border-l-[var(--oe-nc-secondary,#22d3ee)]';

export const CommandItem = forwardRef<
  ElementRef<typeof CommandPrimitive.Item>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(commandItemClass, className)}
    {...props}
  />
));
CommandItem.displayName = CommandPrimitive.Item.displayName;

export const CommandSeparator = forwardRef<
  ElementRef<typeof CommandPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn('my-0 h-px bg-[var(--oe-nc-border,#e2e8f0)]', className)}
    {...props}
  />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

export function CommandLoading({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-3 py-2', className)} {...props} />;
}
