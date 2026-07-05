/**
 * Radix Sheet primitives — shadcn target for SlideOver (UI plan §9 Phase C).
 */
import * as SheetPrimitive from '@radix-ui/react-dialog';
import type { ComponentPropsWithoutRef, ElementRef, HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetPortal = SheetPrimitive.Portal;

const overlayClass = 'absolute inset-0 bg-slate-900/45 motion-reduce:transition-none';

const panelRightClass =
  'absolute top-0 right-0 flex h-full max-w-full flex-col overflow-hidden bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.12)]';

const panelBottomClass =
  'absolute bottom-0 left-0 right-0 flex h-[min(92vh,100%)] max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.12)]';

export const sheetWidthClass = {
  sm: 'w-[min(480px,100%)]',
  md: 'w-[min(32rem,100%)]',
  lg: 'w-[min(720px,100%)]',
} as const;

export type SheetWidth = keyof typeof sheetWidthClass;

export const sheetCloseClass =
  'inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-xl leading-none text-[var(--oe-nc-text-muted)] hover:bg-[var(--oe-nc-bg-tint,#eff6ff)] hover:text-[var(--oe-nc-text)] focus-visible:outline-none focus-visible:shadow-[var(--oe-nc-focus-ring)]';

export const sheetBodyClass = 'flex-1 overflow-auto p-4';

export const SheetOverlay = forwardRef<
  ElementRef<typeof SheetPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay ref={ref} className={cn(overlayClass, className)} {...props} />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

type SheetContentProps = ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & {
  side?: 'right' | 'bottom';
};

export const SheetContent = forwardRef<
  ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ className, side = 'right', children, ...props }, ref) => (
  <SheetPortal>
    <div className="fixed inset-0 z-[1060]">
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={ref}
        className={cn(
          side === 'bottom' ? panelBottomClass : panelRightClass,
          className,
        )}
        {...props}
      >
        {children}
      </SheetPrimitive.Content>
    </div>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

export const SheetHeader = ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
  <header
    className={cn(
      'flex items-center justify-between gap-3 border-b border-[var(--oe-nc-border,#e2e8f0)] px-4 py-3',
      className,
    )}
    {...props}
  />
);

export const SheetFooter = ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
  <footer
    className={cn(
      'nc-slide-over-footer flex flex-wrap gap-2 border-t border-[var(--oe-nc-border,#e2e8f0)] px-4 py-3',
      className,
    )}
    {...props}
  />
);

export const SheetBody = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn(sheetBodyClass, className)} {...props} />
);

export const SheetTitle = forwardRef<
  ElementRef<typeof SheetPrimitive.Title>,
  ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('mb-0 text-base font-semibold leading-tight text-[var(--oe-nc-text)]', className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

export const SheetCloseButton = forwardRef<
  ElementRef<typeof SheetPrimitive.Close>,
  ComponentPropsWithoutRef<typeof SheetPrimitive.Close>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Close ref={ref} className={cn(sheetCloseClass, className)} {...props} />
));
SheetCloseButton.displayName = 'SheetCloseButton';
