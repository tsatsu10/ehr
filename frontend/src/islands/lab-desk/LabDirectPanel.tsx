import type { LabDirectIntake } from '@core/types';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';

interface LabDirectPanelProps {
  intake: LabDirectIntake;
  inLab: boolean;
  disabled?: boolean;
  onOpenLabIntake: () => void;
  onCreateOrder: () => void;
}

export function LabDirectPanel({
  intake,
  inLab,
  disabled = false,
  onOpenLabIntake,
  onCreateOrder,
}: LabDirectPanelProps) {
  return (
    <div className="nc-lab-direct-panel mb-3 rounded-lg border border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint)] p-3">
      <h5 className="mb-2">Lab-direct intake</h5>
      <p className="mb-3 text-sm text-[var(--oe-nc-text-muted)]">
        Reception started a lab-only visit. Enter the lab order, complete the lab intake note, and
        E-Sign before Lab complete.
      </p>

      {intake.has_referral && intake.referral_view_url && (
        <div className="mb-2">
          <Button variant="outline" size="sm" asChild>
            <a href={intake.referral_view_url} target="_blank" rel="noopener noreferrer">
              View referral on file
            </a>
          </Button>
        </div>
      )}

      {intake.referral_required_warning && (
        <div className={deskCalloutClass('warn', 'mb-3 text-sm')} role="alert">
          This visit type expects a referral document, but none is on file yet.
        </div>
      )}

      <div className="mb-3">
        <div className="mb-1 text-sm font-semibold">{intake.lab_intake_title}</div>
        {intake.lab_intake_signed ? (
          <Badge variant="success">Signed</Badge>
        ) : (
          <Badge variant="warning">
            {intake.lab_intake_started ? 'Unsigned' : 'Not started'}
          </Badge>
        )}
        {(intake.order_count ?? 0) > 0 && (
          <Badge variant="outline" className="ml-2">
            {intake.order_count} order{(intake.order_count ?? 0) === 1 ? '' : 's'}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onOpenLabIntake}
        >
          {intake.lab_intake_started ? 'Open lab intake' : 'Start lab intake'}
        </Button>
        {intake.can_create_orders && (
          <Button
            type="button"
            size="sm"
            disabled={disabled || !inLab}
            title={!inLab ? 'Take the patient before creating orders' : undefined}
            onClick={onCreateOrder}
          >
            Create lab order
          </Button>
        )}
      </div>

      {!intake.lab_intake_signed && (
        <p className="mb-0 mt-3 text-sm text-[var(--oe-nc-text-muted)]">
          Lab complete stays blocked until the lab intake note is E-Signed.
        </p>
      )}
    </div>
  );
}
