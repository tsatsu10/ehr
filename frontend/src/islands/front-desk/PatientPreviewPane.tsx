/**
 * PatientPreviewPane — shell that routes to the correct preview mode.
 * The rich patient banner logic lives in PatientPreviewBanner.
 */

import type { ReactNode, RefObject } from 'react';
import type { FrontDeskPreviewData } from '@core/types';
import { Card, CardContent } from '@components/ui/card';
import { DeskAlert } from '@components/DeskAlert';
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

  const shell = (title: string | undefined, inner: ReactNode) => {
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

  if (mode === 'empty') return shell(undefined, <PreviewEmptyState />);
  if (mode === 'loading') return shell(undefined, <PreviewLoadingState />);

  if (mode === 'registration') {
    return shell(registrationPid ? 'Edit profile' : 'Register patient', registrationContent);
  }

  if (mode === 'registration-pinned' && preview && pid) {
    return shell(
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

  if (!preview || !pid) {
    return shell(undefined, (
      <DeskAlert tone="error" className="m-0" role="alert">Failed to load preview.</DeskAlert>
    ));
  }

  return shell(
    undefined,
    <PatientPreviewBanner
      key={pid}
      preview={preview} pid={pid} registrationMode={registrationMode}
      ajaxUrl={ajaxUrl} csrfToken={csrfToken} facilityId={facilityId}
      moduleUrl={moduleUrl} visitBoardUrl={visitBoardUrl} printQueueSlip={printQueueSlip}
      canCancelVisit={canCancelVisit} canSkipTriage={canSkipTriage}
      canRevisitOverride={canRevisitOverride} enforceCompletionOnRevisit={enforceCompletionOnRevisit}
      showStartVisit
      autoStartVisit={autoStartVisit}
      onAutoStartVisitConsumed={onAutoStartVisitConsumed}
      onEditProfile={onEditProfile} onCompleteNow={onCompleteNow}
      onPreviewRefresh={onPreviewRefresh} onStartVisitDirtyChange={onStartVisitDirtyChange}
      deskWaitingCount={deskWaitingCount} arrivedAtMs={arrivedAtMs} calendarUrl={calendarUrl}
    />,
  );
}
