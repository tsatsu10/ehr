import type { EncounterNotePrefill } from './encounterConsultTypes';
import { VitalsMetricTile } from './encounterUi';

function formatVital(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  return String(value);
}

interface EncounterVitalsSectionProps {
  prefill: EncounterNotePrefill;
}

export function EncounterVitalsSection({ prefill }: EncounterVitalsSectionProps) {
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
