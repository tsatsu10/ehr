import type { PharmacyPrescriptionLine } from '@core/types';
import { stockBadgeClass, stockLabel } from '../pharm-ops/pharmOpsStockUtils';

interface PharmacyPrescriptionsTableProps {
  prescriptions: PharmacyPrescriptionLine[];
  showStockBadges?: boolean;
  canDispense?: boolean;
  canPrintRx?: boolean;
  dispenseBlocked?: boolean;
  onDispense?: (prescriptionId: number) => void;
  onPrintRx?: (prescriptionId: number) => void;
}

function statusBadgeClass(status: string): string {
  return status === 'dispensed' ? 'badge-success' : 'badge-warning';
}

function statusLabel(status: string): string {
  return status === 'dispensed' ? 'dispensed' : 'to dispense';
}

export function PharmacyPrescriptionsTable({
  prescriptions,
  showStockBadges = false,
  canDispense = false,
  canPrintRx = false,
  dispenseBlocked = false,
  onDispense,
  onPrintRx,
}: PharmacyPrescriptionsTableProps) {
  if (!prescriptions.length) {
    return (
      <div className="alert alert-info py-2 mb-0">
        No prescriptions on this encounter yet. Doctor creates Rx in core.
      </div>
    );
  }

  return (
    <table className="table table-sm table-bordered mb-0">
      <thead>
        <tr>
          <th>Medication</th>
          <th>Sig</th>
          <th>Qty</th>
          {showStockBadges ? <th>Stock</th> : null}
          <th>Status</th>
          {canDispense || canPrintRx ? <th aria-label="Actions" /> : null}
        </tr>
      </thead>
      <tbody>
        {prescriptions.map((line) => {
          const stock = stockLabel(line.stock_status);
          const canDispenseLine = canDispense
            && line.status === 'to_dispense'
            && !dispenseBlocked;

          return (
            <tr key={line.id}>
              <td>{line.drug}</td>
              <td>{line.sig}</td>
              <td>{line.quantity}</td>
              {showStockBadges ? (
                <td>
                  {stock ? (
                    <span className={`badge ${stockBadgeClass(line.stock_status)}`}>
                      {stock}
                    </span>
                  ) : (
                    <span className="text-muted small">—</span>
                  )}
                  {line.qoh_display ? (
                    <div className="small text-muted">{line.qoh_display}</div>
                  ) : null}
                </td>
              ) : null}
              <td>
                <span className={`badge ${statusBadgeClass(line.status)}`}>
                  {statusLabel(line.status)}
                </span>
              </td>
              {canDispense || canPrintRx ? (
                <td className="text-nowrap">
                  {canPrintRx && onPrintRx ? (
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm mr-1"
                      aria-label={`Print Rx for ${line.drug}`}
                      onClick={() => onPrintRx(line.id)}
                    >
                      Print Rx
                    </button>
                  ) : null}
                  {canDispenseLine && onDispense ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      aria-label={`Dispense ${line.drug}`}
                      onClick={() => onDispense(line.id)}
                    >
                      Dispense
                    </button>
                  ) : null}
                </td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
