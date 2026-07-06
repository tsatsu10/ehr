import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Banknote, Loader2 } from 'lucide-react';

export function CashierDeskLayout({
  activePane,
  queue,
}: {
  activePane: ReactNode;
  queue: ReactNode;
}) {
  return (
    <div className="nc-cashier-desk-layout">
      <div className="nc-cashier-desk-layout__active">{activePane}</div>
      <aside className="nc-cashier-desk-layout__queue" aria-label="Payment queue">
        {queue}
      </aside>
    </div>
  );
}

export function CashierActiveShell({
  children,
  className,
  id = 'nc-cashier-active-pane',
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div id={id} className={cn('nc-cashier-active-shell', className)}>
      {children}
    </div>
  );
}

export function CashierActiveEmpty({
  title = 'No visit selected',
  message = 'Choose a patient from the payment queue or find a patient to start checkout.',
  children,
}: {
  title?: string;
  message?: string;
  children?: ReactNode;
}) {
  return (
    <CashierActiveShell>
      <div className="nc-cashier-active-shell__empty">
        <div className="nc-cashier-active-shell__empty-icon" aria-hidden="true">
          <Banknote className="h-7 w-7" />
        </div>
        <h2 className="nc-cashier-active-shell__empty-title">{title}</h2>
        <p className="nc-cashier-active-shell__empty-message">{message}</p>
        {children}
      </div>
    </CashierActiveShell>
  );
}

export function CashierActiveLoading() {
  return (
    <CashierActiveShell>
      <div className="nc-cashier-active-shell__loading" role="status" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span>Loading visit…</span>
      </div>
    </CashierActiveShell>
  );
}

export function CashierActiveSection({
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
    <section className={cn('nc-cashier-active-section', className)}>
      {(title || description) && (
        <header className="nc-cashier-active-section__header">
          {title && <h3 className="nc-cashier-active-section__title">{title}</h3>}
          {description && <p className="nc-cashier-active-section__description">{description}</p>}
        </header>
      )}
      <div className="nc-cashier-active-section__body">{children}</div>
    </section>
  );
}

export function CashierActiveStickyFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="nc-cashier-active-shell__sticky-footer" aria-label="Checkout actions">
      {children}
    </footer>
  );
}

export function CashierQueuePanel({
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
    <div className={cn('nc-cashier-queue-panel', className)}>
      <header className="nc-cashier-queue-panel__header">
        <h2 className="nc-cashier-queue-panel__title">{title}</h2>
        {typeof count === 'number' && (
          <span className="nc-cashier-queue-panel__count" aria-label={`${count} waiting`}>
            {count}
          </span>
        )}
      </header>
      <div className="nc-cashier-queue-panel__body">{children}</div>
    </div>
  );
}
