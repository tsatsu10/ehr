/**
 * useFrontDesk — encapsulates all state, data-fetching, and event handlers for the
 * Front Desk island. FrontDesk.tsx is left as pure layout/render code.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { showDeskToast } from '@components/deskToast';
import { usePatientHistory } from './usePatientHistory';
import type {
  FrontDeskDeskStats,
  FrontDeskPreviewData,
  FrontDeskProps,
  PatientSearchRow,
  TodaysAppointmentRow,
} from '@core/types';
import { useDeskViewport } from '@core/useDeskViewport';
import { useRecentlyViewedPatients } from '@core/useRecentlyViewedPatients';
import type { RecentPatient } from '@core/useRecentlyViewedPatients';
import type { RefObject } from 'react';
import type { RegistrationFormHandle } from './RegistrationForm';

export type PreviewMode = 'empty' | 'loading' | 'preview' | 'registration' | 'registration-pinned';

interface PendingSwitch {
  pid: number;
  displayName: string;
  pubpid: string;
}

export type DeskConfirm =
  | { type: 'switch_patient'; switch: PendingSwitch }
  | { type: 'discard_registration'; message: string; onProceed: () => void };

type UseFrontDeskParams = Pick<
  FrontDeskProps,
  | 'ajaxUrl'
  | 'csrfToken'
  | 'facilityId'
  | 'pinnedPreview'
  | 'scheduledIntegrationEnabled'
>;

export interface UseFrontDeskReturn {
  // State
  selectedPid: number | null;
  preview: FrontDeskPreviewData | null;
  mode: PreviewMode;
  arrivedAtMs: number | null;
  deskStats: FrontDeskDeskStats | null;
  deskStatsLoading: boolean;
  todaysAppointments: TodaysAppointmentRow[];
  appointmentsLoading: boolean;
  pendingConfirm: DeskConfirm | null;
  registrationDraft: { pid?: number; prefill?: string };
  autoStartVisit: boolean;
  mobileSheetOpen: boolean;
  // Computed layout flags
  isMobile: boolean;
  isRegistrationWork: boolean;
  showSearchInGrid: boolean;
  showPreviewColumn: boolean;
  hasPatientWork: boolean;
  mobileSheetTitle: string;
  initialQuery: string;
  // Refs passed through to child components
  registrationWorkRef: RefObject<HTMLDivElement | null>;
  registrationFormRef: RefObject<RegistrationFormHandle | null>;
  searchResultsRef: RefObject<PatientSearchRow[]>;
  // Recent patients
  recent: RecentPatient[];
  clearRecent: () => void;
  // Patient history (undo/redo)
  canUndo: boolean;
  canRedo: boolean;
  handleUndo: () => void;
  handleRedo: () => void;
  // Actions
  loadDeskStats: () => Promise<void>;
  loadTodaysAppointments: () => Promise<void>;
  loadPreview: (pid: number) => Promise<void>;
  handleSelectPatient: (pid: number) => void;
  handleBulkCheckIn: (pids: number[]) => Promise<void>;
  handlePreviewRefresh: () => void;
  openRegistration: (opts?: { pid?: number; prefill?: string }) => void;
  resetEmpty: () => void;
  applyPatientSwitch: (pid: number) => void;
  setPendingConfirm: (confirm: DeskConfirm | null) => void;
  setAutoStartVisit: (v: boolean) => void;
  setMobileSheetOpen: (v: boolean) => void;
  setRegistrationDraft: (draft: { pid?: number; prefill?: string }) => void;
  requestRegistrationDiscard: (onProceed: () => void, message?: string) => void;
  revertToPreview: () => void;
  setStartVisitDirty: (dirty: boolean) => void;
}

export function useFrontDesk({
  ajaxUrl,
  csrfToken,
  facilityId,
  pinnedPreview = false,
  scheduledIntegrationEnabled = false,
}: UseFrontDeskParams): UseFrontDeskReturn {
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [preview, setPreview] = useState<FrontDeskPreviewData | null>(null);
  const [mode, setMode] = useState<PreviewMode>('empty');
  const [arrivedAtMs, setArrivedAtMs] = useState<number | null>(null);
  const [deskStats, setDeskStats] = useState<FrontDeskDeskStats | null>(null);
  const [deskStatsLoading, setDeskStatsLoading] = useState(false);
  const [todaysAppointments, setTodaysAppointments] = useState<TodaysAppointmentRow[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<DeskConfirm | null>(null);
  const [registrationDraft, setRegistrationDraft] = useState<{ pid?: number; prefill?: string }>({});
  const [autoStartVisit, setAutoStartVisit] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const registrationWorkRef = useRef<HTMLDivElement>(null);
  const registrationFormRef = useRef<RegistrationFormHandle | null>(null);
  const startVisitDirtyRef = useRef(false);
  const searchResultsRef = useRef<PatientSearchRow[]>([]);
  // Tracks selectedPid synchronously so loadPreview can compare without reading
  // stale closure state (avoids side-effects inside a setState updater).
  const selectedPidRef = useRef<number | null>(null);

  const viewport = useDeskViewport();
  const { recent, remember, clear: clearRecent } = useRecentlyViewedPatients({ ajaxUrl, csrfToken });
  const patientHistory = usePatientHistory();

  const initialQuery = useMemo(() =>
    typeof window !== 'undefined'
      ? new URL(window.location.href).searchParams.get('q') ?? ''
      : '',
  []);

  const initialPid = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const raw = new URL(window.location.href).searchParams.get('pid');
    if (!raw) return null;
    const pid = Number.parseInt(raw, 10);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  }, []);

  const setStartVisitDirty = useCallback((dirty: boolean) => {
    startVisitDirtyRef.current = dirty;
  }, []);

  // ── Data loading ──────────────────────────────────────────────────────────

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

  const loadPreview = useCallback(async (pid: number) => {
    // Read the current selectedPid synchronously via ref to decide whether to
    // update arrivedAtMs — avoids calling setArrivedAtMs inside an updater fn.
    if (selectedPidRef.current !== pid) {
      setArrivedAtMs(Date.now());
    }
    setSelectedPid(pid);
    startVisitDirtyRef.current = false;

    // Check if we have a recent patient entry to show optimistically
    const recentPatient = recent.find((r) => r.pid === pid);
    const searchResult = searchResultsRef.current.find((r) => r.pid === pid);
    
    // Show optimistic preview immediately if we have cached data
    if (recentPatient || searchResult) {
      const optimisticPreview: Partial<FrontDeskPreviewData> = {
        identity: {
          pid,
          display_name: recentPatient?.display_name ?? searchResult?.display_name ?? 'Loading...',
          pubpid: recentPatient?.pubpid ?? searchResult?.pubpid ?? '...',
          sex: searchResult?.sex ?? '',
          age_years: searchResult?.age_years != null ? String(searchResult.age_years) : '',
          phone_masked: searchResult?.phone_masked,
        },
        // Other fields will be loaded from server
      };
      setPreview(optimisticPreview as FrontDeskPreviewData);
      setMode('loading'); // Show as loading but with optimistic data
    } else {
      setMode('loading');
      setPreview(null);
    }

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
        remember({ pid, display_name: data.identity.display_name, pubpid: data.identity.pubpid ?? '' });
        // Add to undo/redo history
        patientHistory.push({
          pid,
          displayName: data.identity.display_name,
          pubpid: data.identity.pubpid ?? '',
        });
      }
      document.dispatchEvent(new CustomEvent('nc:patient-selected', { detail: pid }));
    } catch {
      setPreview(null);
      setMode('empty');
    }
  }, [ajaxUrl, csrfToken, patientHistory, recent, remember]);

  useEffect(() => { selectedPidRef.current = selectedPid; }, [selectedPid]);
  useEffect(() => { void loadDeskStats(); }, [loadDeskStats]);
  useEffect(() => { void loadTodaysAppointments(); }, [loadTodaysAppointments]);
  useEffect(() => {
    if (initialPid == null) return;
    void loadPreview(initialPid);
  }, [initialPid, loadPreview]);

  useEffect(() => {
    if (viewport === 'mobile' && mode !== 'empty') setMobileSheetOpen(true);
  }, [mode, viewport]);

  // ── Keyboard shortcut: / focuses search ───────────────────────────────────

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

  // ── Navigation / registration helpers ────────────────────────────────────

  const requestRegistrationDiscard = useCallback((onProceed: () => void, message = 'Discard unsaved registration changes?') => {
    if (!registrationFormRef.current?.isDirty()) {
      onProceed();
      return;
    }
    setPendingConfirm({ type: 'discard_registration', message, onProceed });
  }, []);

  const resetEmpty = useCallback(() => {
    registrationFormRef.current = null;
    setRegistrationDraft({});
    setAutoStartVisit(false);
    setSelectedPid(null);
    setPreview(null);
    setMode('empty');
    setArrivedAtMs(null);
    setMobileSheetOpen(false);
    startVisitDirtyRef.current = false;
  }, []);

  const revertToPreview = useCallback(() => {
    setMode('preview');
  }, []);

  const openRegistration = useCallback((opts: { pid?: number; prefill?: string } = {}) => {
    requestRegistrationDiscard(() => {
      const usePinned = pinnedPreview && !!(opts.pid ?? selectedPid) && !!preview;
      setMode(usePinned ? 'registration-pinned' : 'registration');
      setRegistrationDraft({ pid: opts.pid, prefill: opts.prefill });
      if (!usePinned) setPreview(null);
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

      if (selectedPid !== pid && startVisitDirtyRef.current) {
        const fromSearch = searchResultsRef.current.find((row) => row.pid === pid);
        setPendingConfirm({
          type: 'switch_patient',
          switch: {
            pid,
            displayName: fromSearch?.display_name ?? preview?.identity.display_name ?? 'Patient',
            pubpid: fromSearch?.pubpid ?? preview?.identity.pubpid ?? '—',
          },
        });
        return;
      }

      applyPatientSwitch(pid);
    }, 'Discard registration changes and switch patient?');
  }, [applyPatientSwitch, mode, preview, requestRegistrationDiscard, selectedPid, viewport]);

  const handleBulkCheckIn = useCallback(async (pids: number[]) => {
    // Show optimistic toast immediately
    const count = pids.length;
    showDeskToast(`Checking in ${count} patient${count > 1 ? 's' : ''}...`, 'info');

    // Optimistically mark appointments as "checking in" by filtering them from the list
    // This provides instant visual feedback
    const previousAppointments = [...todaysAppointments];
    setTodaysAppointments((prev) =>
      prev.map((appt) =>
        pids.includes(appt.pid)
          ? { ...appt, pc_apptstatus: '@' } // Use @ as temporary "checking in" marker
          : appt
      )
    );

    try {
      const results = await Promise.allSettled(
        pids.map((pid) =>
          oeFetch<{ visit: { id: number } }>('visit.start', {
            ajaxUrl,
            csrfToken,
            method: 'POST',
            json: {
              pid,
              use_default_type: true,
              chief_complaint: '',
              is_urgent: false,
              priority_flag: 'standard',
              ...(facilityId > 0 ? { facility_id: facilityId } : {}),
            },
          })
        )
      );
      
      const failures = results.filter((r) => r.status === 'rejected');
      
      if (failures.length === 0) {
        // All successful - show success and reload
        showDeskToast(`${count} patient${count > 1 ? 's' : ''} checked in successfully.`, 'success');
        void loadTodaysAppointments(); // Reload to get updated statuses
        void loadDeskStats();
      } else if (failures.length < results.length) {
        // Partial success
        const successCount = results.length - failures.length;
        showDeskToast(
          `${successCount} checked in, ${failures.length} failed. Refreshing...`,
          'warning'
        );
        void loadTodaysAppointments();
        void loadDeskStats();
      } else {
        // All failed - rollback optimistic update
        setTodaysAppointments(previousAppointments);
        throw new Error(`${failures.length} check-in${failures.length > 1 ? 's' : ''} failed`);
      }
    } catch (err) {
      // Rollback on error
      setTodaysAppointments(previousAppointments);
      const message = err instanceof Error ? err.message : 'Bulk check-in failed';
      showDeskToast(message, 'danger');
      throw err;
    }
  }, [ajaxUrl, csrfToken, facilityId, loadDeskStats, loadTodaysAppointments, todaysAppointments]);

  const handlePreviewRefresh = useCallback(() => {
    if (selectedPid) void loadPreview(selectedPid);
    void loadDeskStats();
    void loadTodaysAppointments();
  }, [loadDeskStats, loadPreview, loadTodaysAppointments, selectedPid]);

  // ── Undo/Redo handlers ────────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    const previous = patientHistory.undo();
    if (previous) {
      showDeskToast(`Undo: Switched back to ${previous.displayName}`, 'info');
      void loadPreview(previous.pid);
    }
  }, [loadPreview, patientHistory]);

  const handleRedo = useCallback(() => {
    const next = patientHistory.redo();
    if (next) {
      showDeskToast(`Redo: Switched to ${next.displayName}`, 'info');
      void loadPreview(next.pid);
    }
  }, [loadPreview, patientHistory]);

  // ── Keyboard shortcuts: Undo/Redo ─────────────────────────────────────────

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        if (patientHistory.canUndo) {
          event.preventDefault();
          handleUndo();
        }
      }
      // Ctrl+Shift+Z or Cmd+Shift+Z for redo
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey) {
        if (patientHistory.canRedo) {
          event.preventDefault();
          handleRedo();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleRedo, handleUndo, patientHistory.canRedo, patientHistory.canUndo]);

  // ── Computed layout values ────────────────────────────────────────────────

  const isMobile = viewport === 'mobile';
  const isRegistrationWork = mode === 'registration' || mode === 'registration-pinned';
  const showSearchInGrid = !isRegistrationWork || isMobile;
  const showPreviewColumn = !isMobile;
  const hasPatientWork = mode !== 'empty';

  const mobileSheetTitle = isRegistrationWork
    ? (registrationDraft.pid ? 'Edit profile' : 'Register patient')
    : (preview?.identity.display_name ?? 'Patient preview');

  return {
    selectedPid,
    preview,
    mode,
    arrivedAtMs,
    deskStats,
    deskStatsLoading,
    todaysAppointments,
    appointmentsLoading,
    pendingConfirm,
    registrationDraft,
    autoStartVisit,
    mobileSheetOpen,
    isMobile,
    isRegistrationWork,
    showSearchInGrid,
    showPreviewColumn,
    hasPatientWork,
    mobileSheetTitle,
    initialQuery,
    registrationWorkRef,
    registrationFormRef,
    searchResultsRef,
    recent,
    clearRecent,
    canUndo: patientHistory.canUndo,
    canRedo: patientHistory.canRedo,
    handleUndo,
    handleRedo,
    loadDeskStats,
    loadTodaysAppointments,
    loadPreview,
    handleSelectPatient,
    handleBulkCheckIn,
    handlePreviewRefresh,
    openRegistration,
    resetEmpty,
    revertToPreview,
    applyPatientSwitch,
    setPendingConfirm,
    setAutoStartVisit,
    setMobileSheetOpen,
    setRegistrationDraft,
    requestRegistrationDiscard,
    setStartVisitDirty,
  };
}
