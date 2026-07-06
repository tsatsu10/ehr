import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Stethoscope } from 'lucide-react';

export function TriageDeskLayout({
  activePane,
  queue,
}: {
  activePane: ReactNode;
  queue: ReactNode;
}) {
  return (
    <div className="nc-triage-desk-layout">
      <div className="nc-triage-desk-layout__active">{activePane}</div>
      <aside className="nc-triage-desk-layout__queue" aria-label="Triage queue">
        {queue}
      </aside>
    </div>
  );
}

export function TriageActiveShell({
  children,
  className,
  id = 'nc-triage-active-pane',
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div id={id} className={cn('nc-triage-active-shell', className)}>
      {children}
    </div>
  );
}

export function TriageActiveEmpty({
  title = 'No patient selected',
  message = 'Select a patient from the triage queue or use Find patient.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <TriageActiveShell>
      <div className="nc-triage-active-shell__empty">
        <div className="nc-triage-active-shell__empty-icon" aria-hidden="true">
          <Stethoscope className="h-7 w-7" />
        </div>
        <h2 className="nc-triage-active-shell__empty-title">{title}</h2>
        <p className="nc-triage-active-shell__empty-message">{message}</p>
      </div>
    </TriageActiveShell>
  );
}

export function TriageActiveLoading() {
  return (
    <TriageActiveShell>
      <div className="nc-triage-active-shell__loading" role="status" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span>Loading patient…</span>
      </div>
    </TriageActiveShell>
  );
}

export function TriageActiveSection({
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
    <section className={cn('nc-triage-active-section', className)}>
      {(title || description) && (
        <header className="nc-triage-active-section__header">
          {title && <h3 className="nc-triage-active-section__title">{title}</h3>}
          {description && <p className="nc-triage-active-section__description">{description}</p>}
        </header>
      )}
      <div className="nc-triage-active-section__body">{children}</div>
    </section>
  );
}

export function TriageActiveStickyFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="nc-triage-active-shell__sticky-footer" aria-label="Triage actions">
      {children}
    </footer>
  );
}

export function TriageQueuePanel({
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
    <div className={cn('nc-triage-queue-panel', className)}>
      <header className="nc-triage-queue-panel__header">
        <h2 className="nc-triage-queue-panel__title">{title}</h2>
        {typeof count === 'number' && (
          <span className="nc-triage-queue-panel__count" aria-label={`${count} in queue`}>
            {count}
          </span>
        )}
      </header>
      <div className="nc-triage-queue-panel__body">{children}</div>
    </div>
  );
}
