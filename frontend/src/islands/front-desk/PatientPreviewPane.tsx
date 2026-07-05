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
import type { TaskAction, QuickStat, TaskAlert, PatientStatus } from '@components/ClinicalTaskPanel';
import { ClinicalTimelineEntry } from '@components/ClinicalTimelineEntry';
import type { TimelineEntry, VisitEntry, AppointmentEntry } from '@components/ClinicalTimelineEntry';
import { PatientPreviewBanner } from './PatientPreviewBanner';
import { QuickAddRegistration } from './QuickAddRegistration';
import { PreviewEmptyState } from './PreviewEmptyState';
import { PreviewLoadingState } from './PreviewLoadingState';
import type { RegistrationFormHandle } from './RegistrationForm';
import { RegistrationForm } from './RegistrationForm';
import { Play, Edit, AlertCircle } from 'lucide-react';

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
  onStartVisit?: () => void;
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
  if (!preview) return 'not_checked_in';
  if (preview.active_visit) {
    const state = preview.active_visit.state;
    if (state === 'checked_in') return 'waiting_triage';
    if (state === 'ready_for_doctor' || state === 'with_doctor') return 'ready_to_start';
    if (state === 'with_doctor') return 'in_progress';
    // For any active visit state, consider it in progress
    return 'in_progress';
  }
  return 'not_checked_in';
}

/**
 * Build action items for ClinicalTaskPanel
 */
function buildPanelActions(
  preview: FrontDeskPreviewData | null,
  mode: PreviewPaneMode,
  onEditProfile: () => void,
  onCompleteNow: () => void,
  onStartVisit?: () => void,
): TaskAction[] {
  if (!preview || mode === 'registration' || mode === 'registration-pinned') {
    return [];
  }

  const actions: TaskAction[] = [];
  const completion = preview.completion;
  const threshold = completion?.billing_threshold || 70;
  const belowThreshold = (completion?.score || 0) < threshold;

  // Primary action: Start visit or Edit profile
  if (!preview.active_visit && onStartVisit) {
    actions.push({
      id: 'start-visit',
      label: 'Start visit',
      variant: 'default',
      icon: Play,
      onClick: onStartVisit,
    });
  }

  // Secondary actions
  actions.push({
    id: 'edit-profile',
    label: 'Edit profile',
    variant: 'secondary',
    icon: Edit,
    onClick: onEditProfile,
  });

  if (belowThreshold) {
    actions.push({
      id: 'complete-now',
      label: 'Complete profile',
      variant: 'outline',
      icon: AlertCircle,
      onClick: onCompleteNow,
    });
  }

  return actions;
}

/**
 * Build quick stats for ClinicalTaskPanel
 */
function buildPanelStats(preview: FrontDeskPreviewData | null): QuickStat[] {
  if (!preview) return [];

  const stats: QuickStat[] = [];

  // Balance due
  if (preview.unpaid_visits_count && preview.unpaid_visits_count > 0) {
    stats.push({
      label: 'Balance due',
      value: `${preview.unpaid_visits_count} visit${preview.unpaid_visits_count > 1 ? 's' : ''}`,
      variant: 'warning',
    });
  }

  // Insurance
  if (preview.insurance_label) {
    stats.push({
      label: 'Insurance',
      value: preview.insurance_label,
      variant: preview.insurance_effective === 'cash' ? 'default' : 'success',
    });
  }

  // Completion score
  if (preview.completion?.score !== undefined) {
    const score = preview.completion.score;
    const threshold = preview.completion.billing_threshold || 70;
    stats.push({
      label: 'Profile',
      value: `${score}%`,
      variant: score >= threshold ? 'success' : 'warning',
    });
  }

  return stats;
}

/**
 * Build alert items for ClinicalTaskPanel
 */
function buildPanelAlerts(preview: FrontDeskPreviewData | null): TaskAlert[] {
  if (!preview) return [];

  const alerts: TaskAlert[] = [];

  // Allergy alert
  if (preview.safety?.allergies_undocumented) {
    alerts.push({
      id: 'allergy-undoc',
      message: 'Allergies not documented',
      severity: 'error',
    });
  } else if (preview.safety?.allergies_severe && preview.safety.allergies_severe.length > 0) {
    alerts.push({
      id: 'allergy-severe',
      message: `Severe allergies: ${preview.safety.allergies_severe.slice(0, 2).join(', ')}`,
      severity: 'warning',
    });
  }

  // Pregnancy alert
  if (preview.safety?.pregnant) {
    alerts.push({
      id: 'pregnant',
      message: 'Patient may be pregnant',
      severity: 'info',
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
        date: new Date().toISOString(),
        title: visit.chief_complaint || 'Visit',
        subtitle: visit.visit_state_label || 'Active',
        status: visit.visit_state_label ? {
          label: visit.visit_state_label,
          variant: 'default' as const,
        } : undefined,
      } as VisitEntry);
    });
  }

  // Appointment today
  if (preview.appointment_today) {
    entries.push({
      id: 'appt-today',
      type: 'appointment',
      date: new Date().toISOString(),
      title: preview.appointment_today.time_label || 'Appointment today',
      subtitle: preview.appointment_today.pc_catname || 'Scheduled',
      appointmentStatus: 'scheduled',
      status: {
        label: 'Scheduled',
        variant: 'default' as const,
      },
    } as AppointmentEntry);
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
  onStartVisit,
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
    () => buildPanelActions(preview, mode, onEditProfile, onCompleteNow, onStartVisit),
    [preview, mode, onEditProfile, onCompleteNow, onStartVisit]
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
    <main className="nc-clinical-preview-pane" id="nc-preview-pane" aria-label="Patient clinical preview">
      {/* Fixed Identity Header */}
      <header>
        <ClinicalIdentityHeader
        identity={{
          pid: preview.pid,
          display_name: preview.identity.display_name,
          pubpid: preview.identity.mrn,
          dob: preview.identity.dob,
          sex: preview.identity.sex,
          photo_url: preview.identity.photo_url,
        }}
        safety={preview.safety}
        completion={preview.completion}
        visitHistory={{
          total_visits: preview.visits_today?.length || 0,
          last_visit_date: undefined,
        }}
        photoUrl={preview.identity.photo_url}
      >
        {/* Quick actions in header */}
        <div className="flex items-center gap-2 mt-2">
          <button
            className="text-xs font-medium text-[var(--oe-clinical-primary)] hover:text-[var(--oe-clinical-primary-hover)] transition-colors"
            onClick={onEditProfile}
          >
            Edit profile
          </button>
          {preview.completion?.chart_url && (
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
      </header>

      {/* Main content area with actions panel */}
      <div className="nc-clinical-preview-content">
        {/* Scrollable Timeline */}
        <article className="nc-clinical-preview-timeline" aria-label="Clinical timeline">
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
        </article>

        {/* Sticky Actions Panel */}
        <aside aria-label="Patient tasks and actions">
          <ClinicalTaskPanel
            status={patientStatus}
            actions={panelActions}
            stats={panelStats}
            alerts={panelAlerts}
            sticky
          />
        </aside>
      </div>
    </main>
  );
}
