/**
 * VitalsSavedPanel — shown after successful triage.save_vitals.
 *
 * Mirrors renderVitalsSavedPanel() from triage.js.
 */

interface VitalsSavedPanelProps {
  summary: string;
  warnings: string[];
  recordCount: number;
  savedAt: Date;
}

export function VitalsSavedPanel({ summary, warnings, recordCount, savedAt }: VitalsSavedPanelProps) {
  const timeLabel = savedAt.toLocaleTimeString();

  return (
    <div className="nc-triage-vitals-saved" role="status" aria-live="polite">
      <div className="d-flex align-items-start">
        <span className="badge badge-success mr-2 mt-1">Saved</span>
        <div className="flex-grow-1">
          <strong>Vitals saved at {timeLabel}</strong>

          <div className="nc-triage-vitals-saved__summary mt-2 text-muted small">
            {summary}
          </div>

          {warnings.length > 0 && (
            <div className="alert alert-warning border border-warning py-2 px-3 mt-2 mb-0">
              <strong className="d-block mb-1">Review before sending to doctor</strong>
              {warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}

          {recordCount > 1 && (
            <div className="small text-muted mt-2">
              {recordCount} vitals sets recorded today.
            </div>
          )}

          <p className="text-muted small mb-0 mt-2">
            Send the patient to the doctor, or record another set if needed.
          </p>
        </div>
      </div>
    </div>
  );
}
