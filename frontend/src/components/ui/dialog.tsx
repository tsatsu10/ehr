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

const overlayClass = 'nc-radix-dialog-overlay motion-reduce:transition-none';

const contentClass = 'nc-radix-dialog-content';

export const dialogContentSizeClass = {
  sm: 'nc-radix-dialog-content--sm',
  lg: 'nc-radix-dialog-content--lg',
  confirm: 'nc-radix-dialog-content--confirm',
} as const;

export type DialogContentSize = keyof typeof dialogContentSizeClass;

export const dialogCloseClass =
  'inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-xl leading-none text-[var(--oe-nc-text-muted)] hover:bg-[var(--oe-nc-bg-tint,#eff6ff)] hover:text-[var(--oe-nc-text)] focus-visible:outline-none focus-visible:shadow-[var(--oe-nc-focus-ring)]';

export const dialogBodyClass = 'nc-radix-dialog-body';

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
    <DialogPrimitive.Content
      ref={ref}
      className={cn(contentClass, className ?? dialogContentSizeClass.confirm)}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export const DialogHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('nc-radix-dialog-header', className)} {...props} />
);

export const DialogFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('nc-radix-dialog-footer', className)} {...props} />
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
      'nc-radix-dialog-title font-display',
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
