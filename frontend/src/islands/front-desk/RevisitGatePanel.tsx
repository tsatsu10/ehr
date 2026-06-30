import type { VisitState } from '@core/types';
import { StatusPill } from '@components/StatusPill';

export type RevisitPath = 'complete_now' | 'manager_override' | 'awaiting_documents';

interface RevisitGatePanelProps {
  score: number;
  threshold: number;
  pediatricDobBlock: boolean;
  missingLabels: string[];
  canManagerOverride: boolean;
  selectedPath: RevisitPath | null;
  overrideReason: string;
  onSelectPath: (path: RevisitPath) => void;
  onOverrideReasonChange: (value: string) => void;
}

export function RevisitGatePanel({
  score,
  threshold,
  pediatricDobBlock,
  missingLabels,
  canManagerOverride,
  selectedPath,
  overrideReason,
  onSelectPath,
  onOverrideReasonChange,
}: RevisitGatePanelProps) {
  return (
    <div className="alert alert-warning py-2 mb-3" id="nc-revisit-gate">
      <strong>Profile below billing threshold</strong>
      {' — '}
      {score}% of {threshold}% required.
      {pediatricDobBlock && (
        <div className="small mt-1">Pediatric patient needs an exact date of birth before billing.</div>
      )}
      {missingLabels.length > 0 && (
        <div className="small text-muted mt-1">
          Missing: {missingLabels.slice(0, 3).join(', ')}{missingLabels.length > 3 ? '…' : ''}
        </div>
      )}
      <div className="mt-2">
        <div className="small font-weight-bold mb-1">Pick a path:</div>
        <label className="d-block mb-1">
          <input
            type="radio"
            name="nc-revisit-path"
            className="mr-1"
            checked={selectedPath === 'complete_now'}
            onChange={() => onSelectPath('complete_now')}
          />
          Complete profile now
        </label>
        {canManagerOverride && (
          <label className="d-block mb-1">
            <input
              type="radio"
              name="nc-revisit-path"
              className="mr-1"
              checked={selectedPath === 'manager_override'}
              onChange={() => onSelectPath('manager_override')}
            />
            Manager override (reason required)
          </label>
        )}
        <label className="d-block mb-0">
          <input
            type="radio"
            name="nc-revisit-path"
            className="mr-1"
            checked={selectedPath === 'awaiting_documents'}
            onChange={() => onSelectPath('awaiting_documents')}
          />
          Patient fetches documents
        </label>
      </div>
      {selectedPath === 'manager_override' && (
        <div className="form-group mb-0 mt-2">
          <label htmlFor="nc-revisit-override-reason" className="small mb-1">Override reason</label>
          <textarea
            id="nc-revisit-override-reason"
            className="form-control form-control-sm"
            rows={2}
            value={overrideReason}
            onChange={(e) => onOverrideReasonChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

interface ActiveVisitBannerProps {
  queueNumber: number | string;
  state: VisitState;
  visitBoardUrl?: string;
  canCancelVisit: boolean;
  onCancelVisit: () => void;
}

export function ActiveVisitBanner({
  queueNumber,
  state,
  visitBoardUrl,
  canCancelVisit,
  onCancelVisit,
}: ActiveVisitBannerProps) {
  return (
    <div className="alert alert-warning py-2 mb-3" id="nc-active-visit-banner">
      <div className="d-flex flex-wrap align-items-center justify-content-between">
        <div>
          <strong>Patient already has visit #{queueNumber} today</strong>
          <div className="mt-1">
            <StatusPill state={state} queueNumber={String(queueNumber)} />
          </div>
          <div className="small text-muted mt-1">
            Start visit is disabled until this visit is finished or cancelled.
          </div>
        </div>
        <div className="mt-2 mt-md-0">
          {visitBoardUrl && (
            <a className="btn btn-sm btn-primary mr-2" href={visitBoardUrl} target="_top">
              Open Visit Board
            </a>
          )}
          {canCancelVisit && (
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={onCancelVisit}>
              Cancel visit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
