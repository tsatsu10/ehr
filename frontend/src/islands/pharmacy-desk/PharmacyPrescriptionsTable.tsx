import type { PharmacyPrescriptionLine } from '@core/types';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import { stockBadgeVariant, stockLabel } from '../pharm-ops/pharmOpsStockUtils';

interface PharmacyPrescriptionsTableProps {
  prescriptions: PharmacyPrescriptionLine[];
  showStockBadges?: boolean;
  canDispense?: boolean;
  canPrintRx?: boolean;
  dispenseBlocked?: boolean;
  onDispense?: (prescriptionId: number) => void;
  onPrintRx?: (prescriptionId: number) => void;
  /** Present + defined only when the desk is ready to open Add Rx right now. */
  onAddRx?: () => void;
}

function rxStatusBadgeVariant(status: string): 'success' | 'warning' {
  return status === 'dispensed' ? 'success' : 'warning';
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
  onAddRx,
}: PharmacyPrescriptionsTableProps) {
  if (!prescriptions.length) {
    return (
      <div className={deskCalloutClass('info', 'py-2 mb-0 flex flex-wrap items-center justify-between gap-2')}>
        <span>No prescriptions on this encounter yet.</span>
        {onAddRx ? (
          <Button type="button" size="sm" onClick={onAddRx}>
            Add Rx
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <Table className={ncShadcnTableClass({ bordered: true, className: 'mb-0' })}>
      <TableHeader>
        <TableRow>
          <TableHead>Medication</TableHead>
          <TableHead>Sig</TableHead>
          <TableHead>Qty</TableHead>
          {showStockBadges ? <TableHead>Stock</TableHead> : null}
          <TableHead>Status</TableHead>
          {canDispense || canPrintRx ? <TableHead aria-label="Actions" /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {prescriptions.map((line) => {
          const stock = stockLabel(line.stock_status);
          const canDispenseLine = canDispense
            && line.status === 'to_dispense'
            && !dispenseBlocked;

          return (
            <TableRow key={line.id}>
              <TableCell>{line.drug}</TableCell>
              <TableCell>{line.sig}</TableCell>
              <TableCell>{line.quantity}</TableCell>
              {showStockBadges ? (
                <TableCell>
                  {stock ? (
                    <Badge variant={stockBadgeVariant(line.stock_status)}>
                      {stock}
                    </Badge>
                  ) : (
                    <span className="text-[var(--oe-nc-text-muted)] text-sm">—</span>
                  )}
                  {line.qoh_display ? (
                    <div className="text-sm text-[var(--oe-nc-text-muted)]">{line.qoh_display}</div>
                  ) : null}
                </TableCell>
              ) : null}
              <TableCell>
                <Badge variant={rxStatusBadgeVariant(line.status)}>
                  {statusLabel(line.status)}
                </Badge>
              </TableCell>
              {canDispense || canPrintRx ? (
                <TableCell className="text-nowrap">
                  {canPrintRx && onPrintRx ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mr-1"
                      aria-label={`Print Rx for ${line.drug}`}
                      onClick={() => onPrintRx(line.id)}
                    >
                      Print Rx
                    </Button>
                  ) : null}
                  {canDispenseLine && onDispense ? (
                    <Button
                      type="button"
                      size="sm"
                      aria-label={`Dispense ${line.drug}`}
                      onClick={() => onDispense(line.id)}
                    >
                      Dispense
                    </Button>
                  ) : null}
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
