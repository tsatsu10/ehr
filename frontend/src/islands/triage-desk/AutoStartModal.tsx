/**
 * AutoStartModal — "Start visit at triage" modal.
 *
 * Shown when a patient is found via Find Patient but has no active visit.
 * Mirrors openAutoStartModal() + confirmAutoStart() from triage.js.
 */

import { useState } from 'react';
import type { VisitType } from '@core/types';

interface AutoStartModalProps {
  open: boolean;
  patientName: string;
  patientMrn: string;
  visitTypes: VisitType[];
  submitting: boolean;
  error: string | null;
  onConfirm: (visitTypeId: number, isUrgent: boolean) => void;
  onClose: () => void;
}

export function AutoStartModal({
  open,
  patientName,
  patientMrn,
  visitTypes,
  submitting,
  error,
  onConfirm,
  onClose,
}: AutoStartModalProps) {
  const [visitTypeId, setVisitTypeId] = useState<number>(visitTypes[0]?.id ?? 0);
  const [isUrgent, setIsUrgent] = useState(false);

  if (!open) return null;

  const handleConfirm = () => {
    const id = visitTypeId || visitTypes[0]?.id;
    if (!id) return;
    onConfirm(id, isUrgent);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-backdrop fade show"
        style={{ display: 'block' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="modal fade show"
        style={{ display: 'block' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nc-auto-start-title"
      >
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="nc-auto-start-title">
                Start visit at triage
              </h5>
              <button
                type="button"
                className="close"
                aria-label="Close"
                onClick={onClose}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <div className="modal-body">
              <p>
                <strong>{patientName}</strong>
                {patientMrn && <span className="text-muted ml-1">· MRN {patientMrn}</span>}
              </p>
              <p className="text-muted small">
                No visit was started at Front Desk. Start one now and begin triage?
              </p>

              <div className="form-group">
                <label htmlFor="nc-auto-start-visit-type">Visit type</label>
                {visitTypes.length === 0 ? (
                  <div className="alert alert-warning py-2">No visit types configured</div>
                ) : (
                  <select
                    id="nc-auto-start-visit-type"
                    className="form-control"
                    value={visitTypeId}
                    onChange={(e) => setVisitTypeId(Number(e.target.value))}
                  >
                    {visitTypes.map((vt) => (
                      <option key={vt.id} value={vt.id}>{vt.label}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="nc-auto-start-urgent"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="nc-auto-start-urgent">
                  Urgent
                </label>
              </div>

              {error && (
                <div className="alert alert-danger mt-2" role="alert">
                  {error}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirm}
                disabled={submitting || visitTypes.length === 0}
              >
                {submitting ? 'Starting…' : 'Start and triage'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
