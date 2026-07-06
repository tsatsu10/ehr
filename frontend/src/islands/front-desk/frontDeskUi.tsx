import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Search, UserSearch } from 'lucide-react';

export function FrontDeskLayout({
  search,
  preview,
}: {
  search: ReactNode;
  preview: ReactNode;
}) {
  return (
    <div className="nc-front-desk-layout nc-front-desk-grid">
      <div
        className="nc-front-desk-layout__search nc-front-desk-grid-search"
        role="search"
        aria-label="Patient search"
      >
        {search}
      </div>
      <div
        className="nc-front-desk-layout__preview nc-front-desk-grid-preview"
        role="region"
        aria-label="Patient preview and registration"
      >
        {preview}
      </div>
    </div>
  );
}

export function FrontDeskSearchPanel({ children }: { children: ReactNode }) {
  return (
    <div className="nc-front-desk-search-panel">
      <header className="nc-front-desk-search-panel__header">
        <div className="nc-front-desk-search-panel__header-text">
          <h2 className="nc-front-desk-search-panel__title">Patient search</h2>
          <p className="nc-front-desk-search-panel__sub">Name, phone, or MRN — press / to focus</p>
        </div>
        <div className="nc-front-desk-search-panel__icon" aria-hidden="true">
          <UserSearch className="h-5 w-5" />
        </div>
      </header>
      <div className="nc-front-desk-search-panel__body">{children}</div>
    </div>
  );
}

export function FrontDeskPreviewShell({
  children,
  title,
  className,
  scrollClassName,
  id = 'nc-preview-pane',
  embedded = false,
}: {
  children: ReactNode;
  title?: string;
  className?: string;
  scrollClassName?: string;
  id?: string;
  embedded?: boolean;
}) {
  if (embedded) {
    return (
      <div className={cn('oe-nc-desk-split__preview nc-preview-pane', className)} id={id}>
        {children}
      </div>
    );
  }

  return (
    <div
      id={id}
      className={cn(
        'nc-front-desk-preview-shell oe-nc-preview-pane nc-preview-pane',
        title ? 'nc-front-desk-preview-shell--titled' : '',
        className,
      )}
    >
      {title ? (
        <header className="nc-front-desk-preview-shell__header">
          <h2 className="nc-front-desk-preview-shell__title">{title}</h2>
        </header>
      ) : null}
      <div
        className={cn(
          'nc-front-desk-preview-shell__scroll nc-preview-pane-scroll oe-nc-preview-pane__scroll',
          scrollClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function FrontDeskPreviewEmpty() {
  return (
    <FrontDeskPreviewShell>
      <div className="nc-front-desk-preview-shell__empty" id="nc-preview-empty">
        <div className="nc-front-desk-preview-shell__empty-icon" aria-hidden="true">
          <Search className="h-7 w-7" />
        </div>
        <h2 className="nc-front-desk-preview-shell__empty-title">No patient selected</h2>
        <p className="nc-front-desk-preview-shell__empty-message">
          Search by name — then pick a row to preview and start a visit.
        </p>
        <p className="nc-front-desk-preview-shell__empty-meta">
          Press <kbd className="nc-kbd">/</kbd> to focus search · Register for new patients
        </p>
      </div>
    </FrontDeskPreviewShell>
  );
}

export function FrontDeskPreviewLoading() {
  return (
    <FrontDeskPreviewShell>
      <div className="nc-front-desk-preview-shell__loading" role="status" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span>Loading patient preview…</span>
      </div>
    </FrontDeskPreviewShell>
  );
}
