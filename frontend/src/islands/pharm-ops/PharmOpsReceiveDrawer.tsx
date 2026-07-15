import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { ConfirmModal } from '@components/ConfirmModal';
import { SlideOver } from '@components/SlideOver';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { NativeSelect } from '@components/ui/native-select';
import { Textarea } from '@components/ui/textarea';
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
        dismissOnOutsideClick={false}
        id="nc-pharmops-receive-drawer"
        title="Receive stock"
        width="md"
        footer={success ? (
          <Button type="button" size="sm" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!canSubmit}
              onClick={() => setConfirmOpen(true)}
            >
              Confirm receive
            </Button>
          </>
        )}
      >
        {loadingForm && !form ? (
          <p className="text-[var(--oe-nc-text-muted)] mb-0">Loading…</p>
        ) : loadError ? (
          <div className={deskCalloutClass('error', 'mb-0')}>{loadError}</div>
        ) : success ? (
          <div className={deskCalloutClass('success', 'mb-0')} role="status">
            Received {drugName} · lot {success.lot_number} · qty {success.quantity}
            {success.on_hand ? ` · QOH now ${success.on_hand}` : ''}.
          </div>
        ) : form ? (
          <>
            <div className="mb-3 position-relative">
              <label className="text-sm font-bold mb-1" htmlFor="nc-pharmops-receive-drug">
                Product
              </label>
              <Input
                id="nc-pharmops-receive-drug"
                type="search"
                className="h-8"
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
                  if (related?.closest('.nc-list-group')) return;
                  setTimeout(() => setDrugOpen(false), 150);
                }}
                onFocus={() => {
                  if (drugResults.length > 0) setDrugOpen(true);
                }}
              />
              {loadingDrugs ? <div className="text-sm text-[var(--oe-nc-text-muted)] mt-1">Searching…</div> : null}
              {drugSearchError ? (
                <div className="text-sm text-[var(--oe-nc-danger,#dc2626)] mt-1" role="alert">{drugSearchError}</div>
              ) : null}
              {drugOpen && drugQuery.trim().length >= 2 && !selectedDrug && !drugSearchError ? (
                <div
                  className="nc-list-group absolute w-full shadow-sm"
                  style={{ zIndex: 20, maxHeight: 240, overflowY: 'auto' }}
                >
                  {drugResults.length === 0 ? (
                    <div className="nc-list-group-item text-[var(--oe-nc-text-muted)]">No products found</div>
                  ) : (
                    drugResults.map((row) => (
                      <button
                        key={row.drug_id}
                        type="button"
                        className="nc-list-group-item nc-list-group-item-action text-left"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectDrug(row)}
                      >
                        <strong>{row.drug_name}</strong>
                        <span className="text-[var(--oe-nc-text-muted)] text-sm ml-2">QOH {row.on_hand ?? 0}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            {selectedDrug ? (
              <div className="nc-pharmops-dispense-stock mb-3 text-sm text-[var(--oe-nc-text-muted)]">
                Current QOH: {form.drug?.on_hand ?? selectedDrug.on_hand ?? 0}
              </div>
            ) : null}

            <div className="nc-form-group">
              <label htmlFor="nc-pharmops-receive-warehouse">Warehouse</label>
              <NativeSelect
                id="nc-pharmops-receive-warehouse"
                className="h-8"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">Select warehouse</option>
                {(form.warehouses ?? []).map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.title}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="nc-form-group col-span-12 md:col-span-6">
                <label htmlFor="nc-pharmops-receive-lot">Lot / batch #</label>
                <Input
                  id="nc-pharmops-receive-lot"
                  type="text"
                  className="h-8"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                />
              </div>
              <div className="nc-form-group col-span-12 md:col-span-6">
                <label htmlFor="nc-pharmops-receive-exp">Expiry</label>
                <Input
                  id="nc-pharmops-receive-exp"
                  type="date"
                  className="h-8"
                  value={expiration}
                  onChange={(e) => setExpiration(e.target.value)}
                />
              </div>
            </div>

            <div className="nc-form-group">
              <label htmlFor="nc-pharmops-receive-mfr">Manufacturer (optional)</label>
              <Input
                id="nc-pharmops-receive-mfr"
                type="text"
                className="h-8"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="nc-form-group col-span-12 md:col-span-4">
                <label htmlFor="nc-pharmops-receive-qty">Qty received</label>
                <Input
                  id="nc-pharmops-receive-qty"
                  type="number"
                  min={1}
                  className="h-8"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="nc-form-group col-span-12 md:col-span-4">
                <label htmlFor="nc-pharmops-receive-unit-cost">Unit cost ({currency})</label>
                <Input
                  id="nc-pharmops-receive-unit-cost"
                  type="number"
                  min={0}
                  step="0.01"
                  className="h-8"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                />
              </div>
              <div className="nc-form-group col-span-12 md:col-span-4">
                <label htmlFor="nc-pharmops-receive-total">Total ({currency})</label>
                <Input
                  id="nc-pharmops-receive-total"
                  type="text"
                  className="h-8"
                  value={totalCost.toFixed(2)}
                  readOnly
                />
              </div>
            </div>

            <div className="nc-form-group mb-0">
              <label htmlFor="nc-pharmops-receive-notes">Notes (optional)</label>
              <Textarea
                id="nc-pharmops-receive-notes"
                className="min-h-[4.5rem]"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {submitError ? (
              <div className={deskCalloutClass('error', 'py-2 px-3 text-sm mt-3 mb-0')}>{submitError}</div>
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
          <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0">
            Warehouse:
            {' '}
            {(form?.warehouses ?? []).find((w) => w.id === warehouseId)?.title ?? warehouseId}
          </p>
        ) : null}
      </ConfirmModal>
    </>
  );
}
