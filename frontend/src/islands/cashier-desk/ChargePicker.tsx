import { useState } from 'react';
import type { CashierFeeScheduleItem, CashierStagedLine } from '@core/types';
import { formatMoney } from './cashierUtils';

interface ChargePickerProps {
  feeSchedule: CashierFeeScheduleItem[];
  staged: CashierStagedLine[];
  allowDiscount: boolean;
  blocked: boolean;
  posting: boolean;
  onStagedChange: (lines: CashierStagedLine[]) => void;
  onPostCharges: () => void;
}

export function ChargePicker({
  feeSchedule,
  staged,
  allowDiscount,
  blocked,
  posting,
  onStagedChange,
  onPostCharges,
}: ChargePickerProps) {
  const [pickId, setPickId] = useState('');

  if (feeSchedule.length === 0) {
    return (
      <div className="alert alert-info py-2 mb-3">
        No clinic fee schedule yet. An admin can add fee lines under Clinic Setup → Fees.
      </div>
    );
  }

  const addFee = () => {
    const feeId = Number.parseInt(pickId, 10);
    if (!feeId) return;
    if (staged.some((line) => line.fee_schedule_id === feeId)) return;

    const fee = feeSchedule.find((row) => row.id === feeId);
    if (!fee) return;

    onStagedChange([
      ...staged,
      {
        fee_schedule_id: fee.id,
        code: fee.code,
        name: fee.name,
        units: 1,
        unit_price: fee.price_amount,
        suggested: false,
      },
    ]);
    setPickId('');
  };

  const updateLine = (index: number, patch: Partial<CashierStagedLine>) => {
    onStagedChange(staged.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const removeLine = (index: number) => {
    onStagedChange(staged.filter((_, i) => i !== index));
  };

  return (
    <div className="card mb-3 border-primary">
      <div className="card-body py-3">
        <h6 className="mb-2">Add charges from clinic fee schedule</h6>
        <div className="form-row align-items-end mb-2">
          <div className="form-group col-md-8 mb-2">
            <label className="small mb-1" htmlFor="nc-cashier-fee-pick">Fee line</label>
            <select
              className="form-control form-control-sm"
              id="nc-cashier-fee-pick"
              value={pickId}
              disabled={blocked}
              onChange={(e) => setPickId(e.target.value)}
            >
              <option value="">Choose a fee line…</option>
              {feeSchedule.map((fee) => (
                <option key={fee.id} value={fee.id}>
                  {fee.name} ({fee.code}) — {formatMoney(fee.price_amount)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group col-md-4 mb-2">
            <button
              type="button"
              className="btn btn-outline-primary btn-sm btn-block"
              id="nc-cashier-fee-add"
              disabled={blocked || !pickId}
              onClick={addFee}
            >
              Add to list
            </button>
          </div>
        </div>

        <table className="table table-sm table-bordered mb-2">
          <thead>
            <tr>
              <th>Description</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit price</th>
              <th />
            </tr>
          </thead>
          <tbody id="nc-cashier-staged-body">
            {staged.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-muted">
                  <em>Select fees to post, or use suggested lines.</em>
                </td>
              </tr>
            ) : (
              staged.map((line, index) => (
                <tr key={`${line.fee_schedule_id}-${index}`} data-staged-index={index}>
                  <td>
                    {line.name}
                    {line.suggested && <span className="badge badge-info ml-1">Suggested</span>}
                    <br />
                    <span className="small text-muted"><code>{line.code}</code></span>
                  </td>
                  <td className="text-right" style={{ width: 90 }}>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      step={1}
                      className="form-control form-control-sm nc-staged-units"
                      value={line.units}
                      disabled={blocked}
                      onChange={(e) => updateLine(index, { units: Number.parseInt(e.target.value, 10) || 1 })}
                    />
                  </td>
                  <td className="text-right" style={{ width: 110 }}>
                    {allowDiscount ? (
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className="form-control form-control-sm nc-staged-price"
                        value={line.unit_price}
                        disabled={blocked}
                        onChange={(e) => updateLine(index, { unit_price: Number.parseFloat(e.target.value) || 0 })}
                      />
                    ) : (
                      <span className="d-inline-block py-1">{formatMoney(line.unit_price)}</span>
                    )}
                  </td>
                  <td className="text-right" style={{ width: 40 }}>
                    <button
                      type="button"
                      className="btn btn-link btn-sm text-danger p-0 nc-staged-remove"
                      disabled={blocked}
                      onClick={() => removeLine(index)}
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          id="nc-cashier-post-charges"
          disabled={blocked || posting || staged.length === 0}
          onClick={onPostCharges}
        >
          {posting ? 'Posting…' : 'Post charges to visit'}
        </button>
      </div>
    </div>
  );
}
