import { useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
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
      <div className={deskCalloutClass('info', 'mb-3 text-sm')}>
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
    <div className="nc-cashier-charge-picker mb-3">
      <h3 className="nc-cashier-charge-picker__title">Add charges from clinic fee schedule</h3>
      <div className="nc-cashier-charge-picker__pick-row">
          <div className="space-y-1.5 md:col-span-8">
            <Label className="normal-case font-normal" htmlFor="nc-cashier-fee-pick">Fee line</Label>
            <NativeSelect
              className="h-8"
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
            </NativeSelect>
          </div>
          <div className="md:col-span-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              id="nc-cashier-fee-add"
              disabled={blocked || !pickId}
              onClick={addFee}
            >
              Add to list
            </Button>
          </div>
        </div>

        <Table className={ncShadcnTableClass({ bordered: true, className: 'mb-2' })}>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody id="nc-cashier-staged-body">
            {staged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-[var(--oe-nc-text-muted)]">
                  <em>Select fees to post, or use suggested lines.</em>
                </TableCell>
              </TableRow>
            ) : (
              staged.map((line, index) => (
                <TableRow key={`${line.fee_schedule_id}-${index}`} data-staged-index={index}>
                  <TableCell>
                    {line.name}
                    {line.suggested && <Badge variant="info" className="ml-1">Suggested</Badge>}
                    <br />
                    <span className="text-sm text-[var(--oe-nc-text-muted)]"><code>{line.code}</code></span>
                  </TableCell>
                  <TableCell className="text-right" style={{ width: 90 }}>
                    <Input
                      type="number"
                      className="h-8 nc-staged-units"
                      min={1}
                      max={99}
                      step={1}
                      value={line.units}
                      disabled={blocked}
                      onChange={(e) => updateLine(index, { units: Number.parseInt(e.target.value, 10) || 1 })}
                    />
                  </TableCell>
                  <TableCell className="text-right" style={{ width: 110 }}>
                    {allowDiscount ? (
                      <Input
                        type="number"
                        className="h-8 nc-staged-price"
                        min={0}
                        step={0.01}
                        value={line.unit_price}
                        disabled={blocked}
                        onChange={(e) => updateLine(index, { unit_price: Number.parseFloat(e.target.value) || 0 })}
                      />
                    ) : (
                      <span className="inline-block py-1">{formatMoney(line.unit_price)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right" style={{ width: 40 }}>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="nc-staged-remove h-auto p-0 text-red-600 hover:text-red-700"
                      disabled={blocked}
                      onClick={() => removeLine(index)}
                    >
                      &times;
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <Button
          type="button"
          size="sm"
          id="nc-cashier-post-charges"
          disabled={blocked || posting || staged.length === 0}
          onClick={onPostCharges}
        >
          {posting ? 'Posting…' : 'Post charges to visit'}
        </Button>
    </div>
  );
}
