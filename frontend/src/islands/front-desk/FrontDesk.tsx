/**
 * FrontDesk — search-first layout island.
 * All state and data-fetching live in useFrontDesk; this file is layout + render only.
 */

import type { FrontDeskProps } from '@core/types';
import { ConfirmModal, IdentityConfirmBanner } from '@components/ConfirmModal';
import { SlideOver } from '@components/SlideOver';
import { KeyboardShortcutsHelp } from '@components/KeyboardShortcutsHelp';
import { PatientSearchWidget } from './PatientSearchWidget';
import { PatientPreviewPane } from './PatientPreviewPane';
import { DeskStatusBar } from './DeskStatusBar';
import { FrontDeskFlowCharts } from './FrontDeskFlowCharts';
import { useFrontDesk } from './useFrontDesk';

export function FrontDesk({
  ajaxUrl,
  csrfToken,
  facilityId,
  moduleUrl,
  visitBoardUrl,
  registrationMode = 'desk_full_form',
  pinnedPreview = false,
  printQueueSlip = true,
  canSkipTriage = false,
  canCancelVisit = false,
  canRevisitOverride = false,
  enforceCompletionOnRevisit = true,
  scheduledIntegrationEnabled = false,
  appointmentsTodayCount = 0,
  calendarUrl,
  recallsUrl,
}: FrontDeskProps) {
  const desk = useFrontDesk({ ajaxUrl, csrfToken, facilityId, pinnedPreview, scheduledIntegrationEnabled });

  const {
    selectedPid, preview, mode, arrivedAtMs, deskStats, deskStatsLoading,
    todaysAppointments, appointmentsLoading, pendingConfirm, registrationDraft,
    autoStartVisit, mobileSheetOpen, isMobile, isRegistrationWork,
    showSearchInGrid, showPreviewColumn, hasPatientWork, mobileSheetTitle,
    initialQuery, registrationWorkRef, registrationFormRef, searchResultsRef,
    recent, clearRecent, canUndo, canRedo, handleUndo, handleRedo,
    loadDeskStats, loadTodaysAppointments, loadPreview,
    handleSelectPatient, handleBulkCheckIn, handlePreviewRefresh, openRegistration,
    resetEmpty, revertToPreview, applyPatientSwitch, setPendingConfirm, setAutoStartVisit,
    setMobileSheetOpen, setRegistrationDraft, requestRegistrationDiscard,
    setStartVisitDirty,
  } = desk;

  const rootClassName = [
    'nc-front-desk-react-active nc-desk-split',
    showPreviewColumn ? 'nc-front-desk-split' : '',
    hasPatientWork ? 'nc-front-desk-has-selection' : 'nc-front-desk-idle',
    isRegistrationWork ? 'nc-front-desk-registration' : '',
    mode === 'registration' ? 'nc-front-desk-registration-only' : '',
    mode === 'registration-pinned' ? 'nc-front-desk-registration-pinned' : '',
  ].filter(Boolean).join(' ');

  const previewPane = (
    <PatientPreviewPane
      mode={mode}
      preview={preview}
      pid={selectedPid}
      ajaxUrl={ajaxUrl}
      csrfToken={csrfToken}
      facilityId={facilityId}
      moduleUrl={moduleUrl}
      visitBoardUrl={visitBoardUrl}
      registrationMode={registrationMode}
      printQueueSlip={printQueueSlip}
      canCancelVisit={canCancelVisit}
      canSkipTriage={canSkipTriage}
      canRevisitOverride={canRevisitOverride}
      enforceCompletionOnRevisit={enforceCompletionOnRevisit}
      wizardMode={isMobile}
      embedded={isMobile}
      registrationWorkRef={registrationWorkRef}
      onEditProfile={() => { if (selectedPid) openRegistration({ pid: selectedPid }); }}
      onCompleteNow={() => { if (selectedPid) openRegistration({ pid: selectedPid }); }}
      onPreviewRefresh={handlePreviewRefresh}
      onStartVisitDirtyChange={setStartVisitDirty}
      registrationPid={registrationDraft.pid}
      registrationPrefill={registrationDraft.prefill}
      registrationFormRef={registrationFormRef}
      autoStartVisit={autoStartVisit}
      onAutoStartVisitConsumed={() => setAutoStartVisit(false)}
      onRegistrationSaved={(savedPid, startAfter) => {
        setRegistrationDraft({});
        setAutoStartVisit(!!startAfter);
        void loadPreview(savedPid);
        void loadDeskStats();
      }}
      onRegistrationUseExisting={(existingPid) => {
        setRegistrationDraft({});
        void loadPreview(existingPid);
      }}
      onRegistrationCancel={() => {
        setRegistrationDraft({});
        if (pinnedPreview && preview && selectedPid) {
          revertToPreview();
          return;
        }
        resetEmpty();
      }}
      onRegistrationDiscardConfirm={(proceed) => { requestRegistrationDiscard(proceed); }}
      deskWaitingCount={deskStats?.waiting_count}
      arrivedAtMs={arrivedAtMs ?? undefined}
      calendarUrl={calendarUrl}
    />
  );

  return (
    <>
      <div className="nc-front-desk-status-shell" role="banner" aria-label="Front desk status and navigation">
        <DeskStatusBar
          stats={deskStats}
          loading={deskStatsLoading}
          onRefresh={() => { void loadDeskStats(); void loadTodaysAppointments(); }}
          visitBoardUrl={visitBoardUrl}
          schedulingEnabled={scheduledIntegrationEnabled}
          appointmentsTodayCount={appointmentsTodayCount}
          calendarUrl={calendarUrl}
          recallsUrl={recallsUrl}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />
      </div>

      <div id="nc-front-desk" className={rootClassName} role="main" aria-label="Front desk patient management">
        <FrontDeskFlowCharts ajaxUrl={ajaxUrl} csrfToken={csrfToken} facilityId={facilityId} />

        <div className="nc-front-desk-workspace">
          <div className="nc-front-desk-grid">
            {showSearchInGrid && (
              <div className="nc-front-desk-grid-search" role="search" aria-label="Patient search">
                <PatientSearchWidget
                  ajaxUrl={ajaxUrl}
                  csrfToken={csrfToken}
                  selectedPid={selectedPid}
                  initialQuery={initialQuery}
                  autoSelectFirst={!isMobile && mode !== 'registration' && mode !== 'registration-pinned'}
                  recentPatients={recent}
                  onClearRecent={clearRecent}
                  schedulingEnabled={scheduledIntegrationEnabled}
                  todaysAppointments={todaysAppointments}
                  appointmentsLoading={appointmentsLoading}
                  onSelectPatient={handleSelectPatient}
                  onRegisterPatient={(prefill) => openRegistration({ prefill })}
                  onBulkCheckIn={handleBulkCheckIn}
                  onResultsChange={(results) => { searchResultsRef.current = results; }}
                />
              </div>
            )}
            {showPreviewColumn && (
              <div className="nc-front-desk-grid-preview" role="region" aria-label="Patient preview and registration">
                {previewPane}
              </div>
            )}
          </div>
        </div>

        {isMobile && (
          <SlideOver
            id="nc-front-desk-preview-sheet"
            open={mobileSheetOpen && mode !== 'empty'}
            onClose={() => setMobileSheetOpen(false)}
            title={mobileSheetTitle}
            placement="bottom"
            width="lg"
            aria-label={`${mobileSheetTitle} details`}
          >
            {previewPane}
          </SlideOver>
        )}

        <ConfirmModal
          open={!!pendingConfirm}
          onClose={() => setPendingConfirm(null)}
          title={pendingConfirm?.type === 'switch_patient' ? 'Switch patient?' : 'Discard changes?'}
          modalId="nc-front-desk-confirm-modal"
          cancelLabel={pendingConfirm?.type === 'discard_registration' ? 'Keep editing' : 'Cancel'}
          confirmLabel={pendingConfirm?.type === 'switch_patient' ? 'Switch' : 'Discard'}
          confirmVariant="warning"
          onConfirm={() => {
            if (!pendingConfirm) return;
            if (pendingConfirm.type === 'switch_patient') {
              applyPatientSwitch(pendingConfirm.switch.pid);
            } else {
              pendingConfirm.onProceed();
            }
            setPendingConfirm(null);
          }}
          identityBanner={
            pendingConfirm?.type === 'switch_patient' ? (
              <IdentityConfirmBanner
                displayName={pendingConfirm.switch.displayName}
                pubpid={pendingConfirm.switch.pubpid}
              />
            ) : undefined
          }
        >
          {pendingConfirm?.type === 'switch_patient' && (
            <p className="mb-0">
              Discard changes and switch to {pendingConfirm.switch.displayName} · MRN {pendingConfirm.switch.pubpid}?
            </p>
          )}
          {pendingConfirm?.type === 'discard_registration' && (
            <p className="mb-0">{pendingConfirm.message}</p>
          )}
        </ConfirmModal>

        <KeyboardShortcutsHelp />
      </div>
    </>
  );
}
