import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { ConfirmModal } from '@components/ConfirmModal';
import { SlideOver } from '@components/SlideOver';
import { usePharmDrugSearch } from './usePharmDrugSearch';
import type {
  OtcDrugSearchRow,
  ReceiveForm,
  ReceiveInitialContext,
  ReceiveSaveResult,
} from './pharmOpsTypes';

interface PharmOpsReceiveDrawerProps {
  open: boolean;
  ajaxUrl: string;
  csrfToken: string;
  canReceive: boolean;
  initialContext?: ReceiveInitialContext | null;
  onClose: () => void;
  onReceived?: () => void;
}

export function PharmOpsReceiveDrawer({
  open,
  ajaxUrl,
  csrfToken,
  canReceive,
  initialContext,
  onClose,
  onReceived,
}: PharmOpsReceiveDrawerProps) {
  const [form, setForm] = useState<ReceiveForm | null>(null);
  const [selectedDrug, setSelectedDrug] = useState<OtcDrugSearchRow | null>(null);
  const [drugQuery, setDrugQuery] = useState('');
  const [drugOpen, setDrugOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [expiration, setExpiration] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('0');
  const [notes, setNotes] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadingForm, setLoadingForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<ReceiveSaveResult | null>(null);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);
  const drugSearching = open && drugQuery.trim().length >= 2 && selectedDrug == null;
  const {
    results: drugResults,
    loading: loadingDrugs,
    error: drugSearchError,
  } = usePharmDrugSearch({
    open: drugSearching,
    query: drugQuery,
    ajaxUrl,
    csrfToken,
  });

  useEffect(() => {
    if (drugSearching && drugResults.length > 0) {
      setDrugOpen(true);
    }
  }, [drugResults, drugSearching]);

  const resetState = useCallback(() => {
    setForm(null);
    setSelectedDrug(null);
    setDrugQuery('');
    setDrugOpen(false);
    setWarehouseId('');
    setLotNumber('');
    setExpiration('');
    setManufacturer('');
    setQuantity('1');
    setUnitCost('0');
    setNotes('');
    setLoadError(null);
    setSubmitError(null);
    setSuccess(null);
  }, []);

  const loadReceiveForm = useCallback(async (drugId?: number) => {
    setLoadingForm(true);
    setLoadError(null);
    setSuccess(null);
    try {
      const body: Record<string, unknown> = {};
      if (drugId && drugId > 0) body.drug_id = drugId;
      const data = await oeFetch<ReceiveForm>('pharm_ops.receive_get', {
        ...fetchOptions,
        json: body,
      });
      setForm(data);
      setWarehouseId(data.default_warehouse_id ?? data.warehouses?.[0]?.id ?? '');
      if (data.drug) {
        setSelectedDrug({
          drug_id: data.drug.drug_id,
          drug_name: data.drug.drug_name,
          on_hand: data.drug.on_hand,
        });
        setDrugQuery(data.drug.drug_name);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load receive form');
      setForm(null);
    } finally {
      setLoadingForm(false);
    }
  }, [fetchOptions]);

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }
    void loadReceiveForm(initialContext?.drugId);
    if (initialContext?.drugName) {
      setDrugQuery(initialContext.drugName);
    }
  }, [initialContext, loadReceiveForm, open, resetState]);

  const handleSelectDrug = useCallback((row: OtcDrugSearchRow) => {
    setSelectedDrug(row);
    setDrugQuery(row.drug_name);
    setDrugOpen(false);
    setSubmitError(null);
    setSuccess(null);
    void loadReceiveForm(row.drug_id);
  }, [loadReceiveForm]);

  const handleConfirm = useCallback(async () => {
    if (!selectedDrug) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await oeFetch<ReceiveSaveResult>('pharm_ops.receive_save', {
        ...fetchOptions,
        json: {
          drug_id: selectedDrug.drug_id,
          warehouse_id: warehouseId,
          lot_number: lotNumber,
          expiration,
          manufacturer,
          quantity: Number(quantity),
          unit_cost: Number(unitCost),
          notes,
        },
      });
      setSuccess(result);
      setConfirmOpen(false);
      onReceived?.();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Receive failed');
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }, [
    expiration,
    fetchOptions,
    lotNumber,
    manufacturer,
    notes,
    onReceived,
    quantity,
    selectedDrug,
    unitCost,
    warehouseId,
  ]);

  const drugName = selectedDrug?.drug_name ?? form?.drug?.drug_name ?? 'Product';
  const currency = form?.currency_symbol ?? '';
  const totalCost = (Number(quantity) || 0) * (Number(unitCost) || 0);
  const canSubmit = canReceive
    && !loadingForm
    && !success
    && selectedDrug != null
    && warehouseId !== ''
    && lotNumber.trim() !== ''
    && expiration !== ''
    && Number(quantity) > 0;

  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        id="nc-pharmops-receive-drawer"
        title="Receive stock"
        width="md"
        footer={success ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
            Close
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!canSubmit}
              onClick={() => setConfirmOpen(true)}
            >
              Confirm receive
            </button>
          </>
        )}
      >
        {loadingForm && !form ? (
          <p className="text-muted mb-0">Loading…</p>
        ) : loadError ? (
          <div className="alert alert-danger mb-0">{loadError}</div>
        ) : success ? (
          <div className="alert alert-success mb-0" role="status">
            Received {drugName} · lot {success.lot_number} · qty {success.quantity}
            {success.on_hand ? ` · QOH now ${success.on_hand}` : ''}.
          </div>
        ) : form ? (
          <>
            <div className="mb-3 position-relative">
              <label className="small font-weight-bold mb-1" htmlFor="nc-pharmops-receive-drug">
                Product
              </label>
              <input
                id="nc-pharmops-receive-drug"
                type="search"
                className="form-control form-control-sm"
                placeholder="Search products"
                autoComplete="off"
                value={drugQuery}
                onChange={(e) => {
                  const next = e.target.value;
                  setDrugQuery(next);
                  setSelectedDrug(null);
                  if (next.trim().length >= 2) setDrugOpen(true);
                }}
                onBlur={(e) => {
                  const related = e.relatedTarget as HTMLElement | null;
                  if (related?.closest('.list-group')) return;
                  setTimeout(() => setDrugOpen(false), 150);
                }}
                onFocus={() => {
                  if (drugResults.length > 0) setDrugOpen(true);
                }}
              />
              {loadingDrugs ? <div className="small text-muted mt-1">Searching…</div> : null}
              {drugSearchError ? (
                <div className="small text-danger mt-1" role="alert">{drugSearchError}</div>
              ) : null}
              {drugOpen && drugQuery.trim().length >= 2 && !selectedDrug && !drugSearchError ? (
                <div
                  className="list-group position-absolute w-100 shadow-sm"
                  style={{ zIndex: 20, maxHeight: 240, overflowY: 'auto' }}
                >
                  {drugResults.length === 0 ? (
                    <div className="list-group-item text-muted">No products found</div>
                  ) : (
                    drugResults.map((row) => (
                      <button
                        key={row.drug_id}
                        type="button"
                        className="list-group-item list-group-item-action text-left"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectDrug(row)}
                      >
                        <strong>{row.drug_name}</strong>
                        <span className="text-muted small ml-2">QOH {row.on_hand ?? 0}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            {selectedDrug ? (
              <div className="oe-nc-pharmops-dispense__stock mb-3 small text-muted">
                Current QOH: {form.drug?.on_hand ?? selectedDrug.on_hand ?? 0}
              </div>
            ) : null}

            <div className="form-group">
              <label htmlFor="nc-pharmops-receive-warehouse">Warehouse</label>
              <select
                id="nc-pharmops-receive-warehouse"
                className="form-control form-control-sm"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">Select warehouse</option>
                {(form.warehouses ?? []).map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group col-md-6">
                <label htmlFor="nc-pharmops-receive-lot">Lot / batch #</label>
                <input
                  id="nc-pharmops-receive-lot"
                  type="text"
                  className="form-control form-control-sm"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                />
              </div>
              <div className="form-group col-md-6">
                <label htmlFor="nc-pharmops-receive-exp">Expiry</label>
                <input
                  id="nc-pharmops-receive-exp"
                  type="date"
                  className="form-control form-control-sm"
                  value={expiration}
                  onChange={(e) => setExpiration(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="nc-pharmops-receive-mfr">Manufacturer (optional)</label>
              <input
                id="nc-pharmops-receive-mfr"
                type="text"
                className="form-control form-control-sm"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
              />
            </div>

            <div className="form-row">
              <div className="form-group col-md-4">
                <label htmlFor="nc-pharmops-receive-qty">Qty received</label>
                <input
                  id="nc-pharmops-receive-qty"
                  type="number"
                  min={1}
                  className="form-control form-control-sm"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="form-group col-md-4">
                <label htmlFor="nc-pharmops-receive-unit-cost">Unit cost ({currency})</label>
                <input
                  id="nc-pharmops-receive-unit-cost"
                  type="number"
                  min={0}
                  step="0.01"
                  className="form-control form-control-sm"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                />
              </div>
              <div className="form-group col-md-4">
                <label htmlFor="nc-pharmops-receive-total">Total ({currency})</label>
                <input
                  id="nc-pharmops-receive-total"
                  type="text"
                  className="form-control form-control-sm"
                  value={totalCost.toFixed(2)}
                  readOnly
                />
              </div>
            </div>

            <div className="form-group mb-0">
              <label htmlFor="nc-pharmops-receive-notes">Notes (optional)</label>
              <textarea
                id="nc-pharmops-receive-notes"
                className="form-control form-control-sm"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {submitError ? (
              <div className="alert alert-danger py-2 px-3 small mt-3 mb-0">{submitError}</div>
            ) : null}
          </>
        ) : null}
      </SlideOver>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm stock receive"
        confirmLabel="Receive"
        confirmVariant="success"
        submitting={submitting}
        submittingLabel="Receiving…"
        onConfirm={() => { void handleConfirm(); }}
      >
        <p className="mb-2">
          <strong>{drugName}</strong>
          {' · '}
          lot {lotNumber}
          {' · '}
          qty {quantity}
          {currency ? ` · ${currency}${totalCost.toFixed(2)}` : ''}
        </p>
        {warehouseId ? (
          <p className="small text-muted mb-0">
            Warehouse:
            {' '}
            {(form?.warehouses ?? []).find((w) => w.id === warehouseId)?.title ?? warehouseId}
          </p>
        ) : null}
      </ConfirmModal>
    </>
  );
}
