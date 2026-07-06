/**
 * PatientPreviewPane — routes preview / registration / empty states into desk shells.
 */

import type { ReactNode, RefObject } from 'react';
import type { FrontDeskPreviewData } from '@core/types';
import { DeskAlert } from '@components/DeskAlert';
import { PatientPreviewBanner } from './PatientPreviewBanner';
import { QuickAddRegistration } from './QuickAddRegistration';
import { PreviewLoadingState } from './PreviewLoadingState';
import type { RegistrationFormHandle } from './RegistrationForm';
import { RegistrationForm } from './RegistrationForm';
import {
  FrontDeskPreviewEmpty,
  FrontDeskPreviewShell,
} from './frontDeskUi';

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

function RegistrationContent({
  registrationMode,
  registrationPid,
  registrationPrefill,
  registrationFormRef,
  wizardMode,
  showBackToSearch,
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
  showBackToSearch?: boolean;
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
      ajaxUrl={ajaxUrl}
      csrfToken={csrfToken}
      pid={registrationPid}
      prefill={registrationPrefill}
      registrationMode={registrationMode}
      wizardMode={wizardMode}
      showBackToSearch={showBackToSearch}
      onSaved={onRegistrationSaved}
      onUseExisting={onRegistrationUseExisting}
      onCancel={onRegistrationCancel}
      onDiscardConfirm={onRegistrationDiscardConfirm}
      mergeToolBaseUrl={mergeToolBaseUrl}
    />
  );
}

function previewBanner(props: PatientPreviewPaneProps, inner?: ReactNode) {
  const { preview, pid } = props;
  if (!preview || !pid) return null;

  return (
    <PatientPreviewBanner
      key={pid}
      preview={preview}
      pid={pid}
      registrationMode={props.registrationMode}
      ajaxUrl={props.ajaxUrl}
      csrfToken={props.csrfToken}
      facilityId={props.facilityId}
      moduleUrl={props.moduleUrl}
      visitBoardUrl={props.visitBoardUrl}
      printQueueSlip={props.printQueueSlip}
      canCancelVisit={props.canCancelVisit}
      canSkipTriage={props.canSkipTriage}
      canRevisitOverride={props.canRevisitOverride}
      enforceCompletionOnRevisit={props.enforceCompletionOnRevisit}
      registrationWorkRef={props.registrationWorkRef}
      registrationContent={inner}
      showStartVisit={!inner}
      autoStartVisit={props.autoStartVisit}
      onAutoStartVisitConsumed={props.onAutoStartVisitConsumed}
      onEditProfile={props.onEditProfile}
      onCompleteNow={props.onCompleteNow}
      onPreviewRefresh={props.onPreviewRefresh}
      onStartVisitDirtyChange={props.onStartVisitDirtyChange}
      deskWaitingCount={props.deskWaitingCount}
      arrivedAtMs={props.arrivedAtMs}
      calendarUrl={props.calendarUrl}
    />
  );
}

export function PatientPreviewPane(props: PatientPreviewPaneProps) {
  const {
    mode,
    preview,
    pid,
    ajaxUrl,
    csrfToken,
    moduleUrl,
    registrationMode,
    wizardMode,
    embedded,
    registrationPid,
    registrationPrefill,
    registrationFormRef,
    onRegistrationSaved,
    onRegistrationUseExisting,
    onRegistrationCancel,
    onRegistrationDiscardConfirm,
  } = props;

  const mergeToolBaseUrl = moduleUrl.replace(/\/oe-module-new-clinic.*$/, '') + '/interface/main/manage_dup_patients.php';

  const registrationContent = (
    <RegistrationContent
      registrationMode={registrationMode}
      registrationPid={registrationPid}
      registrationPrefill={registrationPrefill}
      registrationFormRef={registrationFormRef}
      wizardMode={wizardMode}
      showBackToSearch={mode === 'registration'}
      ajaxUrl={ajaxUrl}
      csrfToken={csrfToken}
      mergeToolBaseUrl={mergeToolBaseUrl}
      onRegistrationSaved={onRegistrationSaved}
      onRegistrationUseExisting={onRegistrationUseExisting}
      onRegistrationCancel={onRegistrationCancel}
      onRegistrationDiscardConfirm={onRegistrationDiscardConfirm}
    />
  );

  const registrationShellProps = {
    embedded,
    className: 'nc-front-desk-preview-shell--registration',
    scrollClassName: 'nc-front-desk-preview-shell__scroll--registration',
  } as const;

  if (mode === 'empty') {
    return <FrontDeskPreviewEmpty />;
  }

  if (mode === 'loading') {
    if (embedded) {
      return (
        <FrontDeskPreviewShell embedded>
          <PreviewLoadingState />
        </FrontDeskPreviewShell>
      );
    }
    return (
      <FrontDeskPreviewShell>
        <PreviewLoadingState />
      </FrontDeskPreviewShell>
    );
  }

  if (mode === 'registration') {
    return (
      <FrontDeskPreviewShell {...registrationShellProps}>
        {registrationContent}
      </FrontDeskPreviewShell>
    );
  }

  if (mode === 'registration-pinned' && preview && pid) {
    return (
      <FrontDeskPreviewShell {...registrationShellProps}>
        {previewBanner(props, registrationContent)}
      </FrontDeskPreviewShell>
    );
  }

  if (!preview || !pid) {
    return (
      <FrontDeskPreviewShell embedded={embedded}>
        <DeskAlert tone="error" className="m-0" role="alert">
          Failed to load preview.
        </DeskAlert>
      </FrontDeskPreviewShell>
    );
  }

  return (
    <FrontDeskPreviewShell embedded={embedded} className="nc-front-desk-preview-shell--patient">
      {previewBanner(props)}
    </FrontDeskPreviewShell>
  );
}
