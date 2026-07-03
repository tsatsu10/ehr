import type { LabDirectIntake } from '@core/types';

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
    <div className="oe-nc-lab-direct-panel border rounded p-3 mb-3 bg-light">
      <h5 className="mb-2">Lab-direct intake</h5>
      <p className="small text-muted mb-3">
        Reception started a lab-only visit. Enter the lab order, complete the lab intake note, and
        E-Sign before Lab complete.
      </p>

      {intake.has_referral && intake.referral_view_url && (
        <div className="mb-2">
          <a
            className="btn btn-outline-secondary btn-sm"
            href={intake.referral_view_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            View referral on file
          </a>
        </div>
      )}

      {intake.referral_required_warning && (
        <div className="alert alert-warning py-2 mb-3 small" role="alert">
          This visit type expects a referral document, but none is on file yet.
        </div>
      )}

      <div className="mb-3">
        <div className="small font-weight-bold mb-1">{intake.lab_intake_title}</div>
        {intake.lab_intake_signed ? (
          <span className="badge badge-success">Signed</span>
        ) : (
          <span className="badge badge-warning">
            {intake.lab_intake_started ? 'Unsigned' : 'Not started'}
          </span>
        )}
        {(intake.order_count ?? 0) > 0 && (
          <span className="badge badge-light border ml-2">
            {intake.order_count} order{(intake.order_count ?? 0) === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="d-flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          disabled={disabled}
          onClick={onOpenLabIntake}
        >
          {intake.lab_intake_started ? 'Open lab intake' : 'Start lab intake'}
        </button>
        {intake.can_create_orders && (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={disabled || !inLab}
            title={!inLab ? 'Take the patient before creating orders' : undefined}
            onClick={onCreateOrder}
          >
            Create lab order
          </button>
        )}
      </div>

      {!intake.lab_intake_signed && (
        <p className="small text-muted mt-3 mb-0">
          Lab complete stays blocked until the lab intake note is E-Signed.
        </p>
      )}
    </div>
  );
}
