import type { CashierResolveVisit } from '@core/types';
import { formatMoney } from './cashierUtils';

interface PickVisitModalProps {
  open: boolean;
  visits: CashierResolveVisit[];
  onClose: () => void;
  onPick: (visitId: number) => void;
}

export function PickVisitModal({ open, visits, onClose, onPick }: PickVisitModalProps) {
  if (!open) return null;

  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Select visit to pay</h5>
              <button type="button" className="close" aria-label="Close" onClick={onClose}>
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="modal-body list-group list-group-flush p-0">
              {visits.map((visit) => (
                <button
                  key={visit.id}
                  type="button"
                  className="list-group-item list-group-item-action text-left"
                  onClick={() => onPick(visit.id)}
                >
                  <strong>#{visit.queue_number} {visit.display_name}</strong>
                  <div className="small text-muted">
                    {visit.visit_type_label || 'Visit'} · {formatMoney(visit.charges_total ?? 0)}
                  </div>
                </button>
              ))}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
