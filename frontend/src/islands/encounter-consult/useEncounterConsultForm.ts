import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDeskViewport } from '@/core/useDeskViewport';
import {
  fetchEncounterNote,
  saveEncounterNote,
  signEncounterNote,
  unlockEncounterNote,
  validateEncounterNote,
} from './encounterConsultApi';
import {
  ENCOUNTER_SECTIONS,
  emptySections,
  mergeSections,
  type EncounterConsultProps,
  type EncounterConsultSectionId,
  type EncounterNoteConfig,
  type EncounterNotePrefill,
  type EncounterNoteSections,
  type EncounterSignMeta,
  type EncounterSupervisorMeta,
} from './encounterConsultTypes';
import {
  validateEncounterNote as validateEncounterNoteLocal,
  type EncounterValidationIssue,
} from './encounterNoteValidation';
import { isEncounterSectionComplete } from './encounterSectionComplete';
import type { EncounterNavSection } from './EncounterSectionNav';
import {
  isEncounterNoteVariant,
  rosSystemsForVariant,
  visibleSectionIds,
  type EncounterNoteVariant,
} from './encounterVariants';

const AUTOSAVE_MS = 30_000;

const DEFAULT_NOTE_CONFIG: EncounterNoteConfig = {
  require_icd: false,
  supervisor_required: false,
  specialty_pe_overlays: [],
};

function emptyPrefillStub(): EncounterNotePrefill {
  return {
    chief_complaint: '',
    vitals: { latest: {}, summary: null, warnings: [], abnormal: false, missing: true },
    allergies: { items: [], undocumented: false, nkda: false, summary: null, edit_url: null },
    medications: { items: [], summary: null, edit_url: null },
    background: { problems: [], social: [], edit_urls: {} },
    recent_labs: [],
    referral: {
      requesting_clinician: '',
      requesting_service: '',
      clinical_question: '',
      urgency: '',
    },
    patient: { display_name: '', queue_number: 0 },
  };
}

export type EncounterStatusTone = 'default' | 'success' | 'danger';

export function useEncounterConsultForm({
  ajaxUrl,
  csrfToken,
  visitId,
  initialFocus,
}: Pick<EncounterConsultProps, 'ajaxUrl' | 'csrfToken' | 'visitId' | 'initialFocus'>) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sections, setSections] = useState<EncounterNoteSections>(emptySections());
  const [prefill, setPrefill] = useState<EncounterNotePrefill | null>(null);
  const [variant, setVariant] = useState<EncounterNoteVariant>('general_opd');
  const [encounterId, setEncounterId] = useState(0);
  const [patientPid, setPatientPid] = useState(0);
  const [noteConfig, setNoteConfig] = useState<EncounterNoteConfig>(DEFAULT_NOTE_CONFIG);
  const [supervisor, setSupervisor] = useState<EncounterSupervisorMeta>({
    supervisor_id: null,
    supervisor_display_name: null,
  });
  const [activeSection, setActiveSection] = useState<EncounterConsultSectionId>('cc');
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [signing, setSigning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [signed, setSigned] = useState(false);
  const [canUnlockForCorrection, setCanUnlockForCorrection] = useState(false);
  const [signMeta, setSignMeta] = useState<EncounterSignMeta | null>(null);
  const [statusMessage, setStatusMessage] = useState('Loading consult note…');
  const [statusTone, setStatusTone] = useState<EncounterStatusTone>('default');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<EncounterValidationIssue[]>([]);
  const [signOpen, setSignOpen] = useState(false);
  const [signPassword, setSignPassword] = useState('');
  const [signAmendment, setSignAmendment] = useState('');
  const [signError, setSignError] = useState<string | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const focusSignHandledRef = useRef(false);
  const sectionsRef = useRef(sections);
  const variantRef = useRef(variant);
  const dirtyRef = useRef(false);
  const signedRef = useRef(false);
  const viewport = useDeskViewport();
  const mobileStepper = viewport === 'mobile';

  sectionsRef.current = sections;
  variantRef.current = variant;
  dirtyRef.current = dirty;
  signedRef.current = signed;

  const readOnly = signed;
  const visibleIds = useMemo(() => visibleSectionIds(variant), [variant]);
  const navSections = useMemo((): EncounterNavSection[] => {
    let step = 0;
    return ENCOUNTER_SECTIONS
      .filter((section) => visibleIds.includes(section.id))
      .map((section) => {
        step += 1;
        return {
          id: section.id,
          label: section.label,
          shortLabel: section.shortLabel,
          phase: section.phase,
          step,
          complete: isEncounterSectionComplete(section.id, sections, variant),
        };
      });
  }, [sections, variant, visibleIds]);
  const activeSectionIndex = useMemo(
    () => Math.max(0, navSections.findIndex((section) => section.id === activeSection)),
    [activeSection, navSections],
  );
  const completedSectionCount = useMemo(
    () => navSections.filter((section) => section.complete).length,
    [navSections],
  );
  const visiblePhases = useMemo(
    () => [...new Set(navSections.map((section) => section.phase))],
    [navSections],
  );
  const warningSectionIds = useMemo(
    () => [...new Set(validationErrors.map((error) => error.section).filter(
      (section): section is EncounterConsultSectionId => section !== 'context',
    ))],
    [validationErrors],
  );
  const validationContext = useMemo(() => ({
    variant,
    config: noteConfig,
    prefill: prefill ?? emptyPrefillStub(),
    supervisor,
  }), [noteConfig, prefill, supervisor, variant]);
  const rosSystems = useMemo(() => rosSystemsForVariant(variant), [variant]);

  const setStatusNotice = useCallback((message: string, tone: EncounterStatusTone) => {
    setStatusMessage(message);
    setStatusTone(tone);
  }, []);

  const loadNote = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const payload = await fetchEncounterNote(ajaxUrl, csrfToken, visitId);
      setPrefill(payload.prefill);
      setEncounterId(payload.encounter);
      setPatientPid(payload.pid);
      const resolvedVariant = isEncounterNoteVariant(payload.variant)
        ? payload.variant
        : 'general_opd';
      setVariant(resolvedVariant);
      setNoteConfig(payload.note_config ?? DEFAULT_NOTE_CONFIG);
      setSupervisor(payload.supervisor ?? { supervisor_id: null, supervisor_display_name: null });
      setSections(mergeSections(payload.sections, payload.prefill));
      setLastSavedAt(payload.updated_at);
      setSigned(Boolean(payload.signed));
      setCanUnlockForCorrection(Boolean(payload.can_unlock_for_correction));
      setSignMeta(payload.sign_meta ?? null);
      setValidationErrors([]);
      setActiveSection(visibleSectionIds(resolvedVariant)[0] ?? 'cc');
      setStatusNotice(
        payload.signed
          ? 'Consult note signed'
          : payload.updated_at
            ? `Draft saved ${payload.updated_at}`
            : 'New draft — not saved yet',
        payload.signed ? 'success' : 'default',
      );
      setDirty(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load consult note';
      setLoadError(message);
      setStatusNotice(message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [ajaxUrl, csrfToken, setStatusNotice, visitId]);

  useEffect(() => {
    void loadNote();
  }, [loadNote]);

  const persist = useCallback(async (manual = false) => {
    if (saving || signedRef.current) {
      return false;
    }

    if (!manual && !dirtyRef.current) {
      return true;
    }

    setSaving(true);
    setStatusTone('default');
    setStatusMessage(manual ? 'Saving…' : 'Auto-saving…');
    try {
      const result = await saveEncounterNote(
        ajaxUrl,
        csrfToken,
        visitId,
        variantRef.current,
        sectionsRef.current,
      );
      setDirty(false);
      setLastSavedAt(result.updated_at);
      setStatusNotice(result.updated_at ? `Saved ${result.updated_at}` : 'Saved', 'success');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setStatusNotice(message, 'danger');
      return false;
    } finally {
      setSaving(false);
    }
  }, [ajaxUrl, csrfToken, saving, setStatusNotice, visitId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void persist(false);
    }, AUTOSAVE_MS);

    return () => window.clearInterval(timer);
  }, [persist]);

  const updateSection = useCallback(<K extends keyof EncounterNoteSections>(
    key: K,
    value: EncounterNoteSections[K],
  ) => {
    if (signedRef.current) {
      return;
    }

    setSections((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setValidationErrors([]);
    setStatusTone('default');
    setStatusMessage('Unsaved changes');
  }, []);

  const updateContext = useCallback((patch: Partial<EncounterNoteSections['context']>) => {
    updateSection('context', { ...sectionsRef.current.context, ...patch });
  }, [updateSection]);

  const scrollToSection = useCallback((id: EncounterConsultSectionId) => {
    setActiveSection(id);
    if (mobileStepper) {
      document.getElementById(`encounter-section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [mobileStepper]);

  const goToPreviousSection = useCallback(() => {
    const prev = navSections[activeSectionIndex - 1];
    if (prev) {
      scrollToSection(prev.id);
    }
  }, [activeSectionIndex, navSections, scrollToSection]);

  const goToNextSection = useCallback(() => {
    const next = navSections[activeSectionIndex + 1];
    if (next) {
      scrollToSection(next.id);
    }
  }, [activeSectionIndex, navSections, scrollToSection]);

  useEffect(() => {
    if (mobileStepper || loading) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const top = intersecting[0];
        if (!top) {
          return;
        }

        const sectionId = top.target.id.replace('encounter-section-', '') as EncounterConsultSectionId;
        setActiveSection((current) => (current === sectionId ? current : sectionId));
      },
      { rootMargin: '-12% 0px -62% 0px', threshold: 0.1 },
    );

    visibleIds.forEach((id) => {
      const element = document.getElementById(`encounter-section-${id}`);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [loading, mobileStepper, visibleIds]);

  const runValidate = useCallback(async (): Promise<boolean> => {
    if (!prefill || readOnly) {
      return false;
    }

    setValidating(true);
    setSignError(null);
    try {
      if (dirtyRef.current) {
        const saved = await persist(true);
        if (!saved) {
          return false;
        }
      }

      const local = validateEncounterNoteLocal(sectionsRef.current, validationContext);
      const remote = await validateEncounterNote(
        ajaxUrl,
        csrfToken,
        visitId,
        variantRef.current,
        sectionsRef.current,
      );
      const errors = remote.errors.length > 0 ? remote.errors : local.errors;
      setValidationErrors(errors);
      if (errors.length === 0) {
        setStatusNotice('Validation passed — ready to sign', 'success');
        return true;
      }

      setStatusNotice(
        `${errors.length} item${errors.length === 1 ? '' : 's'} need attention before signing`,
        'danger',
      );
      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Validation failed';
      setStatusNotice(message, 'danger');
      return false;
    } finally {
      setValidating(false);
    }
  }, [ajaxUrl, csrfToken, persist, prefill, readOnly, setStatusNotice, validationContext, visitId]);

  useEffect(() => {
    if (initialFocus !== 'sign' || loading || loadError || signed || focusSignHandledRef.current) {
      return;
    }

    focusSignHandledRef.current = true;
    void runValidate().then((valid) => {
      if (valid) {
        setSignOpen(true);
      }
    });
  }, [initialFocus, loading, loadError, signed, runValidate]);

  const handleSign = useCallback(async () => {
    if (!prefill || readOnly) {
      return;
    }

    setSigning(true);
    setSignError(null);
    try {
      const result = await signEncounterNote(
        ajaxUrl,
        csrfToken,
        visitId,
        variantRef.current,
        sectionsRef.current,
        signPassword,
        signAmendment,
      );
      if (result.signed) {
        setSigned(true);
        setCanUnlockForCorrection(false);
        setDirty(false);
        setSignOpen(false);
        setSignPassword('');
        setSignAmendment('');
        setValidationErrors([]);
        if (result.sign_meta) {
          setSignMeta(result.sign_meta);
        } else {
          void loadNote();
        }
        setStatusNotice(
          result.already_signed ? 'Consult note already signed' : 'Consult note signed',
          'success',
        );
      }
    } catch (err) {
      setSignError(err instanceof Error ? err.message : 'Sign failed');
    } finally {
      setSigning(false);
    }
  }, [ajaxUrl, csrfToken, loadNote, prefill, readOnly, signAmendment, signPassword, setStatusNotice, visitId]);

  const handleUnlock = useCallback(async () => {
    if (!prefill || !canUnlockForCorrection) {
      return;
    }

    setUnlocking(true);
    setUnlockError(null);
    try {
      const result = await unlockEncounterNote(
        ajaxUrl,
        csrfToken,
        visitId,
        unlockReason,
        unlockPassword,
      );
      if (result.unlocked || result.already_unlocked) {
        setSigned(false);
        setCanUnlockForCorrection(false);
        setSignMeta(null);
        setUnlockOpen(false);
        setUnlockReason('');
        setUnlockPassword('');
        setStatusNotice(
          result.already_unlocked ? 'Consult note already unlocked' : 'Consult note unlocked for correction',
          'success',
        );
        void loadNote();
      }
    } catch (err) {
      setUnlockError(err instanceof Error ? err.message : 'Unlock failed');
    } finally {
      setUnlocking(false);
    }
  }, [ajaxUrl, canUnlockForCorrection, csrfToken, loadNote, prefill, setStatusNotice, unlockPassword, unlockReason, visitId]);

  const openSignDialog = useCallback(() => {
    void runValidate().then((valid) => {
      if (valid) {
        setSignError(null);
        setSignOpen(true);
      }
    });
  }, [runValidate]);

  return {
    loading,
    loadError,
    prefill,
    sections,
    variant,
    encounterId,
    patientPid,
    noteConfig,
    supervisor,
    activeSection,
    saving,
    validating,
    signing,
    dirty,
    signed,
    canUnlockForCorrection,
    signMeta,
    statusMessage,
    statusTone,
    lastSavedAt,
    validationErrors,
    readOnly,
    visibleIds,
    navSections,
    warningSectionIds,
    activeSectionIndex,
    completedSectionCount,
    visiblePhases,
    rosSystems,
    viewport,
    mobileStepper,
    signOpen,
    setSignOpen,
    signPassword,
    setSignPassword,
    signAmendment,
    setSignAmendment,
    signError,
    unlockOpen,
    setUnlockOpen,
    unlockReason,
    setUnlockReason,
    unlockPassword,
    setUnlockPassword,
    unlockError,
    unlocking,
    loadNote,
    persist,
    updateSection,
    updateContext,
    scrollToSection,
    goToPreviousSection,
    goToNextSection,
    runValidate,
    handleSign,
    handleUnlock,
    openSignDialog,
    setSupervisor,
    setStatusNotice,
  };
}
