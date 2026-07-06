import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Checkbox } from '@components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { EncounterAttestationSection } from './EncounterAttestationSection';
import { EncounterProblemsSection } from './EncounterProblemsSection';
import {
  fetchEncounterNote,
  saveEncounterNote,
  signEncounterNote,
  validateEncounterNote,
} from './encounterConsultApi';
import {
  ENCOUNTER_SECTIONS,
  HPI_PROMPTS,
  emptySections,
  mergeSections,
  type EncounterConsultProps,
  type EncounterConsultSectionId,
  type EncounterNoteConfig,
  type EncounterNotePrefill,
  type EncounterNoteSections,
  type EncounterSupervisorMeta,
} from './encounterConsultTypes';
import {
  validateEncounterNote as validateEncounterNoteLocal,
  type EncounterValidationIssue,
} from './encounterNoteValidation';
import {
  EncounterContextStrip,
  EncounterLayout,
  EncounterSectionCard,
  EncounterSectionNav,
  EncounterShell,
  EncounterStatusBar,
  EncounterStickyFooter,
  VitalsMetricTile,
} from './encounterUi';
import {
  SOURCE_OF_INFORMATION_OPTIONS,
  URGENCY_OPTIONS,
  isEncounterNoteVariant,
  variantLabel,
  visibleSectionIds,
  type EncounterNoteVariant,
} from './encounterVariants';

const AUTOSAVE_MS = 30_000;

const DEFAULT_NOTE_CONFIG: EncounterNoteConfig = {
  require_icd: false,
  supervisor_required: false,
};

function sectionComplete(
  id: EncounterConsultSectionId,
  sections: EncounterNoteSections,
  variant: EncounterNoteVariant,
): boolean {
  switch (id) {
    case 'referral':
      return sections.referral.clinical_question.trim().length > 0
        && sections.referral.requesting_clinician.trim().length > 0
        && sections.referral.requesting_service.trim().length > 0;
    case 'source':
      return sections.source.sources.length > 0 || sections.source.narrative.trim().length > 0;
    case 'cc':
      return sections.cc.chief_complaint.trim().length > 0;
    case 'hpi':
      return sections.hpi.narrative.trim().length > 0;
    case 'vitals':
      return true;
    case 'pe':
      return sections.pe.general.trim().length > 0;
    case 'problems':
      return sections.problems.items.some((problem) => (
        problem.problem_label.trim().length > 0
        && problem.plan_items.some((item) => item.text.trim().length > 0)
      ));
    case 'attestation':
      return !variant || sections.attestation.supervisor_attested;
    default: {
      const never: never = id;
      return Boolean(never);
    }
  }
}

function formatVital(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  return String(value);
}

function VitalsSection({ prefill }: { prefill: EncounterNotePrefill }) {
  const { vitals } = prefill;
  const latest = vitals.latest ?? {};

  if (vitals.missing) {
    return (
      <p className="text-sm text-[var(--oe-nc-text-muted)]">
        No vitals recorded for this encounter yet. Capture vitals in triage before documenting the consult.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {vitals.summary && (
        <p className="text-sm font-medium text-[var(--oe-nc-text)]">{vitals.summary}</p>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <VitalsMetricTile label="BP" value={`${formatVital(latest.bps)}/${formatVital(latest.bpd)}`} abnormal={vitals.abnormal} />
        <VitalsMetricTile label="Pulse" value={formatVital(latest.pulse)} abnormal={vitals.abnormal} />
        <VitalsMetricTile label="Temp (°C)" value={formatVital(latest.temperature)} abnormal={vitals.abnormal} />
        <VitalsMetricTile label="SpO₂ (%)" value={formatVital(latest.oxygen_saturation)} abnormal={vitals.abnormal} />
        <VitalsMetricTile label="Resp rate" value={formatVital(latest.respiration)} abnormal={vitals.abnormal} />
        <VitalsMetricTile label="Weight" value={formatVital(latest.weight)} />
        <VitalsMetricTile label="Pain" value={formatVital(latest.pain)} />
      </div>
      {vitals.warnings.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-oe-danger,#b91c1c)]">
          {vitals.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-[var(--oe-nc-text-muted)]">
        Vitals are read-only in the consult note and always reflect the latest triage capture.
      </p>
    </div>
  );
}

function ValidationList({ errors }: { errors: EncounterValidationIssue[] }) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <ul className="mt-3 space-y-1 rounded-lg border border-[color-mix(in_srgb,var(--color-oe-danger,#b91c1c)_30%,var(--oe-nc-border))] bg-[color-mix(in_srgb,var(--color-oe-danger,#b91c1c)_6%,var(--oe-nc-surface,#fff))] p-3 text-sm text-[var(--color-oe-danger,#b91c1c)]">
      {errors.map((error) => (
        <li key={`${error.section}-${error.field}`}>{error.message}</li>
      ))}
    </ul>
  );
}

export function EncounterConsultForm({
  ajaxUrl,
  csrfToken,
  visitId,
  facilityId,
  returnUrl,
  initialFocus,
}: EncounterConsultProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sections, setSections] = useState<EncounterNoteSections>(emptySections());
  const [prefill, setPrefill] = useState<EncounterNotePrefill | null>(null);
  const [variant, setVariant] = useState<EncounterNoteVariant>('general_opd');
  const [encounterId, setEncounterId] = useState(0);
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
  const [statusMessage, setStatusMessage] = useState('Loading consult note…');
  const [statusTone, setStatusTone] = useState<'default' | 'success' | 'danger'>('default');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<EncounterValidationIssue[]>([]);
  const [signOpen, setSignOpen] = useState(false);
  const [signPassword, setSignPassword] = useState('');
  const [signError, setSignError] = useState<string | null>(null);
  const focusSignHandledRef = useRef(false);
  const sectionsRef = useRef(sections);
  const variantRef = useRef(variant);
  const dirtyRef = useRef(false);
  const signedRef = useRef(false);

  sectionsRef.current = sections;
  variantRef.current = variant;
  dirtyRef.current = dirty;
  signedRef.current = signed;

  const readOnly = signed;
  const visibleIds = useMemo(() => visibleSectionIds(variant), [variant]);
  const navSections = useMemo(
    () => ENCOUNTER_SECTIONS
      .filter((section) => visibleIds.includes(section.id))
      .map((section) => ({
        id: section.id,
        label: section.label,
        complete: sectionComplete(section.id, sections, variant),
      })),
    [sections, variant, visibleIds],
  );

  const validationContext = useMemo(() => ({
    variant,
    config: noteConfig,
    prefill: prefill ?? {
      chief_complaint: '',
      vitals: { latest: {}, summary: null, warnings: [], abnormal: false, missing: true },
      allergies: { items: [], undocumented: false, nkda: false, summary: null, edit_url: null },
      medications: { items: [], summary: null, edit_url: null },
      patient: { display_name: '', queue_number: 0 },
    },
    supervisor,
  }), [noteConfig, prefill, supervisor, variant]);

  const loadNote = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const payload = await fetchEncounterNote(ajaxUrl, csrfToken, visitId);
      setPrefill(payload.prefill);
      setEncounterId(payload.encounter);
      const resolvedVariant = isEncounterNoteVariant(payload.variant)
        ? payload.variant
        : 'general_opd';
      setVariant(resolvedVariant);
      setNoteConfig(payload.note_config ?? DEFAULT_NOTE_CONFIG);
      setSupervisor(payload.supervisor ?? { supervisor_id: null, supervisor_display_name: null });
      setSections(mergeSections(payload.sections, payload.prefill));
      setLastSavedAt(payload.updated_at);
      setSigned(Boolean(payload.signed));
      setValidationErrors([]);
      setActiveSection(visibleSectionIds(resolvedVariant)[0] ?? 'cc');
      setStatusMessage(
        payload.signed
          ? 'Consult note signed'
          : payload.updated_at
            ? `Draft saved ${payload.updated_at}`
            : 'New draft — not saved yet',
      );
      setStatusTone(payload.signed ? 'success' : 'default');
      setDirty(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load consult note';
      setLoadError(message);
      setStatusMessage(message);
      setStatusTone('danger');
    } finally {
      setLoading(false);
    }
  }, [ajaxUrl, csrfToken, visitId]);

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
      setStatusMessage(result.updated_at ? `Saved ${result.updated_at}` : 'Saved');
      setStatusTone('success');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setStatusMessage(message);
      setStatusTone('danger');
      return false;
    } finally {
      setSaving(false);
    }
  }, [ajaxUrl, csrfToken, saving, visitId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void persist(false);
    }, AUTOSAVE_MS);

    return () => window.clearInterval(timer);
  }, [persist]);

  const updateSection = <K extends keyof EncounterNoteSections>(
    key: K,
    value: EncounterNoteSections[K],
  ) => {
    if (readOnly) {
      return;
    }

    setSections((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setValidationErrors([]);
    setStatusTone('default');
    setStatusMessage('Unsaved changes');
  };

  const updateContext = (patch: Partial<EncounterNoteSections['context']>) => {
    updateSection('context', { ...sections.context, ...patch });
  };

  const toggleSource = (source: string, checked: boolean) => {
    const next = checked
      ? [...sections.source.sources, source]
      : sections.source.sources.filter((value) => value !== source);
    updateSection('source', { ...sections.source, sources: next });
  };

  const scrollToSection = (id: EncounterConsultSectionId) => {
    setActiveSection(id);
    document.getElementById(`encounter-section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
        setStatusMessage('Validation passed — ready to sign');
        setStatusTone('success');
        return true;
      }

      setStatusMessage(`${errors.length} item${errors.length === 1 ? '' : 's'} need attention before signing`);
      setStatusTone('danger');
      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Validation failed';
      setStatusMessage(message);
      setStatusTone('danger');
      return false;
    } finally {
      setValidating(false);
    }
  }, [ajaxUrl, csrfToken, persist, prefill, readOnly, validationContext, visitId]);

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
      );
      if (result.signed) {
        setSigned(true);
        setDirty(false);
        setSignOpen(false);
        setSignPassword('');
        setValidationErrors([]);
        setStatusMessage(result.already_signed ? 'Consult note already signed' : 'Consult note signed');
        setStatusTone('success');
      }
    } catch (err) {
      setSignError(err instanceof Error ? err.message : 'Sign failed');
    } finally {
      setSigning(false);
    }
  }, [ajaxUrl, csrfToken, prefill, readOnly, signPassword, visitId]);

  if (loading) {
    return (
      <EncounterShell>
        <EncounterStatusBar message="Loading consultation note…" saving />
      </EncounterShell>
    );
  }

  if (loadError || !prefill) {
    return (
      <EncounterShell>
        <EncounterStatusBar message={loadError ?? 'Unable to load consult note'} tone="danger" />
        <Button type="button" variant="outline" onClick={() => void loadNote()}>
          Retry
        </Button>
      </EncounterShell>
    );
  }

  return (
    <EncounterShell id="nc-encounter-consult-root">
      <EncounterStatusBar
        message={(
          <span className="flex flex-wrap items-center gap-2">
            <span>{statusMessage}</span>
            <Badge variant="neutral">{variantLabel(variant)}</Badge>
          </span>
        )}
        tone={statusTone}
        saving={saving || validating || signing}
      />

      <EncounterContextStrip
        prefill={prefill}
        acknowledged={sections.context}
        onAcknowledge={updateContext}
        readOnly={readOnly}
      />

      <ValidationList errors={validationErrors} />

      <EncounterLayout
        nav={(
          <EncounterSectionNav
            sections={navSections}
            activeId={activeSection}
            onSelect={(id) => scrollToSection(id as EncounterConsultSectionId)}
          />
        )}
        content={(
          <div className="space-y-4">
            {ENCOUNTER_SECTIONS.filter((meta) => visibleIds.includes(meta.id)).map((meta) => (
              <EncounterSectionCard
                key={meta.id}
                id={meta.id}
                title={meta.label}
                description={meta.description}
              >
                {meta.id === 'referral' && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="encounter-referring-clinician">Requesting clinician</Label>
                      <Input
                        id="encounter-referring-clinician"
                        value={sections.referral.requesting_clinician}
                        disabled={readOnly}
                        onChange={(event) => updateSection('referral', {
                          ...sections.referral,
                          requesting_clinician: event.target.value,
                        })}
                        onFocus={() => setActiveSection('referral')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="encounter-referring-service">Requesting service</Label>
                      <Input
                        id="encounter-referring-service"
                        value={sections.referral.requesting_service}
                        disabled={readOnly}
                        onChange={(event) => updateSection('referral', {
                          ...sections.referral,
                          requesting_service: event.target.value,
                        })}
                        onFocus={() => setActiveSection('referral')}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="encounter-clinical-question">Clinical question</Label>
                      <Textarea
                        id="encounter-clinical-question"
                        rows={4}
                        value={sections.referral.clinical_question}
                        disabled={readOnly}
                        onChange={(event) => updateSection('referral', {
                          ...sections.referral,
                          clinical_question: event.target.value,
                        })}
                        onFocus={() => setActiveSection('referral')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="encounter-urgency">Urgency</Label>
                      <Select
                        value={sections.referral.urgency || 'routine'}
                        disabled={readOnly}
                        onValueChange={(value) => updateSection('referral', {
                          ...sections.referral,
                          urgency: value as EncounterNoteSections['referral']['urgency'],
                        })}
                      >
                        <SelectTrigger id="encounter-urgency">
                          <SelectValue placeholder="Select urgency" />
                        </SelectTrigger>
                        <SelectContent>
                          {URGENCY_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {meta.id === 'source' && (
                  <div className="space-y-4">
                    <div className="grid gap-2 md:grid-cols-2">
                      {SOURCE_OF_INFORMATION_OPTIONS.map((source) => (
                        <label key={source} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={sections.source.sources.includes(source)}
                            disabled={readOnly}
                            onCheckedChange={(checked) => toggleSource(source, checked === true)}
                          />
                          <span>{source}</span>
                        </label>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="encounter-source-narrative">Additional narrative</Label>
                      <Textarea
                        id="encounter-source-narrative"
                        rows={4}
                        value={sections.source.narrative}
                        disabled={readOnly}
                        onChange={(event) => updateSection('source', {
                          ...sections.source,
                          narrative: event.target.value,
                        })}
                        onFocus={() => setActiveSection('source')}
                      />
                    </div>
                  </div>
                )}
                {meta.id === 'cc' && (
                  <div className="space-y-2">
                    <Label htmlFor="encounter-cc">Chief complaint</Label>
                    <Input
                      id="encounter-cc"
                      maxLength={500}
                      value={sections.cc.chief_complaint}
                      disabled={readOnly}
                      onChange={(event) => updateSection('cc', { chief_complaint: event.target.value })}
                      onFocus={() => setActiveSection('cc')}
                    />
                  </div>
                )}
                {meta.id === 'hpi' && (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {HPI_PROMPTS.map((prompt) => (
                        <div className="space-y-2" key={prompt.key}>
                          <Label htmlFor={`encounter-hpi-${prompt.key}`}>{prompt.label}</Label>
                          <Input
                            id={`encounter-hpi-${prompt.key}`}
                            placeholder={prompt.placeholder}
                            value={sections.hpi[prompt.key]}
                            disabled={readOnly}
                            onChange={(event) => updateSection('hpi', {
                              ...sections.hpi,
                              [prompt.key]: event.target.value,
                            })}
                            onFocus={() => setActiveSection('hpi')}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="encounter-hpi">History of present illness</Label>
                      <Textarea
                        id="encounter-hpi"
                        rows={8}
                        placeholder="Summarize the interval history and clinical reasoning…"
                        value={sections.hpi.narrative}
                        disabled={readOnly}
                        onChange={(event) => updateSection('hpi', {
                          ...sections.hpi,
                          narrative: event.target.value,
                        })}
                        onFocus={() => setActiveSection('hpi')}
                      />
                    </div>
                  </div>
                )}
                {meta.id === 'vitals' && <VitalsSection prefill={prefill} />}
                {meta.id === 'pe' && (
                  <div className="space-y-2">
                    <Label htmlFor="encounter-pe">Physical examination</Label>
                    <Textarea
                      id="encounter-pe"
                      rows={8}
                      value={sections.pe.general}
                      disabled={readOnly}
                      onChange={(event) => updateSection('pe', { general: event.target.value })}
                      onFocus={() => setActiveSection('pe')}
                    />
                  </div>
                )}
                {meta.id === 'problems' && (
                  <EncounterProblemsSection
                    sections={sections}
                    readOnly={readOnly}
                    requireIcd={noteConfig.require_icd}
                    onChange={(problems) => updateSection('problems', problems)}
                    onFocus={() => setActiveSection('problems')}
                  />
                )}
                {meta.id === 'attestation' && (
                  <EncounterAttestationSection
                    sections={sections}
                    supervisor={supervisor}
                    encounterId={encounterId}
                    facilityId={facilityId}
                    ajaxUrl={ajaxUrl}
                    csrfToken={csrfToken}
                    supervisorRequired={noteConfig.supervisor_required}
                    readOnly={readOnly}
                    onAttestationChange={(attested) => updateSection('attestation', {
                      supervisor_attested: attested,
                    })}
                    onSupervisorUpdated={setSupervisor}
                    onNotice={(message, tone) => {
                      setStatusMessage(message);
                      setStatusTone(tone === 'success' ? 'success' : 'danger');
                    }}
                  />
                )}
              </EncounterSectionCard>
            ))}
          </div>
        )}
        footer={(
          <EncounterStickyFooter>
            <div className="text-sm text-[var(--oe-nc-text-muted)]">
              {signed
                ? 'Signed — read only'
                : lastSavedAt
                  ? `Last saved ${lastSavedAt}`
                  : 'Draft not saved yet'}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" asChild>
                <a href={returnUrl}>Back to hub</a>
              </Button>
              {!readOnly && (
                <>
                  <Button type="button" variant="outline" onClick={() => void persist(true)} disabled={saving}>
                    Save draft
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => void runValidate()} disabled={validating || saving}>
                    Validate
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      const local = validateEncounterNoteLocal(sections, validationContext);
                      if (!local.valid) {
                        setValidationErrors(local.errors);
                        setStatusMessage(`${local.errors.length} item${local.errors.length === 1 ? '' : 's'} need attention before signing`);
                        setStatusTone('danger');
                        return;
                      }
                      setSignError(null);
                      setSignOpen(true);
                    }}
                    disabled={saving}
                  >
                    Sign
                  </Button>
                </>
              )}
            </div>
          </EncounterStickyFooter>
        )}
      />

      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign consultation note</DialogTitle>
            <DialogDescription>
              Your OpenEMR password is your electronic signature. The note will lock after signing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="encounter-sign-password">Password</Label>
            <Input
              id="encounter-sign-password"
              type="password"
              autoComplete="current-password"
              value={signPassword}
              onChange={(event) => setSignPassword(event.target.value)}
            />
            {signError && (
              <p className="text-sm text-[var(--color-oe-danger,#b91c1c)]">{signError}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSignOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSign()}
              disabled={signing || signPassword.trim() === ''}
            >
              Sign note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EncounterShell>
  );
}
