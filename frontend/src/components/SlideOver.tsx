import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { useModalDismiss } from './useModalDismiss';

export type SlideOverWidth = 'sm' | 'md' | 'lg';
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
  children: ReactNode;
}

const WIDTH_CLASS: Record<SlideOverWidth, string> = {
  sm: 'oe-nc-slide-over__panel--sm',
  md: 'oe-nc-slide-over__panel--md',
  lg: 'oe-nc-slide-over__panel--lg',
};

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
  children,
}: SlideOverProps) {
  const panelRef = useRef<HTMLElement>(null);
  useModalDismiss(open, onClose);

  useEffect(() => {
    if (!open) return undefined;

    const selector = initialFocusSelector ?? 'input, button, select, textarea, [tabindex]:not([tabindex="-1"])';
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>(selector)?.focus();
    }, 80);

    return () => window.clearTimeout(t);
  }, [open, initialFocusSelector]);

  if (!open) return null;

  const resolvedTitleId = titleId ?? (id ? `${id}-title` : undefined);

  return (
    <div
      className="oe-nc-slide-over"
      id={id}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)}
      aria-labelledby={resolvedTitleId}
    >
      <div
        className="oe-nc-slide-over__backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        className={`oe-nc-slide-over__panel ${WIDTH_CLASS[width]}${placement === 'bottom' ? ' oe-nc-slide-over__panel--bottom' : ''}`}
      >
        <header className="oe-nc-slide-over__header">
          {typeof title === 'string' ? (
            <h2 className="oe-nc-slide-over__title h6 mb-0" id={resolvedTitleId}>
              {title}
            </h2>
          ) : (
            <div className="oe-nc-slide-over__title" id={resolvedTitleId}>{title}</div>
          )}
          <button type="button" className="close" aria-label="Close" onClick={onClose}>
            <span aria-hidden="true">&times;</span>
          </button>
        </header>
        <div className="oe-nc-slide-over__body">{children}</div>
        {footer != null && (
          <footer className="oe-nc-slide-over__footer">{footer}</footer>
        )}
      </aside>
    </div>
  );
}
