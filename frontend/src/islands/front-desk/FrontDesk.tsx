/**
 * FrontDesk — Phase 7A React island replacing jQuery NewClinicPatientSearch on front desk.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import type { FrontDeskPreviewData, FrontDeskProps, PatientSearchRow } from '@core/types';
import { PatientSearchWidget } from './PatientSearchWidget';
import { PatientPreviewPane } from './PatientPreviewPane';
import type { RegistrationFormHandle } from './RegistrationForm';

type PreviewMode = 'empty' | 'loading' | 'preview' | 'registration' | 'registration-pinned';

export function FrontDesk({
  ajaxUrl,
  csrfToken,
  facilityId,
  moduleUrl,
  registrationMode = 'desk_full_form',
  pinnedPreview = false,
  printQueueSlip = true,
  scheduledIntegrationEnabled = false,
  appointmentsTodayCount = 0,
  calendarUrl,
}: FrontDeskProps) {
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [preview, setPreview] = useState<FrontDeskPreviewData | null>(null);
  const [mode, setMode] = useState<PreviewMode>('empty');
  const registrationWorkRef = useRef<HTMLDivElement>(null);
  const registrationFormRef = useRef<RegistrationFormHandle | null>(null);
  const startVisitDirtyRef = useRef(false);
  const searchResultsRef = useRef<PatientSearchRow[]>([]);
  const [registrationDraft, setRegistrationDraft] = useState<{ pid?: number; prefill?: string }>({});
  const [autoStartVisit, setAutoStartVisit] = useState(false);

  const initialQuery = typeof window !== 'undefined'
    ? new URL(window.location.href).searchParams.get('q') ?? ''
    : '';

  const resetStartVisitDirty = useCallback(() => {
    startVisitDirtyRef.current = false;
  }, []);

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
      document.dispatchEvent(new CustomEvent('nc:patient-selected', { detail: pid }));
    } catch {
      setPreview(null);
      setMode('empty');
    }
  }, [ajaxUrl, csrfToken, resetStartVisitDirty]);

  const confirmRegistrationSwitch = useCallback(() => {
    if (registrationFormRef.current) {
      return registrationFormRef.current.confirmDiscard();
    }
    return true;
  }, []);

  const confirmStartVisitSwitch = useCallback((pid: number) => {
    if (selectedPid === pid) return true;
    if (!startVisitDirtyRef.current) return true;

    const fromSearch = searchResultsRef.current.find((row) => row.pid === pid);
    const name = fromSearch?.display_name ?? preview?.identity.display_name ?? 'Patient';
    const mrn = fromSearch?.pubpid ?? preview?.identity.pubpid ?? '—';

    return window.confirm(`Discard changes and switch to ${name} · MRN ${mrn}?`);
  }, [preview, selectedPid]);

  const resetEmpty = useCallback(() => {
    registrationFormRef.current = null;
    setRegistrationDraft({});
    setAutoStartVisit(false);
    setSelectedPid(null);
    setPreview(null);
    setMode('empty');
    resetStartVisitDirty();
  }, [resetStartVisitDirty]);

  const openRegistration = useCallback((opts: { pid?: number; prefill?: string } = {}) => {
    if (!confirmRegistrationSwitch()) return;

    const usePinned = pinnedPreview && !!(opts.pid ?? selectedPid) && !!preview;
    setMode(usePinned ? 'registration-pinned' : 'registration');
    setRegistrationDraft({ pid: opts.pid, prefill: opts.prefill });
    if (!usePinned) {
      setPreview(null);
    }
  }, [confirmRegistrationSwitch, pinnedPreview, preview, selectedPid]);

  const handleSelectPatient = useCallback((pid: number) => {
    if (!confirmRegistrationSwitch()) return;
    if (!confirmStartVisitSwitch(pid)) return;

    setRegistrationDraft({});
    void loadPreview(pid);
  }, [confirmRegistrationSwitch, confirmStartVisitSwitch, loadPreview]);

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

  return (
    <div id="nc-front-desk" className="oe-nc-front-desk-react-active oe-nc-desk-split">
      {scheduledIntegrationEnabled && (
        <div className="alert alert-info py-2 mb-3 d-flex flex-wrap align-items-center justify-content-between" role="status">
          <span>
            Scheduling linked —
            {appointmentsTodayCount > 0
              ? ` ${appointmentsTodayCount} appointment(s) today. Search a scheduled patient to see Appointment today and Start visit & check in.`
              : ' No appointments booked for today yet. Book in Calendar, then search the patient here.'}
          </span>
          {calendarUrl && (
            <a className="btn btn-sm btn-outline-primary mt-2 mt-md-0" href={calendarUrl} target="_top">
              Open Calendar
            </a>
          )}
        </div>
      )}

      <div className="row">
        <div className="col-lg-5 mb-3">
          <PatientSearchWidget
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            selectedPid={selectedPid}
            initialQuery={initialQuery}
            autoSelectFirst={mode !== 'registration' && mode !== 'registration-pinned'}
            onSelectPatient={handleSelectPatient}
            onRegisterPatient={(prefill) => openRegistration({ prefill })}
            onResultsChange={(results) => {
              searchResultsRef.current = results;
            }}
          />
        </div>
        <div className="col-lg-7 mb-3">
          <PatientPreviewPane
            mode={mode}
            preview={preview}
            pid={selectedPid}
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            facilityId={facilityId}
            moduleUrl={moduleUrl}
            registrationMode={registrationMode}
            printQueueSlip={printQueueSlip}
            registrationWorkRef={registrationWorkRef}
            onEditProfile={() => {
              if (selectedPid) openRegistration({ pid: selectedPid });
            }}
            onCompleteNow={() => {
              if (selectedPid) openRegistration({ pid: selectedPid });
            }}
            onPreviewRefresh={() => {
              if (selectedPid) void loadPreview(selectedPid);
            }}
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
          />
        </div>
      </div>
    </div>
  );
}
