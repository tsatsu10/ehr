import type { LabSelectData } from '@core/types';
import { LabOrdersTable } from './LabOrdersTable';

export type LabActiveMode = 'idle' | 'loading' | 'active' | 'error';

interface LabActivePaneProps {
  mode: LabActiveMode;
  data: LabSelectData | null;
  hasActiveWork: boolean;
  labOpsEnabled?: boolean;
  canSkipToPayment?: boolean;
  visitBoardUrl?: string;
  blocked: boolean;
  actionError: string | null;
  submitting: boolean;
  onTakePatient: () => void;
  onComplete: () => void;
  onSkip: () => void;
  onOpenOrders: () => void;
  onOpenResults: (orderId?: number) => void;
}

function PatientBanner({ data }: { data: LabSelectData }) {
  const identity = data.preview.identity;
  const allergies = data.preview.safety?.allergies_severe ?? [];

  return (
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
      {data.critical_unreleased && (
        <div className="alert alert-danger py-2 px-3 mt-2 mb-0 small">
          Critical result saved but not released to doctor. Release from Enter results.
        </div>
      )}
      <div className="small mt-1">
        Visit #{data.visit.queue_number} · {data.visit.visit_type_label || 'Visit'}
      </div>
    </div>
  );
}

export function LabActivePane({
  mode,
  data,
  hasActiveWork,
  labOpsEnabled = false,
  canSkipToPayment = false,
  visitBoardUrl,
  blocked,
  actionError,
  submitting,
  onTakePatient,
  onComplete,
  onSkip,
  onOpenOrders,
  onOpenResults,
}: LabActivePaneProps) {
  if (mode === 'idle') {
    return (
      <div id="nc-lab-active-pane">
        <div className="card">
          <div className="card-body text-muted text-center py-5">
            <em>Select a patient from the lab queue.</em>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'loading') {
    return (
      <div id="nc-lab-active-pane">
        <div className="card">
          <div className="card-body"><em>Loading…</em></div>
        </div>
      </div>
    );
  }

  if (mode === 'error' || !data) {
    return (
      <div id="nc-lab-active-pane">
        <div className="alert alert-danger m-0">Failed to load visit.</div>
      </div>
    );
  }

  const inLab = data.visit.state === 'in_lab';
  const canTake = data.visit.state === 'ready_for_lab' && !hasActiveWork;
  const canSkip = canSkipToPayment && (data.visit.state === 'ready_for_lab' || inLab);
  const resultsLabel = labOpsEnabled ? 'Enter results (hub)' : 'Open results (core)';

  return (
    <div id="nc-lab-active-pane">
      <div className="card">
        <div className="card-body">
          <PatientBanner data={data} />

          <h5>Lab orders</h5>
          <LabOrdersTable
            orders={data.lab_orders ?? []}
            labOpsEnabled={labOpsEnabled}
            inLab={inLab}
            onEnterResults={(orderId) => onOpenResults(orderId)}
          />

          <div className="d-flex flex-wrap mt-3 mb-3">
            <button
              type="button"
              className="btn btn-outline-primary btn-sm mr-2"
              id="nc-lab-open-orders"
              disabled={blocked || !inLab}
              onClick={onOpenOrders}
            >
              Open orders (core)
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm mr-2"
              id={labOpsEnabled ? 'nc-lab-enter-results-primary' : 'nc-lab-open-results'}
              disabled={blocked || !inLab}
              onClick={() => onOpenResults(data.lab_orders[0]?.id)}
            >
              {resultsLabel}
            </button>
          </div>

          {actionError && (
            <div className="alert alert-danger" id="nc-lab-action-error" role="alert">
              {actionError}
            </div>
          )}

          <div className="d-flex flex-wrap">
            {canTake && (
              <button
                type="button"
                className="btn btn-primary mr-2"
                id="nc-lab-take-btn"
                disabled={blocked || submitting}
                onClick={onTakePatient}
              >
                Take patient
              </button>
            )}
            {inLab && (
              <button
                type="button"
                className="btn btn-success mr-2"
                id="nc-lab-complete-btn"
                disabled={blocked || submitting}
                onClick={onComplete}
              >
                {submitting ? 'Completing…' : 'Lab complete'}
              </button>
            )}
            {canSkip && (
              <button
                type="button"
                className="btn btn-outline-warning mr-2"
                id="nc-lab-skip-btn"
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
