import { useState } from 'react';
import type { ClinicalDocCard, ClinicalDocLens } from './clinicalDocTypes';
import { openClinicalDocForm } from './clinicalDocApi';

interface AddFormPickerProps {
  addableForms: ClinicalDocCard[];
  visitId: number;
  ajaxUrl: string;
  csrfToken: string;
  lens: ClinicalDocLens;
  onOpenError: (message: string) => void;
}

export function AddFormPicker({
  addableForms,
  visitId,
  ajaxUrl,
  csrfToken,
  lens,
  onOpenError,
}: AddFormPickerProps) {
  const [open, setOpen] = useState(false);

  if (addableForms.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm mb-3"
        onClick={() => setOpen(true)}
      >
        Add form
      </button>
      {open && (
        <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="nc-clinicaldoc-add-form-title">
          <div className="modal-dialog modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title h5" id="nc-clinicaldoc-add-form-title">Add form</h2>
                <button type="button" className="close" aria-label="Close" onClick={() => setOpen(false)}>
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>
              <div className="modal-body p-0">
                <ul className="list-group list-group-flush">
                  {addableForms.map((card) => (
                    <li key={card.id} className="list-group-item">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <div className="font-weight-medium">{card.title}</div>
                          <div className="small text-muted">{card.description}</div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary ml-2"
                          onClick={() => {
                            void openClinicalDocForm(ajaxUrl, csrfToken, visitId, card, {
                              lens: card.source_lens ?? card.lens ?? lens,
                              returnTo: 'hub',
                            }).catch((err: unknown) => {
                              onOpenError(err instanceof Error ? err.message : 'Could not open form');
                            });
                          }}
                        >
                          Open
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="modal-backdrop fade show border-0 p-0"
            aria-label="Close"
            onClick={() => setOpen(false)}
            style={{ background: 'rgba(0,0,0,0.5)' }}
          />
        </div>
      )}
    </>
  );
}
