/**
 * Radix Dialog primitives — shadcn target for ConfirmModal (UI plan §9 Phase C).
 */
import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ComponentPropsWithoutRef, ElementRef, HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;

const overlayClass =
  'fixed inset-0 z-[1050] bg-slate-900/45 motion-reduce:transition-none';

const contentClass =
  'fixed left-1/2 top-1/2 z-[1051] flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-[var(--oe-nc-border,#e2e8f0)] bg-white shadow-lg outline-none';

export const dialogContentSizeClass = {
  sm: 'max-w-md',
  lg: 'max-w-3xl',
  confirm: 'max-w-lg',
} as const;

export type DialogContentSize = keyof typeof dialogContentSizeClass;

export const dialogCloseClass =
  'inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-xl leading-none text-[var(--oe-nc-text-muted)] hover:bg-[var(--oe-nc-bg-tint,#eff6ff)] hover:text-[var(--oe-nc-text)] focus-visible:outline-none focus-visible:shadow-[var(--oe-nc-focus-ring)]';

export const dialogBodyClass = 'overflow-y-auto px-5 py-4';

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} className={cn(overlayClass, className)} {...props} />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content ref={ref} className={cn(contentClass, className)} {...props}>
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export const DialogHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex items-center justify-between gap-3 border-b border-[var(--oe-nc-border,#e2e8f0)] px-5 py-4',
      className,
    )}
    {...props}
  />
);

export const DialogFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-wrap justify-end gap-2 border-t border-[var(--oe-nc-border,#e2e8f0)] px-5 py-3 pb-4',
      className,
    )}
    {...props}
  />
);

export const DialogBody = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn(dialogBodyClass, className)} {...props} />
);

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'font-display m-0 text-lg font-semibold leading-tight text-[var(--oe-nc-text,#111827)]',
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('m-0 text-sm text-[var(--oe-nc-text-muted)]', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export const DialogClose = forwardRef<
  ElementRef<typeof DialogPrimitive.Close>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Close ref={ref} className={cn(dialogCloseClass, className)} {...props} />
));
DialogClose.displayName = DialogPrimitive.Close.displayName;
