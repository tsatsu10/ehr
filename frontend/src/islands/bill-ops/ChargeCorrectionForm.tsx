import { useCallback, useEffect, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import type { ChargeLine, FeeScheduleItem, VisitChargesData } from './billOpsTypes';
import { formatBillMoney } from './billOpsFormatters';

interface FetchOptions {
  ajaxUrl: string;
  csrfToken: string;
}

interface Props {
  fetchOptions: FetchOptions;
  visitId: number | null;
  autoLoad?: boolean;
  showVisitLookup?: boolean;
  onSaved?: () => void;
}

export function ChargeCorrectionForm({
  fetchOptions,
  visitId: visitIdProp,
  autoLoad = false,
  showVisitLookup = false,
  onSaved,
}: Props) {
  const [visitIdInput, setVisitIdInput] = useState(visitIdProp ? String(visitIdProp) : '');
  const [data, setData] = useState<VisitChargesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFeeId, setSelectedFeeId] = useState('');
  const [units, setUnits] = useState('1');
  const [removeIds, setRemoveIds] = useState<number[]>([]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const loadVisit = useCallback(async (visitId: number) => {
    if (!visitId) {
      setError('Enter a visit id');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await oeFetch<VisitChargesData>('bill_ops.visit_charges', {
        ...fetchOptions,
        json: { visit_id: visitId },
      });
      setData(payload);
      setRemoveIds([]);
    } catch {
      setError('Could not load visit charges');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fetchOptions]);

  useEffect(() => {
    if (visitIdProp && visitIdProp > 0) {
      setVisitIdInput(String(visitIdProp));
      if (autoLoad) {
        void loadVisit(visitIdProp);
      }
    }
  }, [autoLoad, loadVisit, visitIdProp]);

  const toggleRemove = (id: number) => {
    setRemoveIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const saveCorrection = async () => {
    if (!data) return;
    const add: { fee_schedule_id: number; units: number }[] = [];
    if (selectedFeeId) {
      add.push({ fee_schedule_id: Number(selectedFeeId), units: Math.max(1, Number(units) || 1) });
    }
    if (add.length === 0 && removeIds.length === 0) {
      setError('Add or remove at least one line');
      return;
    }
    if (!reason.trim()) {
      setError('Reason is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await oeFetch<VisitChargesData>('bill_ops.charge_correct', {
        ...fetchOptions,
        method: 'POST',
        json: {
          visit_id: data.visit.id,
          add,
          remove: removeIds,
          reason: reason.trim(),
        },
      });
      setData((prev) => (prev ? { ...prev, ...updated, visit: prev.visit } : prev));
      setRemoveIds([]);
      setSelectedFeeId('');
      setReason('');
      onSaved?.();
    } catch {
      setError('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const symbol = data?.currency_symbol ?? 'GH₵';

  return (
    <div className="oe-nc-billops-correction-form">
      {showVisitLookup && (
        <div className="form-inline mb-3 flex-wrap">
          <label className="sr-only" htmlFor="nc-billops-visit-id">Visit id</label>
          <input
            id="nc-billops-visit-id"
            type="number"
            className="form-control form-control-sm mr-2 mb-1"
            placeholder="Visit id"
            value={visitIdInput}
            onChange={(e) => setVisitIdInput(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm mb-1"
            onClick={() => void loadVisit(Number(visitIdInput))}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Load visit'}
          </button>
        </div>
      )}

      {error && <div className="alert alert-warning py-2">{error}</div>}

      {data && (
        <>
          <div className="mb-3 small text-muted">
            Visit #{data.visit.queue_number} · {data.visit.patient_name ?? ''} · {data.visit.state}
            {' · '}
            Due {formatBillMoney(symbol, data.balance_due)} (paid {formatBillMoney(symbol, data.paid_total)})
          </div>

          <h3 className="h6">Existing charges</h3>
          <table className="table table-sm table-hover mb-3">
            <thead>
              <tr>
                <th scope="col">Remove</th>
                <th scope="col">Description</th>
                <th scope="col" className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.charges.map((line: ChargeLine) => (
                <tr key={line.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={removeIds.includes(line.id)}
                      onChange={() => toggleRemove(line.id)}
                      aria-label={`Remove ${line.description}`}
                    />
                  </td>
                  <td>{line.description}</td>
                  <td className="text-right">{formatBillMoney(symbol, line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="h6">Add line</h3>
          <div className="form-row mb-3">
            <div className="col-md-6 mb-2">
              <select
                className="form-control form-control-sm"
                value={selectedFeeId}
                onChange={(e) => setSelectedFeeId(e.target.value)}
              >
                <option value="">Fee schedule…</option>
                {data.fee_schedule.map((fee: FeeScheduleItem) => (
                  <option key={fee.id} value={fee.id}>
                    {fee.name} — {formatBillMoney(symbol, fee.price_amount)}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2 mb-2">
              <input
                type="number"
                min={1}
                className="form-control form-control-sm"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                aria-label="Quantity"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="nc-billops-correction-reason">Reason (required)</label>
            <input
              id="nc-billops-correction-reason"
              type="text"
              className="form-control form-control-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void saveCorrection()}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save correction'}
          </button>
        </>
      )}
    </div>
  );
}
