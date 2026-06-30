import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { ConfirmModal } from '@components/ConfirmModal';
import { SlideOver } from '@components/SlideOver';
import type { DestroyConfirmResult, DestroyForm, DestroyLotContext } from './pharmOpsTypes';

interface PharmOpsDestroyDrawerProps {
  open: boolean;
  ajaxUrl: string;
  csrfToken: string;
  canDestroy: boolean;
  context: DestroyLotContext | null;
  onClose: () => void;
  onDestroyed?: () => void;
}

export function PharmOpsDestroyDrawer({
  open,
  ajaxUrl,
  csrfToken,
  canDestroy,
  context,
  onClose,
  onDestroyed,
}: PharmOpsDestroyDrawerProps) {
  const [form, setForm] = useState<DestroyForm | null>(null);
  const [destroyDate, setDestroyDate] = useState('');
  const [method, setMethod] = useState('');
  const [witness, setWitness] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<DestroyConfirmResult | null>(null);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const resetState = useCallback(() => {
    setForm(null);
    setDestroyDate('');
    setMethod('');
    setWitness('');
    setNotes('');
    setLoadError(null);
    setSubmitError(null);
    setSuccess(null);
  }, []);

  const loadForm = useCallback(async () => {
    if (!context) return;

    setLoading(true);
    setLoadError(null);
    setSuccess(null);
    try {
      const data = await oeFetch<DestroyForm>('pharm_ops.destroy_get', {
        ...fetchOptions,
        json: {
          drug_id: context.drugId,
          inventory_id: context.inventoryId,
        },
      });
      setForm(data);
      setDestroyDate(data.default_destroy_date ?? new Date().toISOString().slice(0, 10));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load lot';
      setLoadError(message);
      setForm(null);
    } finally {
      setLoading(false);
    }
  }, [context, fetchOptions]);

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }
    void loadForm();
  }, [loadForm, open, resetState]);

  const lot = form?.lot;
  const title = lot?.drug_name ?? context?.drugName ?? 'Destroy lot';

  const handleSubmit = async () => {
    if (!context || !canDestroy) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await oeFetch<DestroyConfirmResult>('pharm_ops.destroy_confirm', {
        ...fetchOptions,
        method: 'POST',
        json: {
          drug_id: context.drugId,
          inventory_id: context.inventoryId,
          destroy_date: destroyDate,
          destroy_method: method,
          destroy_witness: witness,
          destroy_notes: notes,
        },
      });
      setSuccess(result);
      onDestroyed?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Destruction failed';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const canSubmit = canDestroy
    && destroyDate !== ''
    && method.trim() !== ''
    && witness.trim() !== ''
    && !submitting
    && !success;

  return (
    <SlideOver
      open={open}
      id="nc-pharmops-destroy-drawer"
      title={`Write off — ${title}`}
      onClose={onClose}
      width="md"
    >
      {loading ? (
        <p className="text-muted">Loading lot…</p>
      ) : null}

      {loadError ? (
        <div className="alert alert-warning" role="alert">{loadError}</div>
      ) : null}

      {success ? (
        <div className="alert alert-success" role="status">
          Lot {success.lot_number} marked destroyed on {success.destroy_date}.
        </div>
      ) : null}

      {lot && !success ? (
        <div className="oe-nc-pharmops-destroy-form">
          <dl className="oe-nc-pharmops-destroy-form__meta mb-3">
            <div>
              <dt>Lot number</dt>
              <dd>{lot.lot_number || '—'}</dd>
            </div>
            {lot.manufacturer ? (
              <div>
                <dt>Manufacturer</dt>
                <dd>{lot.manufacturer}</dd>
              </div>
            ) : null}
            <div>
              <dt>Quantity on hand</dt>
              <dd>{lot.on_hand}</dd>
            </div>
            <div>
              <dt>Expiration</dt>
              <dd>{lot.expiration}</dd>
            </div>
            {lot.warehouse ? (
              <div>
                <dt>Warehouse</dt>
                <dd>{lot.warehouse}</dd>
              </div>
            ) : null}
            <div>
              <dt>Status</dt>
              <dd>{lot.status_label}</dd>
            </div>
          </dl>

          {!canDestroy ? (
            <div className="alert alert-secondary" role="status">
              You do not have permission to destroy lots. Ask a pharmacy lead or administrator.
            </div>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="nc-pharmops-destroy-date">Date destroyed</label>
                <input
                  id="nc-pharmops-destroy-date"
                  type="date"
                  className="form-control form-control-sm"
                  value={destroyDate}
                  onChange={(event) => setDestroyDate(event.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="nc-pharmops-destroy-method">Method of destruction</label>
                <input
                  id="nc-pharmops-destroy-method"
                  type="text"
                  className="form-control form-control-sm"
                  maxLength={250}
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="nc-pharmops-destroy-witness">Witness</label>
                <input
                  id="nc-pharmops-destroy-witness"
                  type="text"
                  className="form-control form-control-sm"
                  maxLength={250}
                  value={witness}
                  onChange={(event) => setWitness(event.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="nc-pharmops-destroy-notes">Notes</label>
                <input
                  id="nc-pharmops-destroy-notes"
                  type="text"
                  className="form-control form-control-sm"
                  maxLength={250}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
              {submitError ? (
                <div className="alert alert-warning" role="alert">{submitError}</div>
              ) : null}
              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={!canSubmit}
                  onClick={() => setConfirmOpen(true)}
                >
                  Destroy lot
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm lot destruction"
        confirmLabel={submitting ? 'Destroying…' : 'Destroy lot'}
        confirmVariant="danger"
        submitting={submitting}
        onConfirm={() => {
          void handleSubmit();
        }}
      >
        <p className="mb-0">
          Really destroy lot {lot?.lot_number ?? '—'}? This cannot be undone.
        </p>
      </ConfirmModal>
    </SlideOver>
  );
}
