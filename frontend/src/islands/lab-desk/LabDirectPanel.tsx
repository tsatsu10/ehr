import type { LabDirectIntake } from '@core/types';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';

interface LabDirectPanelProps {
  intake: LabDirectIntake;
}

/** Collapsible lab-direct context — actions live in LabShortcuts. */
export function LabDirectPanel({ intake }: LabDirectPanelProps) {
  return (
    <details className="nc-lab-direct-panel" open={!intake.lab_intake_signed}>
      <summary className="nc-lab-direct-panel__summary">Lab-direct visit</summary>
      <div className="nc-lab-direct-panel__body">
        <p className="nc-lab-direct-panel__hint">
          Reception started a lab-only visit. Complete intake and orders before Lab complete.
        </p>

        {intake.referral_required_warning && (
          <div className={deskCalloutClass('warn', 'mb-2 text-sm')} role="alert">
            This visit type expects a referral document, but none is on file yet.
          </div>
        )}

        <div className="nc-lab-direct-panel__status">
          <span className="font-medium text-sm">{intake.lab_intake_title}</span>
          {intake.lab_intake_signed ? (
            <Badge variant="success">Signed</Badge>
          ) : (
            <Badge variant="warning">
              {intake.lab_intake_started ? 'Unsigned' : 'Not started'}
            </Badge>
          )}
          {(intake.order_count ?? 0) > 0 && (
            <Badge variant="outline">{intake.order_count} order{(intake.order_count ?? 0) === 1 ? '' : 's'}</Badge>
          )}
        </div>

        {!intake.lab_intake_signed && (
          <p className="nc-lab-direct-panel__blocker mb-0 text-sm text-[var(--oe-nc-text-muted)]">
            Lab complete stays blocked until the lab intake note is E-Signed.
          </p>
        )}
      </div>
    </details>
  );
}
