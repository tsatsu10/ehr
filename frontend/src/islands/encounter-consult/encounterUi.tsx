import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export function EncounterShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('nc-encounter-consult nc-encounter-shell space-y-4', className)}>
      {children}
    </div>
  );
}

export function EncounterLayout({
  nav,
  content,
  footer,
}: {
  nav: ReactNode;
  content: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="nc-encounter-layout grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav
        className="nc-encounter-nav lg:sticky lg:top-4 lg:self-start"
        aria-label="Consult note sections"
      >
        {nav}
      </nav>
      <div className="nc-encounter-main space-y-4">
        {content}
        {footer}
      </div>
    </div>
  );
}

export function EncounterSectionNav({
  sections,
  activeId,
  onSelect,
}: {
  sections: Array<{ id: string; label: string; complete?: boolean }>;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="nc-encounter-section-nav m-0 list-none space-y-1 p-0" role="list">
      {sections.map((section) => (
        <li key={section.id}>
          <button
            type="button"
            className={cn(
              'nc-encounter-section-link flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors',
              activeId === section.id
                ? 'border-[color-mix(in_srgb,var(--color-oe-primary,#0369a1)_35%,var(--oe-nc-border))] bg-[var(--oe-nc-bg-tint,#f8fafc)] font-semibold text-[var(--oe-nc-text)]'
                : 'border-transparent text-[var(--oe-nc-text-muted)] hover:border-[var(--oe-nc-border)] hover:bg-[var(--oe-nc-bg-tint,#f8fafc)]',
            )}
            aria-current={activeId === section.id ? 'true' : undefined}
            onClick={() => onSelect(section.id)}
          >
            <span>{section.label}</span>
            {section.complete && (
              <span className="nc-encounter-section-dot h-2 w-2 rounded-full bg-[var(--color-oe-cta,#047857)]" aria-hidden="true" />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function EncounterSectionCard({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={`encounter-section-${id}`}
      className={cn(
        'nc-encounter-section-card rounded-xl border border-[var(--oe-nc-border)] bg-[var(--oe-nc-surface,#fff)] p-4 shadow-[var(--oe-nc-shadow-sm,0_1px_2px_rgba(0,0,0,0.05))] nc-encounter-section-enter',
        className,
      )}
      aria-labelledby={`encounter-section-${id}-title`}
    >
      <header className="mb-4 border-b border-[var(--oe-nc-border)] pb-3">
        <h2 id={`encounter-section-${id}-title`} className="text-lg font-semibold text-[var(--oe-nc-text)]">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-[var(--oe-nc-text-muted)]">{description}</p>
        )}
      </header>
      {children}
    </section>
  );
}

export function EncounterStatusBar({
  message,
  tone = 'default',
  saving,
}: {
  message: ReactNode;
  tone?: 'default' | 'success' | 'danger';
  saving?: boolean;
}) {
  return (
    <div
      className={cn(
        'nc-encounter-status flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
        tone === 'success' && 'border-[color-mix(in_srgb,var(--color-oe-cta,#047857)_30%,var(--oe-nc-border))] text-[var(--color-oe-cta,#047857)]',
        tone === 'danger' && 'border-[color-mix(in_srgb,var(--color-oe-danger,#b91c1c)_30%,var(--oe-nc-border))] text-[var(--color-oe-danger,#b91c1c)]',
        tone === 'default' && 'border-[var(--oe-nc-border)] text-[var(--oe-nc-text-muted)]',
      )}
      role="status"
      aria-live="polite"
    >
      {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      <span>{message}</span>
    </div>
  );
}

export function EncounterStickyFooter({ children }: { children: ReactNode }) {
  return (
    <div className="nc-encounter-footer sticky bottom-0 z-10 -mx-1 border-t border-[var(--oe-nc-border)] bg-[color-mix(in_srgb,var(--oe-nc-surface,#fff)_92%,transparent)] px-1 py-3 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">{children}</div>
    </div>
  );
}

export function VitalsMetricTile({
  label,
  value,
  abnormal,
}: {
  label: string;
  value: ReactNode;
  abnormal?: boolean;
}) {
  return (
    <div
      className={cn(
        'nc-encounter-vitals-tile rounded-lg border px-3 py-2',
        abnormal
          ? 'border-[color-mix(in_srgb,var(--color-oe-danger,#b91c1c)_35%,var(--oe-nc-border))] bg-[color-mix(in_srgb,var(--color-oe-danger,#b91c1c)_6%,var(--oe-nc-surface,#fff))]'
          : 'border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint,#f8fafc)]',
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--oe-nc-text-muted)]">{label}</div>
      <div className="mt-1 text-base font-semibold text-[var(--oe-nc-text)]">{value}</div>
    </div>
  );
}
