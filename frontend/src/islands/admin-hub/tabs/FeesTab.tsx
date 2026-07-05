import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
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
}: FeesTabProps) {
  return (
    <>
      <div className={deskCalloutClass('info', 'mb-3')} id="nc-admin-fee-guidelines">
        <strong>How fee lines work</strong>
        <ul className="mb-2 pl-3 text-sm">
          <li>Each line is a shortcut the cashier can post to the patient fee sheet.</li>
          <li>Billing code must already exist in OpenEMR (Administration → Codes) for the selected code type.</li>
          <li>Category groups charges on daily cash reports — pick the closest match.</li>
          <li>Use a starter template when adding common items, then adjust price and codes.</li>
        </ul>
        <Button variant="outline" size="sm" asChild>
          <a
            href={`${webroot}/interface/super/layout_service_codes.php`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open OpenEMR Codes admin
          </a>
        </Button>
      </div>
      <Card>
        <CardContent>
          <div className="flex justify-between items-center mb-3">
            <p className="text-[var(--oe-nc-text-muted)] mb-0">Cash fee schedule for cashier charges and billing codes.</p>
            <Button
              type="button"
              size="sm"
              id="nc-admin-add-fee"
              onClick={onAdd}
            >
              Add fee line
            </Button>
          </div>
          <div id="nc-admin-fee-schedule">
            {!feeSchedule.length ? (
              <div className="text-[var(--oe-nc-text-muted)]"><em>No fee lines configured.</em></div>
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
                  {feeSchedule.map((row) => (
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
          <hr />
          <h6>Import from CSV</h6>
          <p className="text-sm text-[var(--oe-nc-text-muted)] mb-2">
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
        </CardContent>
      </Card>
    </>
  );
}
