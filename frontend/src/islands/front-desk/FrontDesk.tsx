/**
 * FrontDesk — Phase 7A React island replacing jQuery NewClinicPatientSearch on front desk.
 * Search-first layout: status bar → search panel (sticky) ↔ preview pane.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import type {
  FrontDeskDeskStats,
  FrontDeskPreviewData,
  FrontDeskProps,
  PatientSearchRow,
  TodaysAppointmentRow,
} from '@core/types';
import { ConfirmModal, IdentityConfirmBanner } from '@components/ConfirmModal';
import { SlideOver } from '@components/SlideOver';
import { useDeskViewport } from '@core/useDeskViewport';
import { useRecentlyViewedPatients } from '@core/useRecentlyViewedPatients';
import { PatientSearchWidget } from './PatientSearchWidget';
import { PatientPreviewPane } from './PatientPreviewPane';
import { DeskStatusBar } from './DeskStatusBar';
import type { RegistrationFormHandle } from './RegistrationForm';

type PreviewMode = 'empty' | 'loading' | 'preview' | 'registration' | 'registration-pinned';

interface PendingSwitch {
  pid: number;
  displayName: string;
  pubpid: string;
}

type DeskConfirm =
  | { type: 'switch_patient'; switch: PendingSwitch }
  | { type: 'discard_registration'; message: string; onProceed: () => void };

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
}: FrontDeskProps) {
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [preview, setPreview] = useState<FrontDeskPreviewData | null>(null);
  const [mode, setMode] = useState<PreviewMode>('empty');
  const [deskStats, setDeskStats] = useState<FrontDeskDeskStats | null>(null);
  const [deskStatsLoading, setDeskStatsLoading] = useState(false);
  const [todaysAppointments, setTodaysAppointments] = useState<TodaysAppointmentRow[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<DeskConfirm | null>(null);
  const registrationWorkRef = useRef<HTMLDivElement>(null);
  const registrationFormRef = useRef<RegistrationFormHandle | null>(null);
  const startVisitDirtyRef = useRef(false);
  const searchResultsRef = useRef<PatientSearchRow[]>([]);
  const [registrationDraft, setRegistrationDraft] = useState<{ pid?: number; prefill?: string }>({});
  const [autoStartVisit, setAutoStartVisit] = useState(false);
  const viewport = useDeskViewport();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const { recent, remember, clear: clearRecent } = useRecentlyViewedPatients({ ajaxUrl, csrfToken });

  const initialQuery = typeof window !== 'undefined'
    ? new URL(window.location.href).searchParams.get('q') ?? ''
    : '';

  const resetStartVisitDirty = useCallback(() => {
    startVisitDirtyRef.current = false;
  }, []);

  const loadDeskStats = useCallback(async () => {
    setDeskStatsLoading(true);
    try {
      const data = await oeFetch<FrontDeskDeskStats>('front_desk.desk_stats', {
        ajaxUrl,
        csrfToken,
        params: facilityId > 0 ? { facility_id: facilityId } : undefined,
      });
      setDeskStats(data);
    } catch {
      setDeskStats(null);
    } finally {
      setDeskStatsLoading(false);
    }
  }, [ajaxUrl, csrfToken, facilityId]);

  useEffect(() => {
    void loadDeskStats();
  }, [loadDeskStats]);

  const loadTodaysAppointments = useCallback(async () => {
    if (!scheduledIntegrationEnabled) {
      setTodaysAppointments([]);
      return;
    }
    setAppointmentsLoading(true);
    try {
      const data = await oeFetch<{ appointments: TodaysAppointmentRow[] }>('front_desk.todays_appointments', {
        ajaxUrl,
        csrfToken,
        params: facilityId > 0 ? { facility_id: facilityId, limit: 50 } : { limit: 50 },
      });
      setTodaysAppointments(data.appointments ?? []);
    } catch {
      setTodaysAppointments([]);
    } finally {
      setAppointmentsLoading(false);
    }
  }, [ajaxUrl, csrfToken, facilityId, scheduledIntegrationEnabled]);

  useEffect(() => {
    void loadTodaysAppointments();
  }, [loadTodaysAppointments]);

  const loadPreview = useCallback(async (pid: number) => {
    setMode('loading');
    setSelectedPid(pid);
    resetStartVisitDirty();

    try {
      const data = await oeFetch<FrontDeskPreviewData>('patients.preview', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { pid, context: 'front-desk' },
      });
      setPreview(data);
      setMode('preview');
      if (data?.identity?.display_name) {
        remember({
          pid,
          display_name: data.identity.display_name,
          pubpid: data.identity.pubpid ?? '',
        });
      }
      document.dispatchEvent(new CustomEvent('nc:patient-selected', { detail: pid }));
    } catch {
      setPreview(null);
      setMode('empty');
    }
  }, [ajaxUrl, csrfToken, remember, resetStartVisitDirty]);

  const requestRegistrationDiscard = useCallback((onProceed: () => void, message = 'Discard unsaved registration changes?') => {
    if (!registrationFormRef.current?.isDirty()) {
      onProceed();
      return;
    }
    setPendingConfirm({ type: 'discard_registration', message, onProceed });
  }, []);

  const resolveSwitchTarget = useCallback((pid: number): PendingSwitch | null => {
    if (selectedPid === pid) return null;
    if (!startVisitDirtyRef.current) return null;

    const fromSearch = searchResultsRef.current.find((row) => row.pid === pid);
    return {
      pid,
      displayName: fromSearch?.display_name ?? preview?.identity.display_name ?? 'Patient',
      pubpid: fromSearch?.pubpid ?? preview?.identity.pubpid ?? '—',
    };
  }, [preview, selectedPid]);

  const resetEmpty = useCallback(() => {
    registrationFormRef.current = null;
    setRegistrationDraft({});
    setAutoStartVisit(false);
    setSelectedPid(null);
    setPreview(null);
    setMode('empty');
    setMobileSheetOpen(false);
    resetStartVisitDirty();
  }, [resetStartVisitDirty]);

  useEffect(() => {
    if (viewport === 'mobile' && mode !== 'empty') {
      setMobileSheetOpen(true);
    }
  }, [mode, viewport]);

  const openRegistration = useCallback((opts: { pid?: number; prefill?: string } = {}) => {
    requestRegistrationDiscard(() => {
      const usePinned = pinnedPreview && !!(opts.pid ?? selectedPid) && !!preview;
      setMode(usePinned ? 'registration-pinned' : 'registration');
      setRegistrationDraft({ pid: opts.pid, prefill: opts.prefill });
      if (!usePinned) {
        setPreview(null);
      }
    }, 'Discard registration changes and open registration?');
  }, [pinnedPreview, preview, requestRegistrationDiscard, selectedPid]);

  const applyPatientSwitch = useCallback((pid: number) => {
    setRegistrationDraft({});
    void loadPreview(pid);
  }, [loadPreview]);

  const handleSelectPatient = useCallback((pid: number) => {
    requestRegistrationDiscard(() => {
      if (viewport === 'mobile' && selectedPid === pid && mode !== 'empty') {
        setMobileSheetOpen(true);
        return;
      }

      const pending = resolveSwitchTarget(pid);
      if (pending) {
        setPendingConfirm({ type: 'switch_patient', switch: pending });
        return;
      }

      applyPatientSwitch(pid);
    }, 'Discard registration changes and switch patient?');
  }, [applyPatientSwitch, mode, requestRegistrationDiscard, resolveSwitchTarget, selectedPid, viewport]);

  const handlePreviewRefresh = useCallback(() => {
    if (selectedPid) {
      void loadPreview(selectedPid);
    }
    void loadDeskStats();
    void loadTodaysAppointments();
  }, [loadDeskStats, loadPreview, loadTodaysAppointments, selectedPid]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
        event.preventDefault();
        document.getElementById('nc-search-input')?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const isMobile = viewport === 'mobile';
  const isRegistrationWork = mode === 'registration' || mode === 'registration-pinned';
  const showSearchInGrid = !isRegistrationWork || isMobile;

  const mobileSheetTitle = mode === 'registration' || mode === 'registration-pinned'
    ? (registrationDraft.pid ? 'Edit profile' : 'Register patient')
    : (preview?.identity.display_name ?? 'Patient preview');

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
      onEditProfile={() => {
        if (selectedPid) openRegistration({ pid: selectedPid });
      }}
      onCompleteNow={() => {
        if (selectedPid) openRegistration({ pid: selectedPid });
      }}
      onPreviewRefresh={handlePreviewRefresh}
      onStartVisitDirtyChange={(dirty) => {
        startVisitDirtyRef.current = dirty;
      }}
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
          setMode('preview');
          return;
        }
        resetEmpty();
      }}
      onRegistrationDiscardConfirm={(proceed) => {
        requestRegistrationDiscard(proceed);
      }}
    />
  );

  const hasSelection = !isMobile && mode !== 'empty';

  const rootClassName = [
    'oe-nc-front-desk-react-active',
    'oe-nc-desk-split',
    hasSelection ? 'oe-nc-front-desk--has-selection' : 'oe-nc-front-desk--idle',
    isRegistrationWork ? 'oe-nc-front-desk--registration' : '',
    mode === 'registration' ? 'oe-nc-front-desk--registration-only' : '',
    mode === 'registration-pinned' ? 'oe-nc-front-desk--registration-pinned' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
    <div className="oe-nc-front-desk-status-shell">
      <DeskStatusBar
        stats={deskStats}
        loading={deskStatsLoading}
        onRefresh={() => {
          void loadDeskStats();
          void loadTodaysAppointments();
        }}
        visitBoardUrl={visitBoardUrl}
        schedulingEnabled={scheduledIntegrationEnabled}
        appointmentsTodayCount={appointmentsTodayCount}
        calendarUrl={calendarUrl}
      />
    </div>

    <div
      id="nc-front-desk"
      className={rootClassName}
    >
      <div className="oe-nc-front-desk-workspace">
        <div className="oe-nc-front-desk-grid">
          {showSearchInGrid && (
          <div className="oe-nc-front-desk-grid__search">
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
              onResultsChange={(results) => {
                searchResultsRef.current = results;
              }}
            />
          </div>
          )}
          {hasSelection && (
            <div className="oe-nc-front-desk-grid__preview">
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
        >
          {previewPane}
        </SlideOver>
      )}

      <ConfirmModal
        open={!!pendingConfirm}
        onClose={() => setPendingConfirm(null)}
        title={
          pendingConfirm?.type === 'switch_patient'
            ? 'Switch patient?'
            : 'Discard changes?'
        }
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
    </div>
    </>
  );
}
