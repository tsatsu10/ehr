import { useCallback, useEffect, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { identityFromLabels } from '@components/patientBannerUtils';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Checkbox } from '@components/ui/checkbox';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';
import { oeFetch } from '@core/oeFetch';
import type { ChargeLine, FeeScheduleItem, VisitChargesData } from './billOpsTypes';
import { formatBillMoney } from './billOpsFormatters';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';

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

function BillOpsVisitBanner({
  visit,
  balanceDue,
  paidTotal,
}: {
  visit: VisitChargesData['visit'];
  balanceDue: number;
  paidTotal: number;
}) {
  const patientIdentity = identityFromLabels(visit.patient_name, { pubpid: visit.pubpid });
  const balanceLine = (
    <div className="text-sm text-[var(--oe-nc-text-muted)] mt-1">
      Due {formatBillMoney(balanceDue)} (paid {formatBillMoney(paidTotal)})
    </div>
  );

  if (!patientIdentity) {
    return (
      <div className="mb-3 text-sm text-[var(--oe-nc-text-muted)]">
        Visit #{visit.queue_number} · {visit.state}
        {' · '}
        Due {formatBillMoney(balanceDue)} (paid {formatBillMoney(paidTotal)})
      </div>
    );
  }

  return (
    <PatientContextBanner
      layout="compact"
      identity={patientIdentity}
      aside={(
        <>
          <Badge variant="outline">Q#{visit.queue_number}</Badge>
          <Badge variant="neutral">{visit.state}</Badge>
        </>
      )}
    >
      {balanceLine}
    </PatientContextBanner>
  );
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
      const updated = await oeFetch<VisitChargesData & { visit_id?: number }>('bill_ops.charge_correct', {
        ...fetchOptions,
        method: 'POST',
        json: {
          visit_id: data.visit.id,
          add,
          remove: removeIds,
          reason: reason.trim(),
        },
      });
      await loadVisit(updated.visit_id ?? data.visit.id);
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

  return (
    <div className="nc-billops-correction-form">
      {showVisitLookup && (
        <div className="flex flex-wrap items-center gap-2 mb-3 flex-wrap">
          <label className="sr-only" htmlFor="nc-billops-visit-id">Visit id</label>
          <Input
            id="nc-billops-visit-id"
            type="number"
            className="h-8 w-auto mr-2 mb-1"
            placeholder="Visit id"
            value={visitIdInput}
            onChange={(e) => setVisitIdInput(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            className="mb-1"
            onClick={() => void loadVisit(Number(visitIdInput))}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Load visit'}
          </Button>
        </div>
      )}

      {error && <div className={deskCalloutClass('warn', 'py-2')}>{error}</div>}

      {data && (
        <>
          <BillOpsVisitBanner
            visit={data.visit}
            balanceDue={data.balance_due}
            paidTotal={data.paid_total}
          />

          {data.reopen_on_underpaid && (
            <p className={deskCalloutClass('info', 'py-2 text-sm mb-3')}>
              When a correction leaves the visit underpaid, it may return to the payment queue automatically.
            </p>
          )}

          <h3 className="text-sm font-semibold">Existing charges</h3>
          <Table className={ncShadcnTableClass({ hover: true, className: 'mb-3' })}>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Remove</TableHead>
                <TableHead scope="col">Description</TableHead>
                <TableHead scope="col" className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.charges.map((line: ChargeLine) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <Checkbox
                      checked={removeIds.includes(line.id)}
                      onCheckedChange={() => toggleRemove(line.id)}
                      aria-label={`Remove ${line.description}`}
                    />
                  </TableCell>
                  <TableCell>{line.description}</TableCell>
                  <TableCell className="text-right">{formatBillMoney(line.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <h3 className="text-sm font-semibold">Add line</h3>
          <div className="grid grid-cols-12 gap-3 mb-3">
            <div className="col-span-12 md:col-span-6 mb-2">
              <NativeSelect
                className="h-8"
                value={selectedFeeId}
                onChange={(e) => setSelectedFeeId(e.target.value)}
              >
                <option value="">Fee schedule…</option>
                {data.fee_schedule.map((fee: FeeScheduleItem) => (
                  <option key={fee.id} value={fee.id}>
                    {fee.name} — {formatBillMoney(fee.price_amount)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="col-span-12 md:col-span-2 mb-2">
              <Input
                type="number"
                className="h-8"
                min={1}
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                aria-label="Quantity"
              />
            </div>
          </div>

          <div className="space-y-1.5 mb-3">
            <Label htmlFor="nc-billops-correction-reason">Reason (required)</Label>
            <Input
              id="nc-billops-correction-reason"
              type="text"
              className="h-8"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => void saveCorrection()}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save correction'}
          </Button>
        </>
      )}
    </div>
  );
}
