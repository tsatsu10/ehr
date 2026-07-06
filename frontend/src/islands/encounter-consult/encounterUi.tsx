import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import type { EncounterNoteContextSection, EncounterNotePrefill } from './encounterConsultTypes';

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

export function EncounterContextStrip({
  prefill,
  acknowledged,
  onAcknowledge,
  readOnly,
}: {
  prefill: EncounterNotePrefill;
  acknowledged: EncounterNoteContextSection;
  onAcknowledge: (patch: Partial<EncounterNoteContextSection>) => void;
  readOnly?: boolean;
}) {
  const showAllergies = prefill.allergies.undocumented
    || prefill.allergies.items.length > 0
    || prefill.allergies.nkda;
  const showMeds = prefill.medications.items.length > 0;

  if (!showAllergies && !showMeds) {
    return null;
  }

  return (
    <section
      className="nc-encounter-context-strip rounded-xl border border-[color-mix(in_srgb,var(--color-oe-warning,#d97706)_28%,var(--oe-nc-border))] bg-[color-mix(in_srgb,var(--color-oe-warning,#d97706)_6%,var(--oe-nc-surface,#fff))] p-4"
      aria-label="Clinical context review"
    >
      <h2 className="text-sm font-semibold text-[var(--oe-nc-text)]">Review before documenting</h2>
      <p className="mt-1 text-sm text-[var(--oe-nc-text-muted)]">
        Confirm allergies and medications shown on the chart before signing this consult note.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {showAllergies && (
          <div className="rounded-lg border border-[var(--oe-nc-border)] bg-[var(--oe-nc-surface,#fff)] p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium text-[var(--oe-nc-text)]">Allergies</h3>
                <p className="mt-1 text-sm text-[var(--oe-nc-text-muted)]">
                  {prefill.allergies.summary ?? 'Review allergy list'}
                </p>
              </div>
              {prefill.allergies.edit_url && (
                <a
                  className="text-xs font-medium text-[var(--color-oe-primary,#0369a1)] hover:underline"
                  href={prefill.allergies.edit_url}
                  target="_top"
                  rel="noreferrer"
                >
                  Edit
                </a>
              )}
            </div>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={acknowledged.allergies_acknowledged}
                disabled={readOnly}
                onChange={(event) => onAcknowledge({ allergies_acknowledged: event.target.checked })}
              />
              <span>I reviewed the allergy information for this patient</span>
            </label>
          </div>
        )}
        {showMeds && (
          <div className="rounded-lg border border-[var(--oe-nc-border)] bg-[var(--oe-nc-surface,#fff)] p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium text-[var(--oe-nc-text)]">Medications</h3>
                <p className="mt-1 text-sm text-[var(--oe-nc-text-muted)]">
                  {prefill.medications.summary ?? 'Review medication list'}
                </p>
              </div>
              {prefill.medications.edit_url && (
                <a
                  className="text-xs font-medium text-[var(--color-oe-primary,#0369a1)] hover:underline"
                  href={prefill.medications.edit_url}
                  target="_top"
                  rel="noreferrer"
                >
                  Edit
                </a>
              )}
            </div>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={acknowledged.meds_acknowledged}
                disabled={readOnly}
                onChange={(event) => onAcknowledge({ meds_acknowledged: event.target.checked })}
              />
              <span>I reviewed the medication list for this patient</span>
            </label>
          </div>
        )}
      </div>
    </section>
  );
}
