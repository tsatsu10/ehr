/**
 * TriageActivePane — active work column for the triage desk.
 *
 * Modes: idle → loading → form → saved
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  TriageVisit,
  PatientPreview,
  VitalsData,
  VitalsRules,
  VitalName,
} from '@core/types';
import { useVitalsValidation } from '@core/useVitalsValidation';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { TriagePatientBanner } from './TriagePatientBanner';
import { VitalsForm } from './VitalsForm';
import { VitalsSavedPanel } from './VitalsSavedPanel';
import {
  TriageActiveEmpty,
  TriageActiveLoading,
  TriageActiveSection,
  TriageActiveShell,
  TriageActiveStickyFooter,
} from './triageDeskUi';

export type ActiveMode = 'idle' | 'loading' | 'form' | 'saved';

interface TriageActivePaneProps {
  mode: ActiveMode;
  visit: TriageVisit | null;
  preview: PatientPreview | null;
  vitals: VitalsData;
  chiefComplaint: string;
  savedVitals: VitalsData;
  warnings: string[];
  recordCount: number;
  savedAt: Date | null;
  vitalsRules: VitalsRules | undefined;
  saving: boolean;
  sending: boolean;
  starting: boolean;
  formError: string | null;
  visitBoardUrl?: string;
  onVitalsChange: (name: VitalName, value: string) => void;
  onChiefComplaintChange: (value: string) => void;
  onStart: () => void;
  onSave: () => void;
  onSend: () => void;
  onReenter: () => void;
}

function buildVitalsSummary(vitals: VitalsData, tempUnit: string): string {
  const parts: string[] = [];
  if (vitals.bps || vitals.bpd) parts.push(`BP ${vitals.bps ?? '—'}/${vitals.bpd ?? '—'}`);
  if (vitals.pulse) parts.push(`HR ${vitals.pulse}`);
  if (vitals.temperature) parts.push(`T ${vitals.temperature} ${tempUnit}`);
  if (vitals.oxygen_saturation) parts.push(`SpO2 ${vitals.oxygen_saturation}%`);
  if (vitals.weight) parts.push(`Wt ${vitals.weight} kg`);
  if (vitals.respiration) parts.push(`RR ${vitals.respiration}`);
  if (vitals.pain !== undefined && vitals.pain !== '') parts.push(`Pain ${vitals.pain}`);
  return parts.length ? parts.join(' · ') : 'Vitals recorded';
}

export function TriageActivePane({
  mode,
  visit,
  preview,
  vitals,
  chiefComplaint,
  savedVitals,
  warnings,
  recordCount,
  savedAt,
  vitalsRules,
  saving,
  sending,
  starting,
  formError,
  visitBoardUrl,
  onVitalsChange,
  onChiefComplaintChange,
  onStart,
  onSave,
  onSend,
  onReenter,
}: TriageActivePaneProps) {
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const validation = useVitalsValidation(vitals, vitalsRules);

  useEffect(() => {
    if (!submitted || validation.valid) return;
    const first = formRef.current?.querySelector<HTMLElement>('[class*="--oe-nc-danger"], .nc-vitals-warning');
    first?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    first?.focus();
  }, [submitted, validation.valid]);

  const handleSave = useCallback(() => {
    setSubmitted(true);
    if (!validation.valid) return;
    onSave();
  }, [validation.valid, onSave]);

  const handleReenter = useCallback(() => {
    setSubmitted(false);
    onReenter();
  }, [onReenter]);

  const tempUnit = vitalsRules?.temperature_unit ?? '°C';

  if (mode === 'idle') {
    return <TriageActiveEmpty />;
  }

  if (mode === 'loading') {
    return <TriageActiveLoading />;
  }

  if (!visit || !preview) return null;

  const heroTitle = mode === 'saved'
    ? `Vitals saved · #${visit.queue_number} ${preview.identity.display_name}`
    : visit.state === 'waiting'
      ? `Ready for triage · #${visit.queue_number} ${preview.identity.display_name}`
      : `Active triage · #${visit.queue_number} ${preview.identity.display_name}`;

  const heroSub = mode === 'saved'
    ? 'Review vitals and send to doctor when ready'
    : visit.state === 'waiting'
      ? 'Start triage to record vitals'
      : 'Record vitals and chief complaint';

  return (
    <TriageActiveShell className="nc-triage-active-shell--with-sticky-footer">
      <header className="nc-triage-active-shell__hero">
        <h2 className="nc-triage-active-shell__hero-title">{heroTitle}</h2>
        <p className="nc-triage-active-shell__hero-sub">{heroSub}</p>
      </header>

      <div className="nc-triage-active-shell__content">
        <TriagePatientBanner
          preview={preview}
          visit={visit}
          chiefComplaint={chiefComplaint}
        />

        <TriageActiveSection title={mode === 'saved' ? 'Saved vitals' : 'Vitals'}>
          {mode === 'saved' ? (
            <VitalsSavedPanel
              summary={buildVitalsSummary(savedVitals, tempUnit)}
              warnings={warnings}
              recordCount={recordCount}
              savedAt={savedAt ?? new Date()}
            />
          ) : vitalsRules == null ? (
            <div className={deskCalloutClass('warn', 'text-sm')} role="alert">
              Vitals rules are still loading. Please wait a moment and try again.
            </div>
          ) : (
            <VitalsForm
              rules={vitalsRules}
              values={vitals}
              chiefComplaint={chiefComplaint}
              fieldErrors={submitted ? validation.fields : {}}
              onVitalChange={onVitalsChange}
              onChiefComplaintChange={onChiefComplaintChange}
              formRef={formRef}
              formError={formError}
            />
          )}
        </TriageActiveSection>
      </div>

      <TriageActiveStickyFooter>
        {mode === 'saved' ? (
          <>
            <Button
              type="button"
              disabled={sending}
              onClick={onSend}
            >
              {sending ? 'Sending…' : 'Send to doctor'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleReenter}
            >
              Record another set
            </Button>
          </>
        ) : (
          <>
            {visit.state === 'waiting' && (
              <Button
                type="button"
                disabled={starting}
                onClick={onStart}
              >
                {starting ? 'Starting…' : 'Start triage'}
              </Button>
            )}
            {visit.state === 'in_triage' && (
              <Button
                type="button"
                variant="cta"
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? 'Saving…' : 'Save vitals'}
              </Button>
            )}
          </>
        )}

        {visitBoardUrl && (
          <Button variant="outline" size="sm" className="ml-auto" asChild>
            <a href={visitBoardUrl} target="_top">
              View on Visit Board
            </a>
          </Button>
        )}
      </TriageActiveStickyFooter>
    </TriageActiveShell>
  );
}
