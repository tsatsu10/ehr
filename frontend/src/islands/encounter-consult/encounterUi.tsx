import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Loader2 } from 'lucide-react';
import type { EncounterNoteContextSection, EncounterNotePrefill, EncounterSignMeta } from './encounterConsultTypes';

export function EncounterShell({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn('nc-encounter-consult nc-encounter-shell mx-auto max-w-7xl space-y-4 px-1 sm:px-0', className)}
    >
      <a href="#nc-encounter-main" className="nc-encounter-skip-link">
        Skip to note sections
      </a>
      {children}
    </div>
  );
}

export function EncounterLayout({
  nav,
  content,
  footer,
  mobileStepper = false,
}: {
  nav: ReactNode;
  content: ReactNode;
  footer: ReactNode;
  mobileStepper?: boolean;
}) {
  return (
    <div
      className={cn(
        'nc-encounter-layout grid gap-5 lg:grid-cols-[minmax(15rem,17rem)_minmax(0,1fr)]',
        mobileStepper && 'nc-encounter-layout--mobile-stepper',
      )}
    >
      <nav
        className={cn(
          'nc-encounter-nav rounded-2xl border border-[var(--oe-nc-border)] bg-[var(--oe-nc-surface,#fff)] p-3 shadow-[var(--oe-nc-shadow-sm,0_1px_2px_rgba(0,0,0,0.05))] lg:sticky lg:top-4 lg:self-start',
          mobileStepper && 'nc-encounter-nav--chips border-0 bg-transparent p-0 shadow-none',
        )}
        aria-label="Consult note sections"
      >
        {nav}
      </nav>
      <div
        id="nc-encounter-main"
        className={cn('nc-encounter-main min-w-0 space-y-4', mobileStepper && 'nc-encounter-main--mobile-stepper')}
      >
        {content}
        {footer}
      </div>
    </div>
  );
}

export function EncounterSectionCard({
  id,
  title,
  description,
  children,
  className,
  stepperMode = false,
  expanded = true,
  step,
  onHeaderClick,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  stepperMode?: boolean;
  expanded?: boolean;
  step?: number;
  onHeaderClick?: () => void;
}) {
  const headerProps = stepperMode && onHeaderClick
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick: onHeaderClick,
        onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onHeaderClick();
          }
        },
      }
    : {};

  return (
    <section
      id={`encounter-section-${id}`}
      className={cn(
        'nc-encounter-section-card scroll-mt-24 rounded-2xl border border-[var(--oe-nc-border)] bg-[var(--oe-nc-surface,#fff)] shadow-[var(--oe-nc-shadow-sm,0_1px_2px_rgba(0,0,0,0.05))] nc-encounter-section-enter',
        stepperMode && 'nc-encounter-section-card--stepper',
        stepperMode && expanded && 'is-expanded nc-encounter-section-card--expanded ring-1 ring-[color-mix(in_srgb,var(--color-oe-primary,#0891b2)_18%,transparent)]',
        stepperMode && !expanded && 'is-collapsed nc-encounter-section-card--collapsed opacity-95',
        className,
      )}
      aria-labelledby={`encounter-section-${id}-title`}
    >
      <header
        className={cn(
          'nc-encounter-section-card__header border-[var(--oe-nc-border)] px-5 py-4',
          stepperMode ? 'mb-0 flex cursor-pointer items-start justify-between gap-3 border-b-0' : 'mb-1 border-b pb-4',
          stepperMode && expanded && 'border-b pb-4',
        )}
        {...headerProps}
      >
        <div className="nc-encounter-section-card__heading flex items-start gap-3">
          {typeof step === 'number' && (
            <span className="nc-encounter-section-card__step mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--oe-nc-bg-tint,#ecfeff)] text-sm font-semibold text-[var(--color-oe-primary,#0891b2)]">
              {step}
            </span>
          )}
          <div className="nc-encounter-section-card__titles min-w-0">
            <h2 id={`encounter-section-${id}-title`} className="nc-encounter-section-card__title text-lg font-semibold tracking-tight text-[var(--oe-nc-text)]">
              {title}
            </h2>
            {description && (
              <p className="nc-encounter-section-card__description mt-1 max-w-2xl text-sm leading-relaxed text-[var(--oe-nc-text-muted)]">{description}</p>
            )}
          </div>
        </div>
        {stepperMode && (
          <ChevronDown
            className={cn(
              'mt-1 h-4 w-4 shrink-0 text-[var(--oe-nc-text-muted)] transition-transform duration-200',
              expanded && 'rotate-180',
            )}
            aria-hidden="true"
          />
        )}
      </header>
      {(!stepperMode || expanded) && (
        <div className={cn('nc-encounter-section-body px-5 pb-5', stepperMode && 'pt-0')}>
          {children}
        </div>
      )}
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
        'nc-encounter-status flex items-center gap-2 rounded-xl border px-3 py-2 text-sm',
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

export function EncounterStickyFooter({
  children,
  mobileFixed = false,
  className,
}: {
  children: ReactNode;
  mobileFixed?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'nc-encounter-footer sticky bottom-0 z-20 rounded-2xl border border-[var(--oe-nc-border)] bg-[color-mix(in_srgb,var(--oe-nc-surface,#fff)_94%,transparent)] py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur-md',
        mobileFixed && 'nc-encounter-footer--fixed rounded-none border-x-0',
        className,
      )}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-3">{children}</div>
    </div>
  );
}

export function EncounterSignedBanner({
  signMeta,
  supervisorName,
}: {
  signMeta: EncounterSignMeta;
  supervisorName?: string | null;
}) {
  return (
    <section
      className="nc-encounter-signed-banner rounded-2xl border border-[color-mix(in_srgb,var(--color-oe-cta,#047857)_30%,var(--oe-nc-border))] bg-[color-mix(in_srgb,var(--color-oe-cta,#047857)_6%,var(--oe-nc-surface,#fff))] p-4"
      aria-label="Signed consult note"
    >
      <h2 className="text-sm font-semibold text-[var(--color-oe-cta,#047857)]">Signed consultation note</h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {signMeta.author_display_name && (
          <div>
            <dt className="text-[var(--oe-nc-text-muted)]">Author</dt>
            <dd className="font-medium text-[var(--oe-nc-text)]">
              {signMeta.author_display_name}
              {signMeta.author_role ? ` · ${signMeta.author_role}` : ''}
            </dd>
          </div>
        )}
        {signMeta.signed_at && (
          <div>
            <dt className="text-[var(--oe-nc-text-muted)]">Signed</dt>
            <dd className="font-medium text-[var(--oe-nc-text)]">{signMeta.signed_at}</dd>
          </div>
        )}
        {supervisorName && (
          <div className="sm:col-span-2">
            <dt className="text-[var(--oe-nc-text-muted)]">Supervising provider</dt>
            <dd className="font-medium text-[var(--oe-nc-text)]">{supervisorName}</dd>
          </div>
        )}
        {signMeta.amendment && (
          <div className="sm:col-span-2">
            <dt className="text-[var(--oe-nc-text-muted)]">Signature note</dt>
            <dd className="font-medium text-[var(--oe-nc-text)]">{signMeta.amendment}</dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-sm text-[var(--oe-nc-text-muted)]">
        This note is locked. Managers can unlock it for clinical correction, then re-sign after editing.
      </p>
    </section>
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
        'nc-encounter-vitals-tile rounded-xl border px-3 py-3',
        abnormal
          ? 'border-[color-mix(in_srgb,var(--color-oe-danger,#b91c1c)_35%,var(--oe-nc-border))] bg-[color-mix(in_srgb,var(--color-oe-danger,#b91c1c)_6%,var(--oe-nc-surface,#fff))]'
          : 'border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint,#f0fdfa)]',
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--oe-nc-text-muted)]">{label}</div>
      <div className="mt-1.5 text-lg font-semibold text-[var(--oe-nc-text)]">{value}</div>
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
      className="nc-encounter-context-strip rounded-2xl border border-[color-mix(in_srgb,var(--color-oe-warning,#d97706)_28%,var(--oe-nc-border))] bg-[color-mix(in_srgb,var(--color-oe-warning,#d97706)_5%,var(--oe-nc-surface,#fff))] p-4"
      aria-label="Clinical context review"
    >
      <h2 className="text-sm font-semibold text-[var(--oe-nc-text)]">Safety check before you document</h2>
      <p className="mt-1 text-sm text-[var(--oe-nc-text-muted)]">
        Confirm allergies and medications from the chart before signing this consult note.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {showAllergies && (
          <div className="rounded-xl border border-[var(--oe-nc-border)] bg-[var(--oe-nc-surface,#fff)] p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium text-[var(--oe-nc-text)]">Allergies</h3>
                <p className="mt-1 text-sm text-[var(--oe-nc-text-muted)]">
                  {prefill.allergies.summary ?? 'Review allergy list'}
                </p>
              </div>
              {prefill.allergies.edit_url && (
                <a
                  className="text-xs font-medium text-[var(--color-oe-primary,#0891b2)] hover:underline"
                  href={prefill.allergies.edit_url}
                  target="_top"
                  rel="noreferrer"
                >
                  Edit
                </a>
              )}
            </div>
            <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-[var(--oe-nc-border)]"
                checked={acknowledged.allergies_acknowledged}
                disabled={readOnly}
                onChange={(event) => onAcknowledge({ allergies_acknowledged: event.target.checked })}
              />
              <span>I reviewed the allergy information for this patient</span>
            </label>
          </div>
        )}
        {showMeds && (
          <div className="rounded-xl border border-[var(--oe-nc-border)] bg-[var(--oe-nc-surface,#fff)] p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium text-[var(--oe-nc-text)]">Medications</h3>
                <p className="mt-1 text-sm text-[var(--oe-nc-text-muted)]">
                  {prefill.medications.summary ?? 'Review medication list'}
                </p>
              </div>
              {prefill.medications.edit_url && (
                <a
                  className="text-xs font-medium text-[var(--color-oe-primary,#0891b2)] hover:underline"
                  href={prefill.medications.edit_url}
                  target="_top"
                  rel="noreferrer"
                >
                  Edit
                </a>
              )}
            </div>
            <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-[var(--oe-nc-border)]"
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
