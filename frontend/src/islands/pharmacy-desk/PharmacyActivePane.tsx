import type { PharmacySelectData } from '@core/types';
import { PharmacyPrescriptionsTable } from './PharmacyPrescriptionsTable';

export type PharmacyActiveMode = 'idle' | 'loading' | 'active' | 'error';

interface PharmacyActivePaneProps {
  mode: PharmacyActiveMode;
  data: PharmacySelectData | null;
  hasActiveWork: boolean;
  canSkipToPayment?: boolean;
  visitBoardUrl?: string;
  blocked: boolean;
  actionError: string | null;
  submitting: boolean;
  pharmOpsEnabled?: boolean;
  canDispense?: boolean;
  onTakePatient: () => void;
  onComplete: () => void;
  onSkip: () => void;
  onOpenDispense: () => void;
  onOpenRxEdit: () => void;
  onDispenseRx?: (prescriptionId: number) => void;
  onPrintRx?: (prescriptionId: number) => void;
}

function PatientBanner({ data }: { data: PharmacySelectData }) {
  const identity = data.preview.identity;
  const allergies = data.preview.safety?.allergies_severe ?? [];

  return (
    <>
      {allergies.length > 0 && (
        <div className="alert alert-warning py-2 mb-3" role="alert">
          <strong>Allergy alert:</strong> {allergies.join(', ')}
        </div>
      )}
      <div className="nc-patient-context-banner mb-3 p-3 border rounded bg-light">
        <div className="d-flex justify-content-between flex-wrap">
          <div>
            <strong>{identity.display_name}</strong> · MRN {identity.pubpid}
          </div>
          <span className="badge badge-info">{data.visit.state}</span>
        </div>
        {allergies.length > 0 && (
          <div className="text-danger small">Allergy: {allergies.join(', ')}</div>
        )}
        <div className="small mt-1">
          Visit #{data.visit.queue_number} · {data.visit.visit_type_label || 'Visit'}
        </div>
      </div>
    </>
  );
}

export function PharmacyActivePane({
  mode,
  data,
  hasActiveWork,
  canSkipToPayment = false,
  visitBoardUrl,
  blocked,
  actionError,
  submitting,
  pharmOpsEnabled = false,
  canDispense = false,
  onTakePatient,
  onComplete,
  onSkip,
  onOpenDispense,
  onOpenRxEdit,
  onDispenseRx,
  onPrintRx,
}: PharmacyActivePaneProps) {
  if (mode === 'idle') {
    return (
      <div id="nc-pharmacy-active-pane">
        <div className="card">
          <div className="card-body text-muted text-center py-5">
            <em>Select a patient from the pharmacy queue.</em>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'loading') {
    return (
      <div id="nc-pharmacy-active-pane">
        <div className="card">
          <div className="card-body"><em>Loading…</em></div>
        </div>
      </div>
    );
  }

  if (mode === 'error' || !data) {
    return (
      <div id="nc-pharmacy-active-pane">
        <div className="alert alert-danger m-0">Failed to load visit.</div>
      </div>
    );
  }

  const inPharmacy = data.visit.state === 'in_pharmacy';
  const canTake = data.visit.state === 'ready_for_pharmacy' && !hasActiveWork;
  const canSkip = canSkipToPayment && (data.visit.state === 'ready_for_pharmacy' || inPharmacy);
  const rxListUrl = data.rx_list_url || '#';

  return (
    <div id="nc-pharmacy-active-pane">
      <div className="card">
        <div className="card-body">
          <PatientBanner data={data} />

          {(data.undispensed_rx_count ?? 0) > 0 ? (
            <div className="alert alert-warning py-2 mb-3" role="alert">
              <strong>
                {data.undispensed_rx_count === 1
                  ? '1 Rx undispensed'
                  : `${data.undispensed_rx_count} Rx undispensed`}
              </strong>
              {' '}
              — Pharmacy complete is blocked until dispensed, skipped to payment, or supervisor override.
            </div>
          ) : null}

          <h5>Prescriptions for this visit</h5>
          <PharmacyPrescriptionsTable
            prescriptions={data.prescriptions ?? []}
            showStockBadges={pharmOpsEnabled}
            canDispense={pharmOpsEnabled && canDispense}
            canPrintRx={!!data.can_print_rx}
            dispenseBlocked={blocked || !inPharmacy}
            onDispense={onDispenseRx}
            onPrintRx={onPrintRx}
          />

          <div className="d-flex flex-wrap mt-3 mb-3">
            <a
              className="btn btn-outline-primary btn-sm mr-2"
              id="nc-pharmacy-open-rx-list"
              href={rxListUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Rx list (core)
            </a>
            {pharmOpsEnabled ? (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm mr-2"
                id="nc-pharmacy-open-dispense"
                disabled={blocked || !inPharmacy}
                onClick={onOpenDispense}
                title="Legacy stock dispense screen"
              >
                Advanced dispense (core)
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm mr-2"
                id="nc-pharmacy-open-dispense"
                disabled={blocked || !inPharmacy}
                onClick={onOpenDispense}
              >
                Open encounter / dispense
              </button>
            )}
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm mr-2"
              id="nc-pharmacy-open-rx-edit"
              disabled={blocked || !inPharmacy}
              onClick={onOpenRxEdit}
            >
              Add Rx (core)
            </button>
          </div>

          {actionError && (
            <div className="alert alert-danger" id="nc-pharmacy-action-error" role="alert">
              {actionError}
            </div>
          )}

          <div className="d-flex flex-wrap">
            {canTake && (
              <button
                type="button"
                className="btn btn-primary mr-2"
                id="nc-pharmacy-take-btn"
                disabled={blocked || submitting}
                onClick={onTakePatient}
              >
                Take patient
              </button>
            )}
            {inPharmacy && (
              <button
                type="button"
                className="btn btn-success mr-2"
                id="nc-pharmacy-complete-btn"
                disabled={blocked || submitting}
                onClick={onComplete}
              >
                {submitting ? 'Completing…' : 'Pharmacy complete'}
              </button>
            )}
            {canSkip && (
              <button
                type="button"
                className="btn btn-outline-warning mr-2"
                id="nc-pharmacy-skip-btn"
                disabled={blocked || submitting}
                onClick={onSkip}
              >
                Skip to payment
              </button>
            )}
            {visitBoardUrl && (
              <a className="btn btn-outline-secondary btn-sm" href={visitBoardUrl} target="_top">
                Visit Board
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
