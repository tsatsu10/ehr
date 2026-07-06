import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Pill } from 'lucide-react';

export function PharmacyDeskLayout({
  activePane,
  queue,
}: {
  activePane: ReactNode;
  queue: ReactNode;
}) {
  return (
    <div className="nc-pharmacy-desk-layout">
      <div className="nc-pharmacy-desk-layout__active">{activePane}</div>
      <aside className="nc-pharmacy-desk-layout__queue" aria-label="Pharmacy queue">
        {queue}
      </aside>
    </div>
  );
}

export function PharmacyActiveShell({
  children,
  className,
  id = 'nc-pharmacy-active-pane',
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div id={id} className={cn('nc-pharmacy-active-shell', className)}>
      {children}
    </div>
  );
}

export function PharmacyActiveEmpty({
  title = 'No patient selected',
  message = 'Choose a patient from the pharmacy queue to start work.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <PharmacyActiveShell>
      <div className="nc-pharmacy-active-shell__empty">
        <div className="nc-pharmacy-active-shell__empty-icon" aria-hidden="true">
          <Pill className="h-7 w-7" />
        </div>
        <h2 className="nc-pharmacy-active-shell__empty-title">{title}</h2>
        <p className="nc-pharmacy-active-shell__empty-message">{message}</p>
      </div>
    </PharmacyActiveShell>
  );
}

export function PharmacyActiveLoading() {
  return (
    <PharmacyActiveShell>
      <div className="nc-pharmacy-active-shell__loading" role="status" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span>Loading visit…</span>
      </div>
    </PharmacyActiveShell>
  );
}

export function PharmacyActiveSection({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('nc-pharmacy-active-section', className)}>
      {(title || description) && (
        <header className="nc-pharmacy-active-section__header">
          {title && <h3 className="nc-pharmacy-active-section__title">{title}</h3>}
          {description && <p className="nc-pharmacy-active-section__description">{description}</p>}
        </header>
      )}
      <div className="nc-pharmacy-active-section__body">{children}</div>
    </section>
  );
}

export function PharmacyActiveStickyFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="nc-pharmacy-active-shell__sticky-footer" aria-label="Pharmacy actions">
      {children}
    </footer>
  );
}

export function PharmacyQueuePanel({
  title,
  count,
  children,
  className,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('nc-pharmacy-queue-panel', className)}>
      <header className="nc-pharmacy-queue-panel__header">
        <h2 className="nc-pharmacy-queue-panel__title">{title}</h2>
        {typeof count === 'number' && (
          <span className="nc-pharmacy-queue-panel__count" aria-label={`${count} in queue`}>
            {count}
          </span>
        )}
      </header>
      <div className="nc-pharmacy-queue-panel__body">{children}</div>
    </div>
  );
}
