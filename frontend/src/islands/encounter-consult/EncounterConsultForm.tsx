import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { fetchEncounterNote, saveEncounterNote } from './encounterConsultApi';
import {
  ENCOUNTER_SECTIONS,
  emptySections,
  mergeSections,
  type EncounterConsultProps,
  type EncounterConsultSectionId,
  type EncounterNotePrefill,
  type EncounterNoteSections,
} from './encounterConsultTypes';
import {
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
  const [dirty, setDirty] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Loading consult note…');
  const [statusTone, setStatusTone] = useState<'default' | 'success' | 'danger'>('default');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const sectionsRef = useRef(sections);
  const variantRef = useRef(variant);
  const dirtyRef = useRef(false);

  sectionsRef.current = sections;
  variantRef.current = variant;
  dirtyRef.current = dirty;

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
      setStatusMessage(payload.updated_at ? `Draft saved ${payload.updated_at}` : 'New draft — not saved yet');
      setStatusTone('default');
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
    if (saving) {
      return;
    }

    if (!manual && !dirtyRef.current) {
      return;
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setStatusMessage(message);
      setStatusTone('danger');
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
    setSections((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setStatusTone('default');
    setStatusMessage('Unsaved changes');
  };

  const scrollToSection = (id: EncounterConsultSectionId) => {
    setActiveSection(id);
    document.getElementById(`encounter-section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
      <EncounterStatusBar message={statusMessage} tone={statusTone} saving={saving} />

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
                      onChange={(event) => updateSection('cc', { chief_complaint: event.target.value })}
                      onFocus={() => setActiveSection('cc')}
                    />
                  </div>
                )}
                {meta.id === 'hpi' && (
                  <div className="space-y-2">
                    <Label htmlFor="encounter-hpi">History of present illness</Label>
                    <Textarea
                      id="encounter-hpi"
                      rows={8}
                      value={sections.hpi.narrative}
                      onChange={(event) => updateSection('hpi', { narrative: event.target.value })}
                      onFocus={() => setActiveSection('hpi')}
                    />
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
              {lastSavedAt ? `Last saved ${lastSavedAt}` : 'Draft not saved yet'}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" asChild>
                <a href={returnUrl}>Back to hub</a>
              </Button>
              <Button type="button" onClick={() => void persist(true)} disabled={saving}>
                Save draft
              </Button>
            </div>
          </EncounterStickyFooter>
        )}
      />
    </EncounterShell>
  );
}
