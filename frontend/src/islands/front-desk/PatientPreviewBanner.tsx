/**
 * PatientPreviewBanner — the rich patient context panel shown inside the preview pane.
 * Contains: CompletionSummary, status chips, active-visit controls, StartVisitForm, and
 * the secondary action row. Extracted from PatientPreviewPane for size management.
 */

import { useCallback, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { oeFetch } from '@core/oeFetch';
import type { FrontDeskPreviewData } from '@core/types';
import { CompletionRing } from '@components/CompletionRing';
import { CompletionScorePill } from '@components/CompletionScorePill';
import { DeskAlert } from '@components/DeskAlert';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { bannerPropsFromPreview } from '@components/bannerPreviewProps';
import { Button } from '@components/ui/button';
import { Badge, badgeVariants } from '@components/ui/badge';
import { cn } from '@/lib/utils';
import { StartVisitForm } from './StartVisitForm';
import { ActiveVisitBanner } from './RevisitGatePanel';
import { ActiveVisitHardAssign } from './ActiveVisitHardAssign';
import { CancelVisitModal } from './CancelVisitModal';
import { TodaysVisitsList } from './TodaysVisitsList';
import { Pencil, FolderOpen, CalendarCheck, AlertCircle, XCircle, BellRing } from 'lucide-react';

// ── CompletionSummary ─────────────────────────────────────────────────────────

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
  // Only show missing labels in the ring caption when the alert is NOT shown
  // (i.e. profile is complete), to avoid showing the same list twice.
  const missingCaption = !belowThreshold && missing.length > 0
    ? `Missing: ${missing.slice(0, 2).join(', ')}${missing.length > 2 ? '…' : ''}`
    : undefined;

  return (
    <>
      {belowThreshold && (
        <DeskAlert tone="warn" className="mb-3 rounded-xl px-4 py-3 flex items-start justify-between gap-3" id="nc-completion-banner">
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
        </DeskAlert>
      )}
      <div className="oe-nc-completion-summary flex items-center gap-3 mb-3 rounded-lg border border-(--oe-nc-border) bg-(--oe-nc-bg-tint) px-3 py-2.5">
        <CompletionRing score={completion.score ?? 0} threshold={threshold} size={64} className="shrink-0" />
        <div>
          <div className="text-sm font-semibold text-(--oe-nc-text)">Profile completion</div>
          {missingCaption && <div className="text-xs text-(--oe-nc-text-muted) mt-0.5">{missingCaption}</div>}
          {!belowThreshold && <div className="text-xs text-emerald-600 mt-0.5 font-medium">Ready for billing</div>}
        </div>
      </div>
    </>
  );
}

// ── PatientPreviewBanner props ────────────────────────────────────────────────

export interface PatientPreviewBannerProps {
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
  deskWaitingCount?: number;
  arrivedAtMs?: number;
  calendarUrl?: string;
}

// ── PatientPreviewBanner ──────────────────────────────────────────────────────

export function PatientPreviewBanner({
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
  deskWaitingCount,
  arrivedAtMs,
  calendarUrl,
}: PatientPreviewBannerProps) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [chiefComplaintDraft, setChiefComplaintDraft] = useState('');

  const identity = preview.identity;
  const completion = preview.completion;
  const appointment = preview.appointment_today ?? preview.chips?.appointment_today ?? null;
  const recallDue = preview.recall_due ?? preview.chips?.recall_due ?? null;
  const activeVisit = preview.active_visit;
  const savedChiefComplaint = activeVisit?.chief_complaint?.trim() ?? '';
  const draftChiefComplaint = chiefComplaintDraft.trim();
  const bannerChiefComplaint = draftChiefComplaint || savedChiefComplaint;
  const bannerChiefComplaintDraft = !!draftChiefComplaint && draftChiefComplaint !== savedChiefComplaint;
  const nhisExpired = preview.insurance_label === 'Cash (NHIS expired)';
  const chartUrl = completion.chart_open_url || completion.chart_url;

  const handleCancelVisit = useCallback(async (reason: string) => {
    if (!activeVisit) return;
    setCancelSubmitting(true);
    setCancelError(null);
    try {
      await oeFetch('visit.cancel', {
        ajaxUrl, csrfToken, method: 'POST',
        json: { visit_id: activeVisit.visit_id, row_version: activeVisit.row_version ?? 0, reason },
        params: facilityId > 0 ? { facility_id: facilityId } : undefined,
      });
      setCancelOpen(false);
      onPreviewRefresh();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setCancelSubmitting(false);
    }
  }, [activeVisit, ajaxUrl, csrfToken, facilityId, onPreviewRefresh]);

  return (
    <div id="nc-patient-context-banner">
      <PatientContextBanner
        identity={identity}
        layout="full"
        completion={completion}
        safety={preview.safety}
        chiefComplaint={bannerChiefComplaint}
        chiefComplaintDraft={bannerChiefComplaintDraft}
        chiefComplaintId={bannerChiefComplaintDraft ? 'nc-banner-chief-complaint-draft' : 'nc-banner-chief-complaint'}
        {...bannerPropsFromPreview(preview)}
        aside={<CompletionScorePill score={completion.score ?? 0} threshold={completion.billing_threshold} />}
      >
        {/* 1 — Status chips */}
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
        {nhisExpired && (
          <div className="mb-3">
            <Badge variant="warning" title={preview.insurance_label ?? undefined}>Cash (NHIS expired)</Badge>
          </div>
        )}
        {!activeVisit && recallDue && (
          <div className="mb-3">
            <a
              href={recallDue.worklist_url} target="_top"
              title={recallDue.reason || recallDue.label}
              className={cn(badgeVariants({ variant: 'warning' }), 'no-underline hover:opacity-90')}
            >
              <BellRing className="h-3 w-3" />
              Recall due · {recallDue.label}
            </a>
          </div>
        )}

        {/* 2 — Previous visits today */}
        {preview.visits_today && preview.visits_today.length > 0 && (
          <TodaysVisitsList visits={preview.visits_today} />
        )}

        {/* 3 — Active visit state */}
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
            ajaxUrl={ajaxUrl} csrfToken={csrfToken} facilityId={facilityId}
            onSaved={onPreviewRefresh}
          />
        )}

        {/* 4 — Primary CTA: start visit */}
        {showStartVisit && !activeVisit && (preview.unpaid_visits_count ?? 0) > 0 && (
          <DeskAlert tone="warn" className="mb-3 flex items-center gap-2 text-sm" id="nc-unpaid-balance-warning">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Patient has{' '}
              <strong>
                {preview.unpaid_visits_count}{' '}
                {preview.unpaid_visits_count === 1 ? 'unpaid visit' : 'unpaid visits'}
              </strong>
              {' '}— confirm payment at cashier desk.
            </span>
          </DeskAlert>
        )}
        {showStartVisit && !activeVisit && (
          <StartVisitForm
            ajaxUrl={ajaxUrl} csrfToken={csrfToken} facilityId={facilityId}
            pid={pid} preview={preview} moduleUrl={moduleUrl} printQueueSlip={printQueueSlip}
            visitBoardUrl={visitBoardUrl} canSkipTriage={canSkipTriage}
            canRevisitOverride={canRevisitOverride}
            enforceCompletionOnRevisit={enforceCompletionOnRevisit}
            autoStart={autoStartVisit}
            onAutoStartConsumed={onAutoStartVisitConsumed}
            onStarted={onPreviewRefresh}
            onCompleteNow={onCompleteNow}
            onDirtyChange={onStartVisitDirtyChange}
            onChiefComplaintChange={setChiefComplaintDraft}
            deskWaitingCount={deskWaitingCount}
            arrivedAtMs={arrivedAtMs}
          />
        )}

        {/* 5 — Completion summary */}
        <CompletionSummary preview={preview} registrationMode={registrationMode} onCompleteNow={onCompleteNow} />

        {/* 6 — Secondary actions (ghost, visually quiet) */}
        <div className="flex flex-wrap gap-1.5 mt-1">
          <Button variant="ghost" size="sm" id="nc-edit-profile" onClick={onEditProfile}>
            <Pencil className="h-3.5 w-3.5" />
            Edit profile
          </Button>
          {chartUrl && (
            <Button variant="ghost" size="sm" asChild>
              <a target="_top" href={chartUrl}>
                <FolderOpen className="h-3.5 w-3.5" />
                Open chart
              </a>
            </Button>
          )}
          {calendarUrl && !activeVisit && (
            <Button variant="ghost" size="sm" asChild>
              <a target="_top" href={`${calendarUrl}${calendarUrl.includes('?') ? '&' : '?'}pid=${encodeURIComponent(String(pid))}`}>
                <CalendarCheck className="h-3.5 w-3.5" />
                Book follow-up
              </a>
            </Button>
          )}
          {activeVisit && canCancelVisit && (
            <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
              <XCircle className="h-3.5 w-3.5" />
              Cancel today&apos;s visit
            </Button>
          )}
        </div>

        {registrationWorkRef && (
          <div id="nc-preview-work" className="nc-preview-work mt-2" ref={registrationWorkRef}>
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
        onClose={() => { setCancelOpen(false); setCancelError(null); }}
        onConfirm={(reason) => void handleCancelVisit(reason)}
        suggestWrongVisitType={activeVisit?.state === 'waiting'}
      />
    </div>
  );
}
