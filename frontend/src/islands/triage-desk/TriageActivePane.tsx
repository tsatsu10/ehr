/**
 * TriageActivePane — right column (8/12) of the triage desk.
 *
 * Orchestrates three modes:
 *  idle  — "Select a patient from the queue"
 *  form  — patient banner + vitals form (start_triage / save_vitals)
 *  saved — patient banner + saved panel (send_doctor / record another set)
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
import { PatientBanner } from './PatientBanner';
import { VitalsForm } from './VitalsForm';
import { VitalsSavedPanel } from './VitalsSavedPanel';

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

  // Scroll to first invalid field AFTER the DOM has re-rendered with error classes.
  // setSubmitted(true) triggers the re-render; this effect runs once it's committed.
  useEffect(() => {
    if (!submitted || validation.valid) return;
    const first = formRef.current?.querySelector<HTMLElement>('.is-invalid, .nc-vitals-warning');
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

  // ── Idle ────────────────────────────────────────────────────────────────
  if (mode === 'idle') {
    return (
      <div className="card" id="nc-triage-active-pane">
        <div className="card-body text-muted text-center py-5">
          <em>Select a patient from the queue or use Find patient.</em>
        </div>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────
  if (mode === 'loading') {
    return (
      <div className="card" id="nc-triage-active-pane">
        <div className="card-body">
          <div className="oe-nc-vb-skeleton mb-3" style={{ height: '5rem' }} aria-hidden="true" />
          <div className="oe-nc-vb-skeleton mb-2" aria-hidden="true" />
          <div className="oe-nc-vb-skeleton mb-2" style={{ height: '8rem' }} aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (!visit || !preview) return null;

  // ── Form + Saved shared wrapper ─────────────────────────────────────────
  return (
    <div className="card" id="nc-triage-active-pane">
      <div className="card-body">
        <PatientBanner preview={preview} visit={visit} />

        {mode === 'saved' ? (
          <VitalsSavedPanel
            summary={buildVitalsSummary(savedVitals, tempUnit)}
            warnings={warnings}
            recordCount={recordCount}
            savedAt={savedAt ?? new Date()}
          />
        ) : vitalsRules == null ? (
          <div className="alert alert-warning" role="alert">
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

        {/* Actions */}
        <div className="d-flex flex-wrap align-items-center mt-3">
          {mode === 'saved' ? (
            <>
              <button
                type="button"
                className="btn btn-info mr-2"
                disabled={sending}
                onClick={onSend}
              >
                {sending ? 'Sending…' : 'Send to doctor'}
              </button>
              <button
                type="button"
                className="btn btn-outline-primary mr-2"
                onClick={handleReenter}
              >
                Record another set
              </button>
            </>
          ) : (
            <>
              {visit.state === 'waiting' && (
                <button
                  type="button"
                  className="btn btn-primary mr-2"
                  disabled={starting}
                  onClick={onStart}
                >
                  {starting ? 'Starting…' : 'Start triage'}
                </button>
              )}
              {visit.state === 'in_triage' && (
                <button
                  type="button"
                  className="btn btn-success mr-2"
                  disabled={saving}
                  onClick={handleSave}
                >
                  {saving ? 'Saving…' : 'Save vitals'}
                </button>
              )}
            </>
          )}

          {visitBoardUrl && (
            <a
              className="btn btn-outline-secondary btn-sm ml-auto"
              href={visitBoardUrl}
              target="_top"
            >
              View on Visit Board
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
