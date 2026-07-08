import type { ReactNode } from 'react';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
} from 'lucide-react';

export const REGISTRATION_SECTION_META = [
  {
    section: 1,
    title: 'Basic info',
    subtitle: 'Name, sex, date of birth, phone',
    required: true,
  },
  {
    section: 2,
    title: 'Contact & identity',
    subtitle: 'Address, region, emergency contact',
    required: true,
  },
  {
    section: 3,
    title: 'Clinical & demographics',
    subtitle: 'Allergies, chronic conditions, background',
    required: false,
  },
  {
    section: 4,
    title: 'Admin & insurance',
    subtitle: 'Coverage and billing details',
    required: false,
  },
] as const;

export const REGISTRATION_SECTION_TITLES = REGISTRATION_SECTION_META.map((s) => s.title);

export function RegistrationShell({
  children,
  footer,
  id = 'nc-registration-form',
  className,
}: {
  children: ReactNode;
  footer?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn('nc-registration-shell', className)} id={id}>
      <div className="nc-registration-shell__body">{children}</div>
      {footer ? <div className="nc-registration-shell__footer">{footer}</div> : null}
    </div>
  );
}

export function RegistrationHeader({
  title,
  hideTitle = false,
  completionScore,
  autoSaveLabel,
  showAutoSave,
  onBack,
  backLabel = 'Back to search',
}: {
  title: string;
  hideTitle?: boolean;
  completionScore: number | null;
  autoSaveLabel?: string | null;
  showAutoSave?: boolean;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <header className="nc-registration-header">
      <div className="nc-registration-header__main">
        {onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="nc-registration-header__back"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {backLabel}
          </Button>
        ) : null}
        <div className="nc-registration-header__text">
          {!hideTitle ? (
            <h2 className="nc-registration-header__title">{title}</h2>
          ) : null}
          <p className="nc-registration-header__sub">
            {hideTitle
              ? 'Complete required sections to register — optional sections improve care quality.'
              : 'Four sections — save each as you go. Sections 1–2 are required before a visit.'}
          </p>
        </div>
        <div className="nc-registration-header__icon" aria-hidden="true">
          <ClipboardList className="h-5 w-5" />
        </div>
      </div>
      <div className="nc-registration-header__meta">
        <Badge variant="neutral" id="nc-reg-completion" className="nc-registration-header__completion">
          {completionScore == null ? '—' : `${completionScore}% complete`}
        </Badge>
        {showAutoSave && autoSaveLabel ? (
          <Badge variant="outline" className="text-xs gap-1.5" id="nc-reg-autosave">
            <Clock className="h-3 w-3" aria-hidden />
            {autoSaveLabel}
          </Badge>
        ) : null}
      </div>
    </header>
  );
}

export function RegistrationProgressRail({
  activeSection,
  missingKeys,
  onSectionSelect,
  sectionComplete,
}: {
  activeSection: number;
  missingKeys: string[];
  onSectionSelect: (section: number) => void;
  sectionComplete: (section: number, missing: string[]) => boolean;
}) {
  return (
    <nav
      className="nc-registration-progress"
      aria-label="Registration sections"
      id="nc-reg-progress-rail"
    >
      <ol className="nc-registration-progress__list">
        {REGISTRATION_SECTION_META.map((meta) => {
          const complete = sectionComplete(meta.section, missingKeys);
          const isActive = activeSection === meta.section;
          return (
            <li key={meta.section} className="nc-registration-progress__item">
              <button
                type="button"
                className={cn(
                  'nc-registration-progress__step',
                  isActive && 'nc-registration-progress__step--active',
                  complete && 'nc-registration-progress__step--complete',
                )}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`${meta.title}${meta.required ? '' : ' (optional)'}${complete ? ', complete' : ''}`}
                onClick={() => onSectionSelect(meta.section)}
              >
                <span className="nc-registration-progress__index" aria-hidden="true">
                  {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : meta.section}
                </span>
                <span className="nc-registration-progress__label">
                  <span className="nc-registration-progress__title">{meta.title}</span>
                  {!meta.required ? (
                    <span className="nc-registration-progress__optional">Optional</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function RegistrationFooterBar({
  busy,
  activeSection,
  sectionTitle,
  chartMode,
  showSaveAndStart,
  error,
  success,
  onSave,
  onSaveAndStart,
  onCancel,
  cancelLabel = 'Cancel',
}: {
  busy: boolean;
  activeSection: number;
  sectionTitle: string;
  chartMode?: boolean;
  showSaveAndStart?: boolean;
  error?: string;
  success?: string;
  onSave: () => void;
  onSaveAndStart?: () => void;
  onCancel: () => void;
  cancelLabel?: string;
}) {
  const saveLabel = chartMode ? 'Save changes' : `Save section ${activeSection}`;

  return (
    <div className="nc-registration-footer" role="group" aria-label="Registration actions">
      <div className="nc-registration-footer__feedback">
        {error ? (
          <p className="nc-registration-footer__error" id="nc-reg-error" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="nc-registration-footer__success" id="nc-reg-success" role="status">
            {success}
          </p>
        ) : null}
        {!error && !success ? (
          <p className="nc-registration-footer__hint">
            Saving <strong>{sectionTitle}</strong>
            {activeSection > 1 ? ' — section 1 must exist first' : ''}
          </p>
        ) : null}
      </div>
      <div className="nc-registration-footer__actions">
        <Button
          type="button"
          variant="outline"
          id="nc-reg-cancel"
          disabled={busy}
          onClick={onCancel}
        >
          {cancelLabel}
        </Button>
        <Button type="button" id="nc-reg-save" disabled={busy} onClick={onSave} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden /> : null}
          <span>{saveLabel}</span>
        </Button>
        {showSaveAndStart ? (
          <Button
            type="button"
            variant="cta"
            id="nc-reg-save-start"
            disabled={busy}
            onClick={onSaveAndStart}
          >
            Save &amp; Start visit
          </Button>
        ) : null}
      </div>
    </div>
  );
}
