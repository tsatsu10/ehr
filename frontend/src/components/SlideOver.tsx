import type { ReactNode } from 'react';
import { useEffect } from 'react';
import {
  Sheet,
  SheetBody,
  SheetCloseButton,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  sheetWidthClass,
  type SheetWidth,
} from './ui/sheet';

export type SlideOverWidth = SheetWidth;
export type SlideOverPlacement = 'end' | 'bottom';

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  ariaLabel?: string;
  id?: string;
  titleId?: string;
  footer?: ReactNode;
  width?: SlideOverWidth;
  placement?: SlideOverPlacement;
  initialFocusSelector?: string;
  /**
   * When false, a click on the backdrop / outside the panel does NOT close it — use for
   * data-entry forms so a stray click can't discard in-progress work. Escape and the X still close.
   */
  dismissOnOutsideClick?: boolean;
  children: ReactNode;
}

export function SlideOver({
  open,
  onClose,
  title,
  ariaLabel,
  id,
  titleId,
  footer,
  width = 'md',
  placement = 'end',
  initialFocusSelector,
  dismissOnOutsideClick = true,
  children,
}: SlideOverProps) {
  const resolvedTitleId = titleId ?? (id ? `${id}-title` : undefined);
  const side = placement === 'bottom' ? 'bottom' : 'right';

  useEffect(() => {
    if (!open || !initialFocusSelector) return undefined;

    const t = window.setTimeout(() => {
      document.querySelector<HTMLElement>(initialFocusSelector)?.focus();
    }, 80);

    return () => window.clearTimeout(t);
  }, [open, initialFocusSelector]);

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        id={id}
        side={side}
        className={side === 'right' ? sheetWidthClass[width] : undefined}
        aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)}
        aria-labelledby={resolvedTitleId}
        onOpenAutoFocus={(event) => {
          if (!initialFocusSelector) return;
          event.preventDefault();
          document.querySelector<HTMLElement>(initialFocusSelector)?.focus();
        }}
        onInteractOutside={dismissOnOutsideClick ? undefined : (event) => event.preventDefault()}
      >
        <SheetHeader>
          {typeof title === 'string' ? (
            <SheetTitle id={resolvedTitleId}>{title}</SheetTitle>
          ) : (
            <div
              className="mb-0 text-base font-semibold leading-tight text-[var(--oe-nc-text)]"
              id={resolvedTitleId}
            >
              {title}
            </div>
          )}
          <SheetCloseButton type="button" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </SheetCloseButton>
        </SheetHeader>
        <SheetBody>{children}</SheetBody>
        {footer != null && <SheetFooter>{footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  );
}
