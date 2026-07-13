import { useEffect, useMemo, useState } from 'react';
import { useModalDismiss } from '@components/useModalDismiss';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Checkbox } from '@components/ui/checkbox';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogContentSizeClass,
} from '@components/ui/dialog';
import { oeFetch } from '@core/oeFetch';
import type { FeeCategoryOption } from '../adminTypes';
import { formatPrice } from '../adminUtils';

/** One row of the dry-run diff. */
export interface BulkPriceChange {
  id: number;
  code: string;
  name: string;
  category_label: string;
  old_price: number;
  new_price: number;
  scope_label: string;
}

interface BulkPricePreview {
  dry_run: true;
  changes: BulkPriceChange[];
  change_count: number;
  total_matched: number;
}

interface BulkPriceModalProps {
  open: boolean;
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  categories: FeeCategoryOption[];
  settings: Record<string, unknown>;
  onClose: () => void;
  /** Called with the refreshed admin payload after a successful apply. */
  onApplied: (changed: number) => void;
  /** Refreshes the fee schedule in the parent after apply. */
  onRefreshSchedule: (feeSchedule: unknown) => void;
}

const MODE_OPTIONS: { value: string; label: string }[] = [
  { value: 'increase_percent', label: 'Increase by percent (%)' },
  { value: 'decrease_percent', label: 'Decrease by percent (%)' },
  { value: 'increase_amount', label: 'Increase by amount' },
  { value: 'decrease_amount', label: 'Decrease by amount' },
  { value: 'set', label: 'Set all to amount' },
];

export function BulkPriceModal({
  open,
  ajaxUrl,
  csrfToken,
  facilityId,
  categories,
  settings,
  onClose,
  onApplied,
  onRefreshSchedule,
}: BulkPriceModalProps) {
  const [mode, setMode] = useState('increase_percent');
  const [value, setValue] = useState('10');
  const [category, setCategory] = useState('');
  const [roundWhole, setRoundWhole] = useState(false);
  const [preview, setPreview] = useState<BulkPricePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalDismiss(open, onClose);

  // Reset everything each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setMode('increase_percent');
    setValue('10');
    setCategory('');
    setRoundWhole(false);
    setPreview(null);
    setBusy(false);
    setError(null);
  }, [open]);

  // The exact form the current preview reflects — apply is only allowed when the
  // live form still matches it, so the admin can never apply an unseen change.
  const formKey = useMemo(
    () => `${mode}|${value}|${category}|${roundWhole ? '1' : '0'}`,
    [mode, value, category, roundWhole],
  );
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  // Any edit to the form invalidates a stale preview.
  useEffect(() => {
    if (previewKey !== null && previewKey !== formKey) {
      setPreview(null);
      setPreviewKey(null);
    }
  }, [formKey, previewKey]);

  const run = async (dryRun: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const bulk = {
        mode,
        value: Number.parseFloat(value) || 0,
        category,
        round_whole: roundWhole,
      };
      if (dryRun) {
        const r = await oeFetch<BulkPricePreview>('admin.fee.bulk_price', {
          ajaxUrl,
          csrfToken,
          json: { bulk, facility_id: facilityId, dry_run: true },
        });
        setPreview(r);
        setPreviewKey(formKey);
      } else {
        const r = await oeFetch<{ fee_schedule?: unknown; bulk_summary?: { changed?: number } }>(
          'admin.fee.bulk_price',
          { ajaxUrl, csrfToken, json: { bulk, facility_id: facilityId, dry_run: false } },
        );
        if (r.fee_schedule !== undefined) onRefreshSchedule(r.fee_schedule);
        onApplied(r.bulk_summary?.changed ?? 0);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk price update failed');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const canApply = preview !== null && previewKey === formKey && preview.change_count > 0 && !busy;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        id="nc-admin-bulk-price-modal"
        className={dialogContentSizeClass.lg}
        aria-labelledby="nc-admin-bulk-price-title"
      >
        <DialogHeader>
          <DialogTitle id="nc-admin-bulk-price-title">Bulk price update</DialogTitle>
          <DialogClose id="nc-admin-bulk-price-close" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>
        <DialogBody>
          <p className="mb-3 text-sm text-[var(--oe-nc-text-muted)]">
            Adjust prices across active fee lines at once. Preview the exact changes before applying.
          </p>
          <div className="grid grid-cols-12 gap-3">
            <div className="nc-form-group col-span-12 md:col-span-5 space-y-1.5">
              <Label htmlFor="nc-admin-bulk-mode">Change</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger id="nc-admin-bulk-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODE_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="nc-form-group col-span-12 md:col-span-3 space-y-1.5">
              <Label htmlFor="nc-admin-bulk-value">
                {mode.endsWith('percent') ? 'Percent' : 'Amount'}
              </Label>
              <Input
                type="number"
                min={0}
                step={mode.endsWith('percent') ? 1 : 0.01}
                id="nc-admin-bulk-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="nc-form-group col-span-12 md:col-span-4 space-y-1.5">
              <Label htmlFor="nc-admin-bulk-category">Only category</Label>
              <Select value={category || '_all'} onValueChange={(v) => setCategory(v === '_all' ? '' : v)}>
                <SelectTrigger id="nc-admin-bulk-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm" htmlFor="nc-admin-bulk-round">
            <Checkbox
              id="nc-admin-bulk-round"
              checked={roundWhole}
              onCheckedChange={(c) => setRoundWhole(c === true)}
            />
            Round results to whole numbers
          </label>

          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              id="nc-admin-bulk-preview"
              disabled={busy}
              onClick={() => { void run(true); }}
            >
              {busy && preview === null ? 'Calculating…' : 'Preview changes'}
            </Button>
          </div>

          {preview && previewKey === formKey && (
            <div className="mt-3" id="nc-admin-bulk-preview-result">
              {preview.change_count === 0 ? (
                <div className={deskCalloutClass('info', 'text-sm')} role="status">
                  No active fee lines would change with these settings
                  {preview.total_matched > 0 ? ` (${preview.total_matched} matched, none differ).` : '.'}
                </div>
              ) : (
                <>
                  <p className="mb-1 text-sm font-semibold">
                    {preview.change_count} of {preview.total_matched} fee line
                    {preview.total_matched === 1 ? '' : 's'} will change:
                  </p>
                  <div className="overflow-x-auto">
                    <Table className={ncShadcnTableClass({ bordered: true, className: 'mb-0' })}>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Now</TableHead>
                          <TableHead>New</TableHead>
                          <TableHead>Scope</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.changes.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell><code>{c.code}</code></TableCell>
                            <TableCell>{c.name}</TableCell>
                            <TableCell className="text-[var(--oe-nc-text-muted)]">
                              {formatPrice(c.old_price, settings)}
                            </TableCell>
                            <TableCell className="font-semibold">{formatPrice(c.new_price, settings)}</TableCell>
                            <TableCell className="text-sm">{c.scope_label}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          )}

          {error && (
            <div className={deskCalloutClass('error', 'mt-2 text-sm')} id="nc-admin-bulk-error" role="alert">
              {error}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" id="nc-admin-bulk-cancel" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            id="nc-admin-bulk-apply"
            disabled={!canApply}
            onClick={() => { void run(false); }}
          >
            {busy && preview !== null
              ? 'Applying…'
              : preview && preview.change_count > 0
                ? `Apply to ${preview.change_count} fee${preview.change_count === 1 ? '' : 's'}`
                : 'Preview first'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
