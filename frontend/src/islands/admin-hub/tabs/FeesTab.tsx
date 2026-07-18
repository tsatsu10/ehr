import { useMemo, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Button } from '@components/ui/button';
import { Checkbox } from '@components/ui/checkbox';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Receipt } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import { Textarea } from '@components/ui/textarea';
import type { FeeScheduleRow } from '../adminTypes';
import { formatPrice } from '../adminUtils';
import { AdminEmptyState, AdminSection, AdminStack } from '../adminUi';

interface FeesTabProps {
  feeSchedule: FeeScheduleRow[];
  settings: Record<string, unknown>;
  webroot: string;
  csv: string;
  importing: boolean;
  onCsvChange: (value: string) => void;
  onAdd: () => void;
  onEdit: (row: FeeScheduleRow) => void;
  onArchive: (row: FeeScheduleRow) => void;
  onImport: () => void;
  onBulkPrice: () => void;
}

export function FeesTab({
  feeSchedule,
  settings,
  webroot,
  csv,
  importing,
  onCsvChange,
  onAdd,
  onEdit,
  onArchive,
  onImport,
  onBulkPrice,
}: FeesTabProps) {
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(true);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return feeSchedule.filter((row) => {
      if (!showArchived && !row.is_active) {
        return false;
      }
      if (needle === '') {
        return true;
      }
      return row.code.toLowerCase().includes(needle)
        || row.name.toLowerCase().includes(needle)
        || (row.category_label ?? row.category ?? '').toLowerCase().includes(needle);
    });
  }, [feeSchedule, query, showArchived]);

  return (
    <AdminStack>
      <div className={deskCalloutClass('info')} id="nc-admin-fee-guidelines">
        <strong>How fee lines work</strong>
        <ul className="mb-2 pl-3 text-sm">
          <li>Each line is a shortcut the cashier can post to the patient fee sheet.</li>
          <li>Billing code must already exist in OpenEMR (Administration → Codes) for the selected code type.</li>
          <li>Category groups charges on daily cash reports — pick the closest match.</li>
          <li>Use a starter template when adding common items, then adjust price and codes.</li>
        </ul>
        <Button variant="outline" size="sm" asChild>
          <a
            href={`${webroot}/interface/patient_file/encounter/superbill_custom_full.php`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open OpenEMR Codes admin
          </a>
        </Button>
      </div>
      <AdminSection
        title="Fee schedule"
        description="Cash fee schedule for cashier charges and billing codes."
        icon={<Receipt className="h-4 w-4" aria-hidden />}
        action={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              id="nc-admin-bulk-price"
              disabled={!feeSchedule.some((r) => r.is_active)}
              onClick={onBulkPrice}
            >
              Bulk price update
            </Button>
            <Button
              type="button"
              size="sm"
              id="nc-admin-add-fee"
              onClick={onAdd}
            >
              Add fee line
            </Button>
          </div>
        }
      >
        <div id="nc-admin-fee-schedule">
          {feeSchedule.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <Input
                type="search"
                className="h-8"
                style={{ maxWidth: '16rem' }}
                placeholder="Search fee lines…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search fee lines"
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="nc-admin-fee-show-archived"
                  checked={showArchived}
                  onCheckedChange={(checked) => setShowArchived(checked === true)}
                />
                <Label htmlFor="nc-admin-fee-show-archived" className="font-normal normal-case cursor-pointer mb-0">
                  Show archived
                </Label>
              </div>
              <span className="text-sm text-[var(--oe-nc-text-muted)]">
                {filtered.length} of {feeSchedule.length} fee line{feeSchedule.length === 1 ? '' : 's'}
              </span>
            </div>
          )}
          {!feeSchedule.length ? (
            <AdminEmptyState title="No fee lines configured" />
          ) : filtered.length === 0 ? (
            <AdminEmptyState
              title="No fee lines match this filter"
              description="Try a different search, or turn on Show archived."
            />
          ) : (
              <Table className={ncShadcnTableClass({ bordered: true, className: 'mb-0' })}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id} className={row.is_active ? '' : 'text-[var(--oe-nc-text-muted)]'}>
                      <TableCell><code>{row.code}</code></TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.category_label || row.category || '—'}</TableCell>
                      <TableCell>{formatPrice(row.price_amount, settings)}</TableCell>
                      <TableCell className="text-sm">{row.code_type} · {row.billing_code}</TableCell>
                      <TableCell className="text-sm">{row.scope_label ?? ''}</TableCell>
                      <TableCell>
                        {row.is_active
                          ? 'Active'
                          : <span className="text-[var(--oe-nc-text-muted)]">Archived</span>}
                      </TableCell>
                      <TableCell className="text-nowrap">
                        {row.is_active && (
                          <>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="h-auto p-0 mr-2 nc-admin-edit-fee"
                              onClick={() => onEdit(row)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-destructive nc-admin-archive-fee"
                              onClick={() => onArchive(row)}
                            >
                              Archive
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <hr className="my-4 border-[var(--oe-nc-border)]" />
          <h6 className="mb-2 text-sm font-semibold">Import from CSV</h6>
          <p className="mb-2 text-sm text-[var(--oe-nc-text-muted)]">
            Columns: code, name, category, price_amount, code_type, billing_code, sort_order (optional).
          </p>
          <Textarea
            className="mb-2 text-sm"
            id="nc-admin-fee-csv"
            rows={4}
            placeholder="OPD_CONSULT,OPD consultation,consult,50,CPT4,OPD_CONSULT,10"
            value={csv}
            onChange={(e) => onCsvChange(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            id="nc-admin-fee-import"
            disabled={importing}
            onClick={onImport}
          >
            {importing ? 'Importing…' : 'Import CSV'}
          </Button>
      </AdminSection>
    </AdminStack>
  );
}
