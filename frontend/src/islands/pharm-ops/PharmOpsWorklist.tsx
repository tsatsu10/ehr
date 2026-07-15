import { Button } from '@components/ui/button';
import type { PharmOpsTab, PharmOpsWorklistRow } from './pharmOpsTypes';
import { isDispenseRow, isLowStockRow, isWriteOffRow } from './pharmOpsTypes';
import { stockLabel } from './pharmOpsStockUtils';

interface PharmOpsWorklistProps {
  tab: PharmOpsTab;
  rows: PharmOpsWorklistRow[];
  loading: boolean;
  worklistDate: string;
  expiryWarnDays?: number;
  canDispense: boolean;
  canReceive?: boolean;
  canDestroy?: boolean;
  canPrintRx?: boolean;
  onDispense: (prescriptionId: number) => void;
  onReceive?: (drugId: number, drugName: string) => void;
  onDestroy?: (drugId: number, inventoryId: number, drugName: string, lotNumber: string) => void;
  onPrintRx?: (prescriptionId: number) => void;
}

function emptyMessage(tab: PharmOpsTab, worklistDate: string, expiryWarnDays?: number): string {
  if (tab === 'low_stock') {
    return 'No drugs are at or below their reorder point. Set reorder points on drug products to enable low-stock alerts.';
  }
  if (tab === 'write_off') {
    const days = expiryWarnDays ?? 90;
    return `No lots are expired or expiring within ${days} days. Lots listed here can be written off with witness and method fields.`;
  }
  return `No undispensed prescriptions for ${worklistDate}. `
    + 'Prescriptions appear here when a patient has a visit today with active Rx that is not fully dispensed.';
}

export function PharmOpsWorklist({
  tab,
  rows,
  loading,
  worklistDate,
  canDispense,
  canReceive = false,
  canDestroy = false,
  canPrintRx = false,
  expiryWarnDays,
  onDispense,
  onReceive,
  onDestroy,
  onPrintRx,
}: PharmOpsWorklistProps) {
  if (loading) {
    return (
      <div id="nc-pharmops-list" className="nc-pharmops-list" role="status" aria-live="polite">
        <div className="nc-pharmops-empty nc-pharmops-empty--loading">Loading worklist…</div>
      </div>
    );
  }

  if (!rows.length) {
    const title = tab === 'low_stock'
      ? 'No low-stock alerts'
      : tab === 'write_off'
        ? 'No lots to write off'
        : 'Nothing to dispense';
    return (
      <div id="nc-pharmops-list" className="nc-pharmops-list" role="list" aria-label="Pharmacy worklist">
        <div className="nc-pharmops-empty-card">
          <p className="nc-pharmops-empty-card-title">{title}</p>
          <p className="nc-pharmops-empty-card-body mb-0">{emptyMessage(tab, worklistDate, expiryWarnDays)}</p>
        </div>
      </div>
    );
  }

  if (tab === 'write_off') {
    return (
      <div id="nc-pharmops-list" className="nc-pharmops-list" role="list" aria-label="Write-off lots">
        {rows.filter(isWriteOffRow).map((row) => {
          const urgent = row.lot_status === 'expired';

          return (
            <article
              key={row.inventory_id}
              className={`nc-pharmops-row${urgent ? ' nc-pharmops-row--urgent' : ''}`}
              role="listitem"
            >
              <div className="nc-pharmops-row-title">{row.drug_name}</div>
              <div className="nc-pharmops-row-meta">
                Lot {row.lot_number || '—'}
                {row.warehouse ? ` · ${row.warehouse}` : ''}
              </div>
              <div className="nc-pharmops-row-meta">
                {row.status_label}
                {row.qoh_display ? ` · ${row.qoh_display}` : ''}
              </div>
              <div className="nc-pharmops-row-actions">
                {canDestroy && onDestroy ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                    onClick={() => onDestroy(row.drug_id, row.inventory_id, row.drug_name, row.lot_number)}
                  >
                    Write off lot
                  </Button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  if (tab === 'low_stock') {
    return (
      <div id="nc-pharmops-list" className="nc-pharmops-list" role="list" aria-label="Low stock worklist">
        {rows.filter(isLowStockRow).map((row) => {
          const stock = stockLabel(row.stock_status);
          const urgent = row.stock_status === 'out_of_stock';

          return (
            <article
              key={row.drug_id}
              className={`nc-pharmops-row${urgent ? ' nc-pharmops-row--urgent' : ''}`}
              role="listitem"
            >
              <div className="nc-pharmops-row-title">{row.drug_name}</div>
              <div className="nc-pharmops-row-meta">
                {row.status_label}
                {stock ? ` · ${stock}` : ''}
                {row.qoh_display ? ` · ${row.qoh_display}` : ''}
              </div>
              <div className="nc-pharmops-row-actions">
                {canReceive && onReceive ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onReceive(row.drug_id, row.drug_name)}
                  >
                    Receive stock
                  </Button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <div id="nc-pharmops-list" className="nc-pharmops-list" role="list" aria-label="Pharmacy worklist">
      {rows.filter(isDispenseRow).map((row) => {
        const qLabel = row.queue_number ? `Q#${row.queue_number} ` : '';
        const stock = stockLabel(row.stock_status);

        return (
          <article
            key={row.prescription_id}
            className={`nc-pharmops-row${row.is_urgent ? ' nc-pharmops-row--urgent' : ''}`}
            role="listitem"
          >
            <div className="nc-pharmops-row-title">
              {qLabel}{row.patient_label}
              {row.mrn ? (
                <span className="text-[var(--oe-nc-text-muted)] font-normal"> · {row.mrn}</span>
              ) : null}
            </div>
            <div className="nc-pharmops-row-meta">{row.drug_name}</div>
            <div className="nc-pharmops-row-meta">
              {row.status_label}
              {row.ordered_display ? ` · ${row.ordered_display}` : ''}
              {stock ? ` · ${stock}` : ''}
            </div>
            <div className="nc-pharmops-row-actions">
              {row.can_open_pharmacy_desk && row.pharmacy_desk_url ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={row.pharmacy_desk_url} target="_top">
                    Open in Pharmacy Desk
                  </a>
                </Button>
              ) : null}
              {row.patient_chart_url ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={row.patient_chart_url} target="_blank" rel="noreferrer">
                    Open chart
                  </a>
                </Button>
              ) : null}
              {canPrintRx && onPrintRx ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onPrintRx(row.prescription_id)}
                >
                  Print Rx
                </Button>
              ) : null}
              {canDispense ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onDispense(row.prescription_id)}
                >
                  Dispense
                </Button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
