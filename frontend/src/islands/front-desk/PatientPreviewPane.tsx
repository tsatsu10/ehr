/**
 * PatientPreviewPane — clinical workspace shell that routes to the correct preview mode.
 * Integrates ClinicalIdentityHeader, ClinicalTaskPanel, and ClinicalTimelineEntry.
 * Updated 2026-07-05 for clinical redesign Phase 3.
 */

import { useMemo } from 'react';
import type { ReactNode, RefObject } from 'react';
import type { FrontDeskPreviewData } from '@core/types';
import { Card, CardContent } from '@components/ui/card';
import { DeskAlert } from '@components/DeskAlert';
import { ClinicalIdentityHeader } from '@components/ClinicalIdentityHeader';
import { ClinicalTaskPanel } from '@components/ClinicalTaskPanel';
import type { ClinicalTaskPanelAction, ClinicalTaskPanelStat, ClinicalTaskPanelAlert, PatientStatus } from '@components/ClinicalTaskPanel';
import { ClinicalTimelineEntry } from '@components/ClinicalTimelineEntry';
import type { TimelineEntry } from '@components/ClinicalTimelineEntry';
import { PatientPreviewBanner } from './PatientPreviewBanner';
import { QuickAddRegistration } from './QuickAddRegistration';
import { PreviewEmptyState } from './PreviewEmptyState';
import { PreviewLoadingState } from './PreviewLoadingState';
import type { RegistrationFormHandle } from './RegistrationForm';
import { RegistrationForm } from './RegistrationForm';

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
  deskWaitingCount?: number;
  arrivedAtMs?: number;
  calendarUrl?: string;
}

// ── Shared registration content factory ──────────────────────────────────────

function RegistrationContent({
  registrationMode,
  registrationPid,
  registrationPrefill,
  registrationFormRef,
  wizardMode,
  ajaxUrl,
  csrfToken,
  mergeToolBaseUrl,
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
  mergeToolBaseUrl?: string;
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
        hideTitle
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
      hideTitle
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
      mergeToolBaseUrl={mergeToolBaseUrl}
    />
  );
}

// ── Clinical Panel Data Builders ──────────────────────────────────────────────

/**
 * Build patient status from preview data
 */
function buildPatientStatus(preview: FrontDeskPreviewData | null): PatientStatus {
  if (!preview) return 'waiting';
  if (preview.active_visit) {
    const state = preview.active_visit.state;
    if (state === 'checked_in') return 'waiting-triage';
    if (state === 'ready_for_doctor') return 'waiting-doctor';
    if (state === 'with_doctor') return 'with-doctor';
    if (state === 'ready_for_lab') return 'waiting-lab';
    if (state === 'ready_for_pharmacy') return 'waiting-pharmacy';
    if (state === 'ready_for_cashier') return 'waiting-cashier';
  }
  return 'waiting';
}

/**
 * Build action items for ClinicalTaskPanel
 */
function buildPanelActions(
  preview: FrontDeskPreviewData | null,
  mode: PreviewPaneMode,
  onEditProfile: () => void,
  onCompleteNow: () => void,
): ClinicalTaskPanelAction[] {
  if (!preview || mode === 'registration' || mode === 'registration-pinned') {
    return [];
  }

  const actions: ClinicalTaskPanelAction[] = [];
  const completion = preview.completion;
  const threshold = completion?.billing_threshold || 70;
  const belowThreshold = (completion?.score || 0) < threshold;

  // Primary action: Start visit or Edit profile
  if (!preview.active_visit) {
    actions.push({
      id: 'start-visit',
      label: 'Start visit',
      variant: 'primary',
      icon: 'play',
      onClick: () => { /* Wire up start visit logic */ },
    });
  }

  // Secondary actions
  actions.push({
    id: 'edit-profile',
    label: 'Edit profile',
    variant: 'secondary',
    icon: 'edit',
    onClick: onEditProfile,
  });

  if (belowThreshold) {
    actions.push({
      id: 'complete-now',
      label: 'Complete profile',
      variant: 'warning',
      icon: 'alert-circle',
      onClick: onCompleteNow,
    });
  }

  return actions;
}

/**
 * Build quick stats for ClinicalTaskPanel
 */
function buildPanelStats(preview: FrontDeskPreviewData | null): ClinicalTaskPanelStat[] {
  if (!preview) return [];

  const stats: ClinicalTaskPanelStat[] = [];

  // Balance due
  if (preview.unpaid_visits_count && preview.unpaid_visits_count > 0) {
    stats.push({
      id: 'balance',
      label: 'Balance due',
      value: `${preview.unpaid_visits_count} visit${preview.unpaid_visits_count > 1 ? 's' : ''}`,
      tone: 'warning',
    });
  }

  // Insurance
  if (preview.insurance_label) {
    stats.push({
      id: 'insurance',
      label: 'Insurance',
      value: preview.insurance_label,
      tone: preview.insurance_effective === 'cash' ? 'neutral' : 'success',
    });
  }

  // Completion score
  if (preview.completion?.score !== undefined) {
    const score = preview.completion.score;
    const threshold = preview.completion.billing_threshold || 70;
    stats.push({
      id: 'completion',
      label: 'Profile',
      value: `${score}%`,
      tone: score >= threshold ? 'success' : 'warning',
    });
  }

  return stats;
}

/**
 * Build alert items for ClinicalTaskPanel
 */
function buildPanelAlerts(preview: FrontDeskPreviewData | null): ClinicalTaskPanelAlert[] {
  if (!preview) return [];

  const alerts: ClinicalTaskPanelAlert[] = [];

  // Allergy alert
  if (preview.safety?.allergies_undocumented) {
    alerts.push({
      id: 'allergy-undoc',
      message: 'Allergies not documented',
      tone: 'critical',
    });
  } else if (preview.safety?.allergies_severe && preview.safety.allergies_severe.length > 0) {
    alerts.push({
      id: 'allergy-severe',
      message: `Severe allergies: ${preview.safety.allergies_severe.slice(0, 2).join(', ')}`,
      tone: 'warning',
    });
  }

  // Pregnancy alert
  if (preview.safety?.pregnant) {
    alerts.push({
      id: 'pregnant',
      message: 'Patient may be pregnant',
      tone: 'info',
    });
  }

  return alerts;
}

/**
 * Build timeline entries from preview data
 */
function buildTimelineEntries(preview: FrontDeskPreviewData | null): TimelineEntry[] {
  if (!preview) return [];

  const entries: TimelineEntry[] = [];

  // Today's visits
  if (preview.visits_today && preview.visits_today.length > 0) {
    preview.visits_today.forEach((visit, idx) => {
      entries.push({
        id: `visit-${visit.visit_id || idx}`,
        type: 'visit',
        date: new Date(), // Would use actual visit date from API
        title: visit.chief_complaint || 'Visit',
        subtitle: visit.visit_state_label || 'Active',
        preview: visit.chief_complaint ? { label: 'Chief complaint', value: visit.chief_complaint } : undefined,
        status: visit.visit_state_label,
      });
    });
  }

  // Appointment today
  if (preview.appointment_today) {
    entries.push({
      id: 'appt-today',
      type: 'appointment',
      date: new Date(), // Would use actual appointment time
      title: preview.appointment_today.time_label || 'Appointment today',
      subtitle: preview.appointment_today.pc_catname || 'Scheduled',
      status: 'Scheduled',
    });
  }

  // Placeholder for future data: medications, labs, etc.
  // These would come from additional API calls or preview data expansion

  return entries;
}

// ── PatientPreviewPane ────────────────────────────────────────────────────────

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
  deskWaitingCount,
  arrivedAtMs,
  calendarUrl,
}: PatientPreviewPaneProps) {
  const mergeToolBaseUrl = moduleUrl.replace(/\/oe-module-new-clinic.*$/, '') + '/interface/main/manage_dup_patients.php';

  // Build clinical panel data from preview
  const patientStatus = useMemo(() => buildPatientStatus(preview), [preview]);
  const panelActions = useMemo(
    () => buildPanelActions(preview, mode, onEditProfile, onCompleteNow),
    [preview, mode, onEditProfile, onCompleteNow]
  );
  const panelStats = useMemo(() => buildPanelStats(preview), [preview]);
  const panelAlerts = useMemo(() => buildPanelAlerts(preview), [preview]);
  const timelineEntries = useMemo(() => buildTimelineEntries(preview), [preview]);

  const registrationContent = (
    <RegistrationContent
      registrationMode={registrationMode}
      registrationPid={registrationPid}
      registrationPrefill={registrationPrefill}
      registrationFormRef={registrationFormRef}
      wizardMode={wizardMode}
      ajaxUrl={ajaxUrl}
      csrfToken={csrfToken}
      mergeToolBaseUrl={mergeToolBaseUrl}
      onRegistrationSaved={onRegistrationSaved}
      onRegistrationUseExisting={onRegistrationUseExisting}
      onRegistrationCancel={onRegistrationCancel}
      onRegistrationDiscardConfirm={onRegistrationDiscardConfirm}
    />
  );

  // Legacy shell for non-clinical modes (registration, loading, empty)
  const legacyShell = (title: string | undefined, inner: ReactNode) => {
    if (embedded) {
      return <div className="oe-nc-desk-split__preview" id="nc-preview-pane">{inner}</div>;
    }
    if (title) {
      return (
        <Card className="oe-nc-desk-split__preview oe-nc-preview-pane overflow-hidden" id="nc-preview-pane">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-(--oe-nc-border)">
            <h2 className="text-sm font-semibold leading-tight text-(--oe-nc-text) m-0">{title}</h2>
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

  // ── Empty State ───────────────────────────────────────────────────────────
  if (mode === 'empty') {
    return legacyShell(undefined, <PreviewEmptyState />);
  }

  // ── Loading State ─────────────────────────────────────────────────────────
  if (mode === 'loading') {
    return legacyShell(undefined, <PreviewLoadingState />);
  }

  // ── Registration Mode ─────────────────────────────────────────────────────
  if (mode === 'registration') {
    return legacyShell(registrationPid ? 'Edit profile' : 'Register patient', registrationContent);
  }

  // ── Registration Pinned (Legacy fallback for now) ─────────────────────────
  if (mode === 'registration-pinned' && preview && pid) {
    return legacyShell(
      registrationPid ? 'Edit profile' : 'Register patient',
      <PatientPreviewBanner
        key={pid}
        preview={preview} pid={pid} registrationMode={registrationMode}
        ajaxUrl={ajaxUrl} csrfToken={csrfToken} facilityId={facilityId}
        moduleUrl={moduleUrl} visitBoardUrl={visitBoardUrl} printQueueSlip={printQueueSlip}
        canCancelVisit={canCancelVisit} canSkipTriage={canSkipTriage}
        canRevisitOverride={canRevisitOverride} enforceCompletionOnRevisit={enforceCompletionOnRevisit}
        registrationWorkRef={registrationWorkRef}
        registrationContent={registrationContent}
        showStartVisit={false}
        onEditProfile={onEditProfile} onCompleteNow={onCompleteNow}
        onPreviewRefresh={onPreviewRefresh} onStartVisitDirtyChange={onStartVisitDirtyChange}
        deskWaitingCount={deskWaitingCount} arrivedAtMs={arrivedAtMs} calendarUrl={calendarUrl}
      />,
    );
  }

  // ── Error State ───────────────────────────────────────────────────────────
  if (!preview || !pid) {
    return legacyShell(undefined, (
      <DeskAlert tone="error" className="m-0" role="alert">Failed to load preview.</DeskAlert>
    ));
  }

  // ── Clinical Preview Layout ───────────────────────────────────────────────
  // NEW: Use clinical three-zone layout for normal preview mode
  return (
    <div className="nc-clinical-preview-pane" id="nc-preview-pane">
      {/* Fixed Identity Header */}
      <ClinicalIdentityHeader
        identity={{
          display_name: preview.identity.display_name,
          mrn: preview.identity.mrn,
          dob: preview.identity.dob,
          sex: preview.identity.sex,
          photo_url: preview.identity.photo_url,
        }}
        allergyChips={preview.safety?.allergies_severe?.map((allergy, idx) => ({
          id: `allergy-${idx}`,
          label: allergy,
          variant: 'critical' as const,
        })) || []}
        completion={preview.completion}
        visitHistory={{
          last_visit_date: undefined, // Would come from API expansion
          visit_count: preview.visits_today?.length || 0,
        }}
        size="md"
      >
        {/* Quick actions in header */}
        <div className="flex items-center gap-2 mt-2">
          <button
            className="text-xs font-medium text-[var(--oe-clinical-primary)] hover:text-[var(--oe-clinical-primary-hover)] transition-colors"
            onClick={onEditProfile}
          >
            Edit profile
          </button>
          {preview.completion.chart_url && (
            <a
              href={preview.completion.chart_url}
              className="text-xs font-medium text-[var(--oe-clinical-primary)] hover:text-[var(--oe-clinical-primary-hover)] transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open chart
            </a>
          )}
        </div>
      </ClinicalIdentityHeader>

      {/* Main content area with actions panel */}
      <div className="nc-clinical-preview-content">
        {/* Scrollable Timeline */}
        <div className="nc-clinical-preview-timeline">
          {timelineEntries.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[var(--oe-clinical-text)] mb-2">
                Recent activity
              </h3>
              {timelineEntries.map((entry) => (
                <ClinicalTimelineEntry key={entry.id} entry={entry} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-[var(--oe-clinical-text-muted)]">
                No recent activity to display
              </p>
            </div>
          )}
        </div>

        {/* Sticky Actions Panel */}
        <ClinicalTaskPanel
          status={patientStatus}
          actions={panelActions}
          stats={panelStats}
          alerts={panelAlerts}
          sticky
        />
      </div>
    </div>
  );
}
