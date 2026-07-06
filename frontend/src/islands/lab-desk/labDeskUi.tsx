import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { FlaskConical, Loader2 } from 'lucide-react';

export function LabDeskLayout({
  activePane,
  queue,
}: {
  activePane: ReactNode;
  queue: ReactNode;
}) {
  return (
    <div className="nc-lab-desk-layout">
      <div className="nc-lab-desk-layout__active">{activePane}</div>
      <aside className="nc-lab-desk-layout__queue" aria-label="Lab queue">
        {queue}
      </aside>
    </div>
  );
}

export function LabActiveShell({
  children,
  className,
  id = 'nc-lab-active-pane',
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div id={id} className={cn('nc-lab-active-shell', className)}>
      {children}
    </div>
  );
}

export function LabActiveEmpty({
  title = 'No patient selected',
  message = 'Choose a patient from the lab queue to start work.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <LabActiveShell>
      <div className="nc-lab-active-shell__empty">
        <div className="nc-lab-active-shell__empty-icon" aria-hidden="true">
          <FlaskConical className="h-7 w-7" />
        </div>
        <h2 className="nc-lab-active-shell__empty-title">{title}</h2>
        <p className="nc-lab-active-shell__empty-message">{message}</p>
      </div>
    </LabActiveShell>
  );
}

export function LabActiveLoading() {
  return (
    <LabActiveShell>
      <div className="nc-lab-active-shell__loading" role="status" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span>Loading visit…</span>
      </div>
    </LabActiveShell>
  );
}

export function LabActiveSection({
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
    <section className={cn('nc-lab-active-section', className)}>
      {(title || description) && (
        <header className="nc-lab-active-section__header">
          {title && <h3 className="nc-lab-active-section__title">{title}</h3>}
          {description && <p className="nc-lab-active-section__description">{description}</p>}
        </header>
      )}
      <div className="nc-lab-active-section__body">{children}</div>
    </section>
  );
}

export function LabActiveStickyFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="nc-lab-active-shell__sticky-footer" aria-label="Lab actions">
      {children}
    </footer>
  );
}

export function LabQueuePanel({
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
    <div className={cn('nc-lab-queue-panel', className)}>
      <header className="nc-lab-queue-panel__header">
        <h2 className="nc-lab-queue-panel__title">{title}</h2>
        {typeof count === 'number' && (
          <span className="nc-lab-queue-panel__count" aria-label={`${count} in queue`}>
            {count}
          </span>
        )}
      </header>
      <div className="nc-lab-queue-panel__body">{children}</div>
    </div>
  );
}
