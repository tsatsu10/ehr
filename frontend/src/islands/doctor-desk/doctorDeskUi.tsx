import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Stethoscope } from 'lucide-react';

export function DoctorDeskLayout({
  activePane,
  queue,
}: {
  activePane: ReactNode;
  queue: ReactNode;
}) {
  return (
    <div className="nc-doctor-desk-layout">
      <div className="nc-doctor-desk-layout__active">{activePane}</div>
      <aside className="nc-doctor-desk-layout__queue" aria-label="Doctor queue">
        {queue}
      </aside>
    </div>
  );
}

export function DoctorActiveShell({
  children,
  className,
  id = 'nc-doctor-active-pane',
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div id={id} className={cn('nc-doctor-active-shell', className)}>
      {children}
    </div>
  );
}

export function DoctorActiveEmpty({
  title = 'No patient selected',
  message = 'Choose a patient from the queue to start the consult.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <DoctorActiveShell>
      <div className="nc-doctor-active-shell__empty">
        <div className="nc-doctor-active-shell__empty-icon" aria-hidden="true">
          <Stethoscope className="h-7 w-7" />
        </div>
        <h2 className="nc-doctor-active-shell__empty-title">{title}</h2>
        <p className="nc-doctor-active-shell__empty-message">{message}</p>
      </div>
    </DoctorActiveShell>
  );
}

export function DoctorActiveLoading() {
  return (
    <DoctorActiveShell>
      <div className="nc-doctor-active-shell__loading" role="status" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span>Loading consult…</span>
      </div>
    </DoctorActiveShell>
  );
}

export function DoctorActiveSection({
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
    <section className={cn('nc-doctor-active-section', className)}>
      {(title || description) && (
        <header className="nc-doctor-active-section__header">
          {title && <h3 className="nc-doctor-active-section__title">{title}</h3>}
          {description && <p className="nc-doctor-active-section__description">{description}</p>}
        </header>
      )}
      <div className="nc-doctor-active-section__body">{children}</div>
    </section>
  );
}

export function DoctorActiveStickyFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="nc-doctor-active-shell__sticky-footer" aria-label="Consult actions">
      {children}
    </footer>
  );
}

export function DoctorQueuePanel({
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
    <div className={cn('nc-doctor-queue-panel', className)}>
      <header className="nc-doctor-queue-panel__header">
        <h2 className="nc-doctor-queue-panel__title">{title}</h2>
        {typeof count === 'number' && (
          <span className="nc-doctor-queue-panel__count" aria-label={`${count} waiting`}>
            {count}
          </span>
        )}
      </header>
      <div className="nc-doctor-queue-panel__body">{children}</div>
    </div>
  );
}
