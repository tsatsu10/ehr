import type { ReactNode, RefObject } from 'react';
import { useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import type { FrontDeskPreviewData } from '@core/types';
import { CompletionRing } from '@components/CompletionRing';
import { CompletionScorePill } from '@components/CompletionScorePill';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { bannerPropsFromPreview } from '@components/bannerPreviewProps';
import { Card, CardContent } from '@components/ui/card';
import { cn } from '@/lib/utils';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { StartVisitForm } from './StartVisitForm';
import { RegistrationForm, type RegistrationFormHandle } from './RegistrationForm';
import { QuickAddRegistration } from './QuickAddRegistration';
import { ActiveVisitBanner } from './RevisitGatePanel';
import { ActiveVisitHardAssign } from './ActiveVisitHardAssign';
import { CancelVisitModal } from './CancelVisitModal';
import { TodaysVisitsList } from './TodaysVisitsList';
import { PreviewEmptyState } from './PreviewEmptyState';
import { PreviewLoadingState } from './PreviewLoadingState';
import { Pencil, FolderOpen, CalendarCheck, AlertCircle, XCircle, BellRing } from 'lucide-react';
import { badgeVariants } from '@components/ui/badge';

type PreviewPaneMode = 'empty' | 'loading' | 'preview' | 'registration' | 'registration-pinned';

interface PatientPreviewPaneProps {
  mode: PreviewPaneMode;
  preview: FrontDeskPreviewData | null;
  pid: number | null;
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  moduleUrl: string;
  visitBoardUrl?: string;
  registrationMode: string;
  printQueueSlip: boolean;
  canCancelVisit?: boolean;
  canSkipTriage?: boolean;
  canRevisitOverride?: boolean;
  enforceCompletionOnRevisit?: boolean;
  wizardMode?: boolean;
  embedded?: boolean;
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
  onRegistrationDiscardConfirm?: (onProceed: () => void) => void;
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
  const missingCaption = missing.length > 0
    ? `Missing: ${missing.slice(0, 2).join(', ')}${missing.length > 2 ? '…' : ''}`
    : undefined;

  return (
    <>
      {belowThreshold && (
        <div className="oe-nc-warn-callout mb-3 rounded-xl px-4 py-3 flex items-start justify-between gap-3" id="nc-completion-banner">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold text-amber-900">Profile incomplete for billing</span>
              {' — '}{completion.score}% of {threshold}% required.
              {missing.length > 0 && (
                <div className="text-xs text-amber-700 mt-0.5">
                  Missing: {missing.slice(0, 3).join(', ')}{missing.length > 3 ? '…' : ''}
                </div>
              )}
            </div>
          </div>
          {showCompleteNow && (
            <Button variant="warning" size="sm" id="nc-complete-now" onClick={onCompleteNow}>
              Complete now
            </Button>
          )}
        </div>
      )}
      <div className="oe-nc-completion-summary flex items-center gap-3 mb-3 rounded-lg border border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint)] px-3 py-2.5">
        <CompletionRing
          score={completion.score ?? 0}
          threshold={threshold}
          size={64}
          className="shrink-0"
        />
        <div>
          <div className="text-sm font-semibold text-(--oe-nc-text)">Profile completion</div>
          {missingCaption && (
            <div className="text-xs text-(--oe-nc-text-muted) mt-0.5">{missingCaption}</div>
          )}
          {!belowThreshold && (
            <div className="text-xs text-emerald-600 mt-0.5 font-medium">Ready for billing</div>
          )}
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
  wizardMode,
  ajaxUrl,
  csrfToken,
  onRegistrationSaved,
  onRegistrationUseExisting,
  onRegistrationCancel,
  onRegistrationDiscardConfirm,
}: {
  registrationMode: string;
  registrationPid?: number;
  registrationPrefill?: string;
  registrationFormRef?: RefObject<RegistrationFormHandle | null>;
  wizardMode?: boolean;
  ajaxUrl: string;
  csrfToken: string;
  onRegistrationSaved: (pid: number, startAfter?: boolean) => void;
  onRegistrationUseExisting: (pid: number) => void;
  onRegistrationCancel: () => void;
  onRegistrationDiscardConfirm?: (onProceed: () => void) => void;
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
        onDiscardConfirm={onRegistrationDiscardConfirm}
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
      wizardMode={wizardMode}
      onSaved={onRegistrationSaved}
      onUseExisting={onRegistrationUseExisting}
      onCancel={onRegistrationCancel}
      onDiscardConfirm={onRegistrationDiscardConfirm}
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
  visitBoardUrl,
  printQueueSlip,
  canCancelVisit = false,
  canSkipTriage = false,
  canRevisitOverride = false,
  enforceCompletionOnRevisit = true,
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
  visitBoardUrl?: string;
  printQueueSlip: boolean;
  canCancelVisit?: boolean;
  canSkipTriage?: boolean;
  canRevisitOverride?: boolean;
  enforceCompletionOnRevisit?: boolean;
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
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const identity = preview.identity;
  const completion = preview.completion;
  const appointment = preview.appointment_today ?? preview.chips?.appointment_today ?? null;
  const recallDue = preview.recall_due ?? preview.chips?.recall_due ?? null;
  const activeVisit = preview.active_visit;

  const chartUrl = completion.chart_open_url || completion.chart_url;

  const handleCancelVisit = async (reason: string) => {
    if (!activeVisit) return;
    setCancelSubmitting(true);
    setCancelError(null);
    try {
      await oeFetch('visit.cancel', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: {
          visit_id: activeVisit.visit_id,
          row_version: activeVisit.row_version ?? 0,
          reason,
        },
        params: facilityId > 0 ? { facility_id: facilityId } : undefined,
      });
      setCancelOpen(false);
      onPreviewRefresh();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setCancelSubmitting(false);
    }
  };

  return (
    <div id="nc-patient-context-banner">
      <PatientContextBanner
        identity={identity}
        layout="full"
        completion={completion}
        safety={preview.safety}
        {...bannerPropsFromPreview(preview)}
        aside={(
          <CompletionScorePill
            score={completion.score ?? 0}
            threshold={completion.billing_threshold}
          />
        )}
      >
        <CompletionSummary
          preview={preview}
          registrationMode={registrationMode}
          onCompleteNow={onCompleteNow}
        />

      {preview.visits_today && preview.visits_today.length > 0 && (
        <TodaysVisitsList visits={preview.visits_today} />
      )}

      {activeVisit && (
        <ActiveVisitBanner
          queueNumber={activeVisit.queue_number}
          state={activeVisit.state}
          visitBoardUrl={visitBoardUrl}
          canCancelVisit={canCancelVisit}
          onCancelVisit={() => setCancelOpen(true)}
          showWrongVisitTypeHint={activeVisit.state === 'waiting'}
        />
      )}

      {activeVisit
        && preview.hard_provider_assignment_enabled
        && preview.can_hard_assign_provider
        && (preview.assignable_doctors?.length ?? 0) > 0 && (
        <ActiveVisitHardAssign
          visitId={activeVisit.visit_id}
          rowVersion={activeVisit.row_version ?? 0}
          state={activeVisit.state}
          currentProviderId={activeVisit.hard_assigned_provider_id}
          currentProviderName={activeVisit.hard_assigned_provider_name}
          doctors={preview.assignable_doctors ?? []}
          ajaxUrl={ajaxUrl}
          csrfToken={csrfToken}
          facilityId={facilityId}
          onSaved={onPreviewRefresh}
        />
      )}

      {!activeVisit && appointment && (
        <div className="mb-3">
          <Badge variant="info" title={appointment.tooltip ?? undefined}>
            <CalendarCheck className="h-3 w-3" />
            Appointment today
            {appointment.start_time_label ? ` · ${appointment.start_time_label}` : ''}
            {appointment.provider_name ? ` · ${appointment.provider_name}` : ''}
          </Badge>
        </div>
      )}

      {!activeVisit && recallDue && (
        <div className="mb-3">
          <a
            href={recallDue.worklist_url}
            target="_top"
            title={recallDue.reason || recallDue.label}
            className={cn(badgeVariants({ variant: 'warning' }), 'no-underline hover:opacity-90')}
          >
            <BellRing className="h-3 w-3" />
            Recall due
            {' · '}
            {recallDue.label}
          </a>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        <Button
          variant="outline"
          size="sm"
          id="nc-edit-profile"
          onClick={onEditProfile}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit profile
        </Button>
        {chartUrl && (
          <Button variant="outline" size="sm" asChild>
            <a target="_top" href={chartUrl}>
              <FolderOpen className="h-3.5 w-3.5" />
              Open chart
            </a>
          </Button>
        )}
        {activeVisit && canCancelVisit && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setCancelOpen(true)}
          >
            <XCircle className="h-3.5 w-3.5" />
            Cancel today&apos;s visit
          </Button>
        )}
      </div>

      {showStartVisit && !activeVisit && (
        <StartVisitForm
          ajaxUrl={ajaxUrl}
          csrfToken={csrfToken}
          facilityId={facilityId}
          pid={pid}
          preview={preview}
          moduleUrl={moduleUrl}
          printQueueSlip={printQueueSlip}
          visitBoardUrl={visitBoardUrl}
          canSkipTriage={canSkipTriage}
          canRevisitOverride={canRevisitOverride}
          enforceCompletionOnRevisit={enforceCompletionOnRevisit}
          autoStart={autoStartVisit}
          onAutoStartConsumed={onAutoStartVisitConsumed}
          onStarted={onPreviewRefresh}
          onCompleteNow={onCompleteNow}
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
      </PatientContextBanner>
      <CancelVisitModal
        open={cancelOpen}
        displayName={identity.display_name}
        pubpid={identity.pubpid}
        queueNumber={activeVisit?.queue_number}
        submitting={cancelSubmitting}
        error={cancelError}
        onClose={() => setCancelOpen(false)}
        onConfirm={(reason) => void handleCancelVisit(reason)}
        suggestWrongVisitType={activeVisit?.state === 'waiting'}
      />
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
  visitBoardUrl,
  registrationMode,
  printQueueSlip,
  canCancelVisit,
  canSkipTriage,
  canRevisitOverride,
  enforceCompletionOnRevisit,
  wizardMode = false,
  embedded = false,
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
  onRegistrationDiscardConfirm,
}: PatientPreviewPaneProps) {
  // Identity-first preview: the patient banner is the hero. Outer card title
  // is reserved for registration mode where the section needs labelling.
  const shell = (title: string | undefined, inner: ReactNode) => {
    if (embedded) {
      return <div className="oe-nc-desk-split__preview" id="nc-preview-pane">{inner}</div>;
    }
    if (title) {
      return (
        <Card className="oe-nc-desk-split__preview oe-nc-preview-pane overflow-hidden" id="nc-preview-pane">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--oe-nc-border)]">
            <h2 className="text-sm font-semibold leading-tight text-[var(--oe-nc-text)] m-0">{title}</h2>
          </div>
          <CardContent className="p-5">{inner}</CardContent>
        </Card>
      );
    }
    return (
      <Card className="oe-nc-desk-split__preview oe-nc-preview-pane overflow-hidden" id="nc-preview-pane">
        <CardContent className="oe-nc-preview-pane__scroll p-4">{inner}</CardContent>
      </Card>
    );
  };

  if (mode === 'empty') {
    return shell(undefined, <PreviewEmptyState />);
  }

  if (mode === 'loading') {
    return shell(undefined, <PreviewLoadingState />);
  }

  if (mode === 'registration') {
    const title = registrationPid ? 'Edit profile' : 'Register patient';
    return shell(
      title,
      (
        <RegistrationContent
          registrationMode={registrationMode}
          registrationPid={registrationPid}
          registrationPrefill={registrationPrefill}
          registrationFormRef={registrationFormRef}
          wizardMode={wizardMode}
          ajaxUrl={ajaxUrl}
          csrfToken={csrfToken}
          onRegistrationSaved={onRegistrationSaved}
          onRegistrationUseExisting={onRegistrationUseExisting}
          onRegistrationCancel={onRegistrationCancel}
          onRegistrationDiscardConfirm={onRegistrationDiscardConfirm}
        />
      ),
    );
  }

  if (mode === 'registration-pinned' && preview && pid) {
    const title = registrationPid ? 'Edit profile' : 'Register patient';
    return shell(
      title,
      (
        <PreviewBanner
            preview={preview}
            pid={pid}
            registrationMode={registrationMode}
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            facilityId={facilityId}
            moduleUrl={moduleUrl}
            visitBoardUrl={visitBoardUrl}
            printQueueSlip={printQueueSlip}
            canCancelVisit={canCancelVisit}
            canSkipTriage={canSkipTriage}
            canRevisitOverride={canRevisitOverride}
            enforceCompletionOnRevisit={enforceCompletionOnRevisit}
            registrationWorkRef={registrationWorkRef}
            registrationContent={(
              <RegistrationContent
                registrationMode={registrationMode}
                registrationPid={registrationPid}
                registrationPrefill={registrationPrefill}
                registrationFormRef={registrationFormRef}
                wizardMode={wizardMode}
                ajaxUrl={ajaxUrl}
                csrfToken={csrfToken}
                onRegistrationSaved={onRegistrationSaved}
                onRegistrationUseExisting={onRegistrationUseExisting}
                onRegistrationCancel={onRegistrationCancel}
                onRegistrationDiscardConfirm={onRegistrationDiscardConfirm}
              />
            )}
            showStartVisit={false}
            onEditProfile={onEditProfile}
            onCompleteNow={onCompleteNow}
            onPreviewRefresh={onPreviewRefresh}
            onStartVisitDirtyChange={onStartVisitDirtyChange}
        />
      ),
    );
  }

  if (!preview || !pid) {
    return shell(undefined, <div className="alert alert-danger m-0">Failed to load preview.</div>);
  }

  return shell(
    undefined,
    (
      <PreviewBanner
          preview={preview}
          pid={pid}
          registrationMode={registrationMode}
          ajaxUrl={ajaxUrl}
          csrfToken={csrfToken}
          facilityId={facilityId}
          moduleUrl={moduleUrl}
          visitBoardUrl={visitBoardUrl}
          printQueueSlip={printQueueSlip}
          canCancelVisit={canCancelVisit}
          canSkipTriage={canSkipTriage}
          canRevisitOverride={canRevisitOverride}
          enforceCompletionOnRevisit={enforceCompletionOnRevisit}
          showStartVisit
          autoStartVisit={autoStartVisit}
          onAutoStartVisitConsumed={onAutoStartVisitConsumed}
          onEditProfile={onEditProfile}
          onCompleteNow={onCompleteNow}
          onPreviewRefresh={onPreviewRefresh}
          onStartVisitDirtyChange={onStartVisitDirtyChange}
        />
    ),
  );
}
