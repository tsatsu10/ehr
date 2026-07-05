/**
 * VitalsSavedPanel — shown after successful triage.save_vitals.
 *
 * Mirrors renderVitalsSavedPanel() from triage.js.
 */

import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';

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
      <div className="flex items-start">
        <Badge variant="success" className="mr-2 mt-1 shrink-0">Saved</Badge>
        <div className="flex-grow min-w-0">
          <strong>Vitals saved at {timeLabel}</strong>

          <div className="nc-triage-vitals-saved__summary mt-2 text-[var(--oe-nc-text-muted)] text-sm">
            {summary}
          </div>

          {warnings.length > 0 && (
            <div className={deskCalloutClass('warn', 'py-2 px-3 mt-2 mb-0')}>
              <strong className="block mb-1">Review before sending to doctor</strong>
              {warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}

          {recordCount > 1 && (
            <div className="text-sm text-[var(--oe-nc-text-muted)] mt-2">
              {recordCount} vitals sets recorded today.
            </div>
          )}

          <p className="text-[var(--oe-nc-text-muted)] text-sm mb-0 mt-2">
            Send the patient to the doctor, or record another set if needed.
          </p>
        </div>
      </div>
    </div>
  );
}
