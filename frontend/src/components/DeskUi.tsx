import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DeskUiConfig {
  /** BEM segment, e.g. `lab` → `nc-lab-desk-layout` */
  prefix: string;
  queueAriaLabel: string;
  stickyFooterAriaLabel: string;
  emptyIcon: LucideIcon;
  emptyTitle?: string;
  emptyMessage?: string;
  loadingMessage: string;
  queueCountAriaLabel?: (count: number) => string;
}

export interface DeskUiComponents {
  DeskLayout: ComponentType<{ activePane: ReactNode; queue: ReactNode }>;
  ActiveShell: ComponentType<{ children: ReactNode; className?: string; id?: string }>;
  ActiveEmpty: ComponentType<{ title?: string; message?: string; children?: ReactNode }>;
  ActiveLoading: ComponentType;
  ActiveSection: ComponentType<{
    title?: string;
    description?: string;
    children: ReactNode;
    className?: string;
  }>;
  ActiveStickyFooter: ComponentType<{ children: ReactNode }>;
  QueuePanel: ComponentType<{
    title: string;
    count?: number;
    children: ReactNode;
    className?: string;
  }>;
}

export function createDeskUi(config: DeskUiConfig): DeskUiComponents {
  const {
    prefix,
    queueAriaLabel,
    stickyFooterAriaLabel,
    emptyIcon: EmptyIcon,
    emptyTitle = 'No patient selected',
    emptyMessage = 'Choose a patient from the queue to start work.',
    loadingMessage,
    queueCountAriaLabel = (count) => `${count} in queue`,
  } = config;

  function DeskLayout({
    activePane,
    queue,
  }: {
    activePane: ReactNode;
    queue: ReactNode;
  }) {
    return (
      <div className={`nc-${prefix}-desk-layout`}>
        <div className={`nc-${prefix}-desk-layout__active`}>{activePane}</div>
        <aside className={`nc-${prefix}-desk-layout__queue`} aria-label={queueAriaLabel}>
          {queue}
        </aside>
      </div>
    );
  }

  function ActiveShell({
    children,
    className,
    id = `nc-${prefix}-active-pane`,
  }: {
    children: ReactNode;
    className?: string;
    id?: string;
  }) {
    return (
      <div id={id} className={cn(`nc-${prefix}-active-shell`, className)}>
        {children}
      </div>
    );
  }

  function ActiveEmpty({
    title = emptyTitle,
    message = emptyMessage,
    children,
  }: {
    title?: string;
    message?: string;
    children?: ReactNode;
  }) {
    return (
      <ActiveShell>
        <div className={`nc-${prefix}-active-shell__empty`}>
          <div className={`nc-${prefix}-active-shell__empty-icon`} aria-hidden="true">
            <EmptyIcon className="h-7 w-7" />
          </div>
          <h2 className={`nc-${prefix}-active-shell__empty-title`}>{title}</h2>
          <p className={`nc-${prefix}-active-shell__empty-message`}>{message}</p>
          {children}
        </div>
      </ActiveShell>
    );
  }

  function ActiveLoading() {
    return (
      <ActiveShell>
        <div
          className={`nc-${prefix}-active-shell__loading`}
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span>{loadingMessage}</span>
        </div>
      </ActiveShell>
    );
  }

  function ActiveSection({
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
      <section className={cn(`nc-${prefix}-active-section`, className)}>
        {(title || description) && (
          <header className={`nc-${prefix}-active-section__header`}>
            {title && <h3 className={`nc-${prefix}-active-section__title`}>{title}</h3>}
            {description && (
              <p className={`nc-${prefix}-active-section__description`}>{description}</p>
            )}
          </header>
        )}
        <div className={`nc-${prefix}-active-section__body`}>{children}</div>
      </section>
    );
  }

  function ActiveStickyFooter({ children }: { children: ReactNode }) {
    return (
      <footer
        className={`nc-${prefix}-active-shell__sticky-footer`}
        aria-label={stickyFooterAriaLabel}
      >
        {children}
      </footer>
    );
  }

  function QueuePanel({
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
      <div className={cn(`nc-${prefix}-queue-panel`, className)}>
        <header className={`nc-${prefix}-queue-panel__header`}>
          <h2 className={`nc-${prefix}-queue-panel__title`}>{title}</h2>
          {typeof count === 'number' && (
            <span
              className={`nc-${prefix}-queue-panel__count`}
              aria-label={queueCountAriaLabel(count)}
            >
              {count}
            </span>
          )}
        </header>
        <div className={`nc-${prefix}-queue-panel__body`}>{children}</div>
      </div>
    );
  }

  return {
    DeskLayout,
    ActiveShell,
    ActiveEmpty,
    ActiveLoading,
    ActiveSection,
    ActiveStickyFooter,
    QueuePanel,
  };
}
