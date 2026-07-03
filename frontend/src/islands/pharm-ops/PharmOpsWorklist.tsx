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
      <div id="nc-pharmops-list" className="oe-nc-pharmops-list" role="status" aria-live="polite">
        <div className="oe-nc-pharmops-empty oe-nc-pharmops-empty--loading">Loading worklist…</div>
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
      <div id="nc-pharmops-list" className="oe-nc-pharmops-list" role="list" aria-label="Pharmacy worklist">
        <div className="oe-nc-pharmops-empty-card">
          <p className="oe-nc-pharmops-empty-card__title">{title}</p>
          <p className="oe-nc-pharmops-empty-card__body mb-0">{emptyMessage(tab, worklistDate, expiryWarnDays)}</p>
        </div>
      </div>
    );
  }

  if (tab === 'write_off') {
    return (
      <div id="nc-pharmops-list" className="oe-nc-pharmops-list" role="list" aria-label="Write-off lots">
        {rows.filter(isWriteOffRow).map((row) => {
          const urgent = row.lot_status === 'expired';

          return (
            <article
              key={row.inventory_id}
              className={`oe-nc-pharmops-row${urgent ? ' oe-nc-pharmops-row--urgent' : ''}`}
              role="listitem"
            >
              <div className="oe-nc-pharmops-row__title">{row.drug_name}</div>
              <div className="oe-nc-pharmops-row__meta">
                Lot {row.lot_number || '—'}
                {row.warehouse ? ` · ${row.warehouse}` : ''}
              </div>
              <div className="oe-nc-pharmops-row__meta">
                {row.status_label}
                {row.qoh_display ? ` · ${row.qoh_display}` : ''}
              </div>
              <div className="oe-nc-pharmops-row__actions">
                {canDestroy && onDestroy ? (
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => onDestroy(row.drug_id, row.inventory_id, row.drug_name, row.lot_number)}
                  >
                    Write off lot
                  </button>
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
      <div id="nc-pharmops-list" className="oe-nc-pharmops-list" role="list" aria-label="Low stock worklist">
        {rows.filter(isLowStockRow).map((row) => {
          const stock = stockLabel(row.stock_status);
          const urgent = row.stock_status === 'out_of_stock';

          return (
            <article
              key={row.drug_id}
              className={`oe-nc-pharmops-row${urgent ? ' oe-nc-pharmops-row--urgent' : ''}`}
              role="listitem"
            >
              <div className="oe-nc-pharmops-row__title">{row.drug_name}</div>
              <div className="oe-nc-pharmops-row__meta">
                {row.status_label}
                {stock ? ` · ${stock}` : ''}
                {row.qoh_display ? ` · ${row.qoh_display}` : ''}
              </div>
              <div className="oe-nc-pharmops-row__actions">
                {canReceive && onReceive ? (
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => onReceive(row.drug_id, row.drug_name)}
                  >
                    Receive stock
                  </button>
                ) : row.receive_stock_url ? (
                  <a
                    className="btn btn-outline-secondary btn-sm"
                    href={row.receive_stock_url}
                    target="_top"
                  >
                    Receive stock
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <div id="nc-pharmops-list" className="oe-nc-pharmops-list" role="list" aria-label="Pharmacy worklist">
      {rows.filter(isDispenseRow).map((row) => {
        const qLabel = row.queue_number ? `Q#${row.queue_number} ` : '';
        const stock = stockLabel(row.stock_status);

        return (
          <article
            key={row.prescription_id}
            className={`oe-nc-pharmops-row${row.is_urgent ? ' oe-nc-pharmops-row--urgent' : ''}`}
            role="listitem"
          >
            <div className="oe-nc-pharmops-row__title">
              {qLabel}{row.patient_label}
              {row.mrn ? (
                <span className="text-muted font-weight-normal"> · {row.mrn}</span>
              ) : null}
            </div>
            <div className="oe-nc-pharmops-row__meta">{row.drug_name}</div>
            <div className="oe-nc-pharmops-row__meta">
              {row.status_label}
              {row.ordered_display ? ` · ${row.ordered_display}` : ''}
              {stock ? ` · ${stock}` : ''}
            </div>
            <div className="oe-nc-pharmops-row__actions">
              {row.can_open_pharmacy_desk && row.pharmacy_desk_url ? (
                <a className="btn btn-outline-secondary btn-sm" href={row.pharmacy_desk_url} target="_top">
                  Open in Pharmacy Desk
                </a>
              ) : null}
              {row.patient_chart_url ? (
                <a
                  className="btn btn-outline-secondary btn-sm"
                  href={row.patient_chart_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open chart
                </a>
              ) : null}
              {canPrintRx && onPrintRx ? (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => onPrintRx(row.prescription_id)}
                >
                  Print Rx
                </button>
              ) : null}
              {canDispense ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => onDispense(row.prescription_id)}
                >
                  Dispense
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
