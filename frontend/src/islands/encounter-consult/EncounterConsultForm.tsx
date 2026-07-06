import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@components/ui/button';
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
  type EncounterNotePrefill,
  type EncounterNoteSections,
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

const AUTOSAVE_MS = 30_000;

function sectionComplete(id: EncounterConsultSectionId, sections: EncounterNoteSections): boolean {
  switch (id) {
    case 'cc':
      return sections.cc.chief_complaint.trim().length > 0;
    case 'hpi':
      return sections.hpi.narrative.trim().length > 0;
    case 'vitals':
      return true;
    case 'pe':
      return sections.pe.general.trim().length > 0;
    case 'assessment':
      return sections.assessment.narrative.trim().length > 0;
    case 'plan':
      return sections.plan.narrative.trim().length > 0;
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
  returnUrl,
}: EncounterConsultProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sections, setSections] = useState<EncounterNoteSections>(emptySections());
  const [prefill, setPrefill] = useState<EncounterNotePrefill | null>(null);
  const [variant, setVariant] = useState('general_opd');
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
  const sectionsRef = useRef(sections);
  const variantRef = useRef(variant);
  const dirtyRef = useRef(false);
  const signedRef = useRef(false);

  sectionsRef.current = sections;
  variantRef.current = variant;
  dirtyRef.current = dirty;
  signedRef.current = signed;

  const readOnly = signed;
  const navSections = useMemo(
    () => ENCOUNTER_SECTIONS.map((section) => ({
      id: section.id,
      label: section.label,
      complete: sectionComplete(section.id, sections),
    })),
    [sections],
  );

  const loadNote = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const payload = await fetchEncounterNote(ajaxUrl, csrfToken, visitId);
      setPrefill(payload.prefill);
      setVariant(payload.variant || 'general_opd');
      setSections(mergeSections(payload.sections, payload.prefill));
      setLastSavedAt(payload.updated_at);
      setSigned(Boolean(payload.signed));
      setValidationErrors([]);
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

  const scrollToSection = (id: EncounterConsultSectionId) => {
    setActiveSection(id);
    document.getElementById(`encounter-section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const runValidate = useCallback(async () => {
    if (!prefill || readOnly) {
      return;
    }

    setValidating(true);
    setSignError(null);
    try {
      if (dirtyRef.current) {
        const saved = await persist(true);
        if (!saved) {
          return;
        }
      }

      const local = validateEncounterNoteLocal(sectionsRef.current, prefill);
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
      } else {
        setStatusMessage(`${errors.length} item${errors.length === 1 ? '' : 's'} need attention before signing`);
        setStatusTone('danger');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Validation failed';
      setStatusMessage(message);
      setStatusTone('danger');
    } finally {
      setValidating(false);
    }
  }, [ajaxUrl, csrfToken, persist, prefill, readOnly, visitId]);

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
      <EncounterStatusBar message={statusMessage} tone={statusTone} saving={saving || validating || signing} />

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
            {ENCOUNTER_SECTIONS.map((meta) => (
              <EncounterSectionCard
                key={meta.id}
                id={meta.id}
                title={meta.label}
                description={meta.description}
              >
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
                {meta.id === 'assessment' && (
                  <div className="space-y-2">
                    <Label htmlFor="encounter-assessment">Assessment</Label>
                    <Textarea
                      id="encounter-assessment"
                      rows={8}
                      value={sections.assessment.narrative}
                      disabled={readOnly}
                      onChange={(event) => updateSection('assessment', { narrative: event.target.value })}
                      onFocus={() => setActiveSection('assessment')}
                    />
                  </div>
                )}
                {meta.id === 'plan' && (
                  <div className="space-y-2">
                    <Label htmlFor="encounter-plan">Plan</Label>
                    <Textarea
                      id="encounter-plan"
                      rows={8}
                      value={sections.plan.narrative}
                      disabled={readOnly}
                      onChange={(event) => updateSection('plan', { narrative: event.target.value })}
                      onFocus={() => setActiveSection('plan')}
                    />
                  </div>
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
                      const local = validateEncounterNoteLocal(sections, prefill);
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
