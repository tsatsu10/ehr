/**
 * RoutingModal — confirm lab/pharmacy routing when completing a consult.
 */

import { useState } from 'react';
import type { DoctorVisit, PatientPreview, RoutingPreview } from '@core/types';
import { useModalDismiss } from '@components/useModalDismiss';
import { postDoctorAction } from './postDoctorAction';

interface RoutingModalProps {
  open: boolean;
  visit: DoctorVisit | null;
  preview: PatientPreview | null;
  routingPreview: RoutingPreview | null;
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  blocked: boolean;
  onClose: () => void;
  onCompleted: () => void;
}

interface RoutingModalBodyProps {
  visit: DoctorVisit;
  preview: PatientPreview;
  routingPreview: RoutingPreview | null;
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  blocked: boolean;
  onClose: () => void;
  onCompleted: () => void;
}

function RoutingModalBody({
  visit,
  preview,
  routingPreview,
  ajaxUrl,
  csrfToken,
  facilityId,
  blocked,
  onClose,
  onCompleted,
}: RoutingModalBodyProps) {
  const routing = routingPreview ?? {
    detected_lab: false,
    detected_rx: false,
    lab_count: 0,
    rx_count: 0,
  };

  const [needsLab, setNeedsLab] = useState(!!routing.detected_lab);
  const [needsRx, setNeedsRx] = useState(!!routing.detected_rx && !routing.detected_lab);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const identity = preview.identity;

  const handleConfirm = async () => {
    if (blocked || submitting) return;

    if (needsLab && needsRx) {
      setError('Choose lab or pharmacy routing, not both');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await postDoctorAction<{ visit?: DoctorVisit }>({
      ajaxUrl,
      csrfToken,
      facilityId,
      action: 'doctor.complete',
      body: {
        visit_id: visit.id,
        row_version: visit.row_version ?? 0,
        needs_lab: needsLab,
        needs_rx: needsRx,
        notes: notes.trim(),
      },
    });

    setSubmitting(false);

    if (!result.ok) {
      const data = result.data as { code?: string; encounter_url?: string } | undefined;
      if (result.status === 409 && data?.code === 'encounter_unsigned') {
        setError(result.message || 'Documentation must be signed first');
        if (data.encounter_url) {
          window.open(data.encounter_url, '_blank', 'noopener,noreferrer');
        }
        return;
      }
      setError(result.message || 'Complete failed');
      return;
    }

    onCompleted();
  };

  return (
    <>
      <div
        className="modal fade show d-block"
        id="nc-doctor-routing-modal"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="nc-doctor-routing-title"
        aria-modal="true"
      >
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="nc-doctor-routing-title">Confirm routing</h5>
              <button type="button" className="close" aria-label="Close" onClick={onClose}>
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="modal-body">
              <p id="nc-routing-patient" className="mb-2">
                {identity.display_name} · MRN {identity.pubpid}
              </p>
              <p className="text-muted small" id="nc-routing-detected">
                System detected: {routing.lab_count} lab order(s), {routing.rx_count} Rx today
              </p>
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="nc-routing-lab"
                  checked={needsLab}
                  onChange={(e) => setNeedsLab(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="nc-routing-lab">
                  Send to lab
                </label>
              </div>
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="nc-routing-rx"
                  checked={needsRx}
                  onChange={(e) => setNeedsRx(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="nc-routing-rx">
                  Send to pharmacy
                </label>
              </div>
              <div className="form-group mt-2">
                <label htmlFor="nc-routing-notes">Notes (optional)</label>
                <textarea
                  className="form-control"
                  id="nc-routing-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              {error && (
                <div className="alert alert-danger mt-2" id="nc-routing-error" role="alert">
                  {error}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                id="nc-routing-confirm"
                disabled={submitting || blocked}
                onClick={() => void handleConfirm()}
              >
                {submitting ? 'Routing…' : 'Confirm and route'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        className="modal-backdrop fade show"
        id="nc-doctor-modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
    </>
  );
}

export function RoutingModal({
  open,
  visit,
  preview,
  routingPreview,
  ajaxUrl,
  csrfToken,
  facilityId,
  blocked,
  onClose,
  onCompleted,
}: RoutingModalProps) {
  useModalDismiss(open, onClose);

  if (!open || !visit || !preview) return null;

  return (
    <RoutingModalBody
      key={`${visit.id}-${routingPreview?.lab_count ?? 0}-${routingPreview?.rx_count ?? 0}`}
      visit={visit}
      preview={preview}
      routingPreview={routingPreview}
      ajaxUrl={ajaxUrl}
      csrfToken={csrfToken}
      facilityId={facilityId}
      blocked={blocked}
      onClose={onClose}
      onCompleted={onCompleted}
    />
  );
}
