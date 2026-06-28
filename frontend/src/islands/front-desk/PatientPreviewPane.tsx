import type { ReactNode, RefObject } from 'react';
import type { FrontDeskPreviewData } from '@core/types';
import { StatusPill } from '@components/StatusPill';
import { completionVariant, initialsFromName } from './frontDeskUtils';
import { StartVisitForm } from './StartVisitForm';
import { RegistrationForm, type RegistrationFormHandle } from './RegistrationForm';
import { QuickAddRegistration } from './QuickAddRegistration';

type PreviewPaneMode = 'empty' | 'loading' | 'preview' | 'registration' | 'registration-pinned';

interface PatientPreviewPaneProps {
  mode: PreviewPaneMode;
  preview: FrontDeskPreviewData | null;
  pid: number | null;
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  moduleUrl: string;
  registrationMode: string;
  printQueueSlip: boolean;
  registrationWorkRef: RefObject<HTMLDivElement | null>;
  onEditProfile: () => void;
  onCompleteNow: () => void;
  onPreviewRefresh: () => void;
  onStartVisitDirtyChange: (dirty: boolean) => void;
  registrationPid?: number;
  registrationPrefill?: string;
  registrationFormRef?: RefObject<RegistrationFormHandle | null>;
  autoStartVisit?: boolean;
  onAutoStartVisitConsumed?: () => void;
  onRegistrationSaved: (pid: number, startAfter?: boolean) => void;
  onRegistrationUseExisting: (pid: number) => void;
  onRegistrationCancel: () => void;
}

function SafetyStrip({ preview }: { preview: FrontDeskPreviewData }) {
  const safety = preview.safety ?? {};
  const chips: { label: string; variant: 'warn' | 'severe' }[] = [];

  if (safety.allergies_undocumented) {
    chips.push({ label: 'Allergies undocumented', variant: 'warn' });
  } else {
    (safety.allergies_severe ?? []).slice(0, 3).forEach((allergy) => {
      chips.push({ label: allergy, variant: 'severe' });
    });
    const extra = (safety.allergies_severe ?? []).length - 3;
    if (extra > 0) {
      chips.push({ label: `+${extra} more`, variant: 'warn' });
    }
  }

  if (!chips.length) return null;

  return (
    <div className="oe-nc-patient-banner__section">
      <div className="oe-nc-chip-cloud">
        {chips.map((chip) => (
          <span
            key={chip.label}
            className={`oe-nc-chip oe-nc-chip--${chip.variant === 'severe' ? 'severe' : 'warn'}`}
          >
            {chip.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function CompletionSummary({
  preview,
  registrationMode,
  onCompleteNow,
}: {
  preview: FrontDeskPreviewData;
  registrationMode: string;
  onCompleteNow: () => void;
}) {
  const completion = preview.completion;
  if (completion.score === undefined) return null;

  const threshold = completion.billing_threshold || 70;
  const missing = completion.missing_labels ?? [];
  const belowThreshold = (completion.score || 0) < threshold;
  const showCompleteNow = registrationMode === 'desk_full_form' && belowThreshold;

  return (
    <>
      {belowThreshold && (
        <div className="alert alert-warning py-2 mb-2" id="nc-completion-banner">
          <div className="d-flex flex-wrap align-items-start justify-content-between">
            <div>
              <strong>Profile incomplete for billing</strong>
              {' — '}
              {completion.score}% of {threshold}% required.
              {missing.length > 0 && (
                <div className="small text-muted mt-1">
                  Missing: {missing.slice(0, 3).join(', ')}{missing.length > 3 ? '…' : ''}
                </div>
              )}
            </div>
            {showCompleteNow && (
              <button
                type="button"
                className="btn btn-sm btn-outline-warning ml-2 mt-1 mt-md-0"
                id="nc-complete-now"
                onClick={onCompleteNow}
              >
                Complete now
              </button>
            )}
          </div>
        </div>
      )}
      <div className="oe-nc-patient-banner__section">
        <div className="oe-nc-progress-bar" role="progressbar" aria-valuenow={completion.score} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="oe-nc-progress-bar__fill"
            style={{ width: `${Math.min(completion.score, 100)}%` }}
          />
        </div>
      </div>
    </>
  );
}

function RegistrationContent({
  registrationMode,
  registrationPid,
  registrationPrefill,
  registrationFormRef,
  ajaxUrl,
  csrfToken,
  onRegistrationSaved,
  onRegistrationUseExisting,
  onRegistrationCancel,
}: {
  registrationMode: string;
  registrationPid?: number;
  registrationPrefill?: string;
  registrationFormRef?: RefObject<RegistrationFormHandle | null>;
  ajaxUrl: string;
  csrfToken: string;
  onRegistrationSaved: (pid: number, startAfter?: boolean) => void;
  onRegistrationUseExisting: (pid: number) => void;
  onRegistrationCancel: () => void;
}) {
  const formKey = `reg-${registrationPid ?? 'new'}-${registrationPrefill ?? ''}`;
  const useQuickAdd = registrationMode === 'progressive' && !registrationPid;

  if (useQuickAdd) {
    return (
      <QuickAddRegistration
        key={formKey}
        ref={registrationFormRef}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        prefill={registrationPrefill}
        onSaved={onRegistrationSaved}
        onUseExisting={onRegistrationUseExisting}
        onCancel={onRegistrationCancel}
      />
    );
  }

  return (
    <RegistrationForm
      key={formKey}
      ref={registrationFormRef}
      ajaxUrl={ajaxUrl}
      csrfToken={csrfToken}
      pid={registrationPid}
      prefill={registrationPrefill}
      registrationMode={registrationMode}
      onSaved={onRegistrationSaved}
      onUseExisting={onRegistrationUseExisting}
      onCancel={onRegistrationCancel}
    />
  );
}

function PreviewBanner({
  preview,
  pid,
  registrationMode,
  ajaxUrl,
  csrfToken,
  facilityId,
  moduleUrl,
  printQueueSlip,
  registrationWorkRef,
  showStartVisit,
  autoStartVisit,
  onAutoStartVisitConsumed,
  onEditProfile,
  onCompleteNow,
  onPreviewRefresh,
  onStartVisitDirtyChange,
  registrationContent,
}: {
  preview: FrontDeskPreviewData;
  pid: number;
  registrationMode: string;
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  moduleUrl: string;
  printQueueSlip: boolean;
  registrationWorkRef?: RefObject<HTMLDivElement | null>;
  showStartVisit: boolean;
  autoStartVisit?: boolean;
  onAutoStartVisitConsumed?: () => void;
  onEditProfile: () => void;
  onCompleteNow: () => void;
  onPreviewRefresh: () => void;
  onStartVisitDirtyChange: (dirty: boolean) => void;
  registrationContent?: ReactNode;
}) {
  const identity = preview.identity;
  const completion = preview.completion;
  const appointment = preview.appointment_today ?? preview.chips?.appointment_today ?? null;
  const metaLine = [
    identity.sex || '—',
    identity.age_years ?? '—',
    `MRN ${identity.pubpid || '—'}`,
    identity.phone_masked ? identity.phone_masked : null,
  ].filter(Boolean).join(' · ');

  const chartUrl = completion.chart_open_url || completion.chart_url;

  return (
    <div className="oe-nc-patient-banner nc-patient-context-banner" id="nc-patient-context-banner">
      <div className="oe-nc-patient-banner__header">
        <div className="oe-nc-patient-banner__avatar" aria-hidden="true">
          {initialsFromName(identity.display_name)}
        </div>
        <div className="oe-nc-patient-banner__identity">
          <h3 className="oe-nc-patient-banner__name">{identity.display_name}</h3>
          <div className="oe-nc-patient-banner__meta">{metaLine}</div>
        </div>
        <div className="oe-nc-patient-banner__aside text-right">
          <span className={`oe-nc-status-pill oe-nc-status-pill--${completionVariant(completion.score ?? 0, completion.billing_threshold)}`}>
            <span className="oe-nc-status-pill__dot" aria-hidden="true" />
            <span>{completion.score ?? 0}% complete</span>
          </span>
        </div>
      </div>

      <SafetyStrip preview={preview} />
      <CompletionSummary
        preview={preview}
        registrationMode={registrationMode}
        onCompleteNow={onCompleteNow}
      />

      {preview.active_visit && (
        <div className="oe-nc-patient-banner__section">
          <StatusPill
            state={preview.active_visit.state}
            queueNumber={String(preview.active_visit.queue_number)}
          />
        </div>
      )}

      {!preview.active_visit && appointment && (
        <div className="oe-nc-patient-banner__section">
          <span
            className="oe-nc-status-pill oe-nc-status-pill--info"
            title={appointment.tooltip ?? undefined}
          >
            <span className="oe-nc-status-pill__dot" aria-hidden="true" />
            <span>
              Appointment today
              {appointment.start_time_label ? ` · ${appointment.start_time_label}` : ''}
              {appointment.provider_name ? ` · ${appointment.provider_name}` : ''}
            </span>
          </span>
        </div>
      )}

      <div className="d-flex flex-wrap mb-2">
        <button
          type="button"
          className="btn btn-sm btn-outline-primary mr-2"
          id="nc-edit-profile"
          onClick={onEditProfile}
        >
          <i className="fa fa-pen mr-1" aria-hidden="true" />
          Edit profile
        </button>
        {chartUrl && (
          <a
            className="btn btn-sm btn-outline-secondary"
            target="_top"
            href={chartUrl}
          >
            <i className="fa fa-folder-open mr-1" aria-hidden="true" />
            Open chart
          </a>
        )}
      </div>

      {showStartVisit && (
        <StartVisitForm
          ajaxUrl={ajaxUrl}
          csrfToken={csrfToken}
          facilityId={facilityId}
          pid={pid}
          preview={preview}
          moduleUrl={moduleUrl}
          printQueueSlip={printQueueSlip}
          autoStart={autoStartVisit}
          onAutoStartConsumed={onAutoStartVisitConsumed}
          onStarted={onPreviewRefresh}
          onDirtyChange={onStartVisitDirtyChange}
        />
      )}

      {registrationWorkRef && (
        <div
          id="nc-preview-work"
          className="nc-preview-work mt-2"
          ref={registrationWorkRef}
        >
          {registrationContent}
        </div>
      )}
    </div>
  );
}

export function PatientPreviewPane({
  mode,
  preview,
  pid,
  ajaxUrl,
  csrfToken,
  facilityId,
  moduleUrl,
  registrationMode,
  printQueueSlip,
  registrationWorkRef,
  onEditProfile,
  onCompleteNow,
  onPreviewRefresh,
  onStartVisitDirtyChange,
  registrationPid,
  registrationPrefill,
  registrationFormRef,
  autoStartVisit,
  onAutoStartVisitConsumed,
  onRegistrationSaved,
  onRegistrationUseExisting,
  onRegistrationCancel,
}: PatientPreviewPaneProps) {
  if (mode === 'empty') {
    return (
      <div className="oe-nc-widget-card oe-nc-desk-split__preview">
        <div className="oe-nc-widget-card__header">
          <h2 className="oe-nc-widget-card__title">Patient preview</h2>
        </div>
        <div className="oe-nc-widget-card__body oe-nc-widget-card__body--pad" id="nc-preview-pane">
          <div className="oe-nc-empty-state text-center py-5">
            <i className="fa fa-search fa-2x text-muted mb-3" aria-hidden="true" />
            <h3 className="h6">No patient selected</h3>
            <p className="text-muted mb-0">
              Search by name, phone, NHIS, National ID, or MRN — then pick a row to preview.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'loading') {
    return (
      <div className="oe-nc-widget-card oe-nc-desk-split__preview">
        <div className="oe-nc-widget-card__body oe-nc-widget-card__body--pad" id="nc-preview-pane">
          <em>Loading preview…</em>
        </div>
      </div>
    );
  }

  if (mode === 'registration') {
    const title = registrationPid ? 'Edit profile' : 'Register patient';
    return (
      <div className="oe-nc-widget-card oe-nc-desk-split__preview">
        <div className="oe-nc-widget-card__header">
          <h2 className="oe-nc-widget-card__title">{title}</h2>
        </div>
        <div className="oe-nc-widget-card__body oe-nc-widget-card__body--pad" id="nc-preview-pane">
          <RegistrationContent
            registrationMode={registrationMode}
            registrationPid={registrationPid}
            registrationPrefill={registrationPrefill}
            registrationFormRef={registrationFormRef}
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            onRegistrationSaved={onRegistrationSaved}
            onRegistrationUseExisting={onRegistrationUseExisting}
            onRegistrationCancel={onRegistrationCancel}
          />
        </div>
      </div>
    );
  }

  if (mode === 'registration-pinned' && preview && pid) {
    const title = registrationPid ? 'Edit profile' : 'Register patient';
    return (
      <div className="oe-nc-widget-card oe-nc-desk-split__preview">
        <div className="oe-nc-widget-card__header">
          <h2 className="oe-nc-widget-card__title">{title}</h2>
        </div>
        <div className="oe-nc-widget-card__body oe-nc-widget-card__body--pad" id="nc-preview-pane">
          <PreviewBanner
            preview={preview}
            pid={pid}
            registrationMode={registrationMode}
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            facilityId={facilityId}
            moduleUrl={moduleUrl}
            printQueueSlip={printQueueSlip}
            registrationWorkRef={registrationWorkRef}
            registrationContent={(
              <RegistrationContent
                registrationMode={registrationMode}
                registrationPid={registrationPid}
                registrationPrefill={registrationPrefill}
                registrationFormRef={registrationFormRef}
                ajaxUrl={ajaxUrl}
                csrfToken={csrfToken}
                onRegistrationSaved={onRegistrationSaved}
                onRegistrationUseExisting={onRegistrationUseExisting}
                onRegistrationCancel={onRegistrationCancel}
              />
            )}
            showStartVisit={false}
            onEditProfile={onEditProfile}
            onCompleteNow={onCompleteNow}
            onPreviewRefresh={onPreviewRefresh}
            onStartVisitDirtyChange={onStartVisitDirtyChange}
          />
        </div>
      </div>
    );
  }

  if (!preview || !pid) {
    return (
      <div className="oe-nc-widget-card oe-nc-desk-split__preview">
        <div className="oe-nc-widget-card__body oe-nc-widget-card__body--pad" id="nc-preview-pane">
          <div className="alert alert-danger m-0">Failed to load preview.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="oe-nc-widget-card oe-nc-desk-split__preview">
      <div className="oe-nc-widget-card__header">
        <h2 className="oe-nc-widget-card__title">Patient preview</h2>
      </div>
      <div className="oe-nc-widget-card__body oe-nc-widget-card__body--pad" id="nc-preview-pane">
        <PreviewBanner
          preview={preview}
          pid={pid}
          registrationMode={registrationMode}
          ajaxUrl={ajaxUrl}
          csrfToken={csrfToken}
          facilityId={facilityId}
          moduleUrl={moduleUrl}
          printQueueSlip={printQueueSlip}
          showStartVisit
          autoStartVisit={autoStartVisit}
          onAutoStartVisitConsumed={onAutoStartVisitConsumed}
          onEditProfile={onEditProfile}
          onCompleteNow={onCompleteNow}
          onPreviewRefresh={onPreviewRefresh}
          onStartVisitDirtyChange={onStartVisitDirtyChange}
        />
      </div>
    </div>
  );
}
