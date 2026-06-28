interface AccessionModalProps {
  open: boolean;
  accession: string;
  submitting: boolean;
  onAccessionChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function AccessionModal({
  open,
  accession,
  submitting,
  onAccessionChange,
  onConfirm,
  onClose,
}: AccessionModalProps) {
  if (!open) return null;

  return (
    <>
      <div className="modal fade show d-block" role="dialog" aria-labelledby="nc-labops-accession-title" aria-modal="true">
        <div className="modal-dialog modal-sm" role="document">
          <div className="modal-content">
            <div className="modal-header py-2">
              <h3 className="h6 modal-title" id="nc-labops-accession-title">Mark collected</h3>
              <button type="button" className="close" aria-label="Close" onClick={onClose}>
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="modal-body">
              <label className="small font-weight-bold" htmlFor="nc-labops-accession-input">
                Accession number (optional)
              </label>
              <input
                id="nc-labops-accession-input"
                type="text"
                className="form-control form-control-sm"
                autoComplete="off"
                value={accession}
                onChange={(e) => onAccessionChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onConfirm();
                }}
              />
            </div>
            <div className="modal-footer py-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                id="nc-labops-accession-confirm"
                disabled={submitting}
                onClick={onConfirm}
              >
                Mark collected
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} aria-hidden="true" />
    </>
  );
}
