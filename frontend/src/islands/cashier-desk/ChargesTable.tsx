import type { CashierChargeLine } from '@core/types';
import { formatMoney } from './cashierUtils';

interface ChargesTableProps {
  charges: CashierChargeLine[];
  total: number;
}

export function ChargesTable({ charges, total }: ChargesTableProps) {
  if (charges.length === 0) {
    return (
      <div className="alert alert-warning mb-0">
        No charges posted yet. Add lines from the clinic fee schedule below.
      </div>
    );
  }

  return (
    <table className="table table-sm table-bordered mb-0">
      <thead>
        <tr>
          <th>Code</th>
          <th>Description</th>
          <th className="text-right">Qty</th>
          <th className="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        {charges.map((line) => (
          <tr key={line.id}>
            <td>{line.code}</td>
            <td>{line.description}</td>
            <td className="text-right">{line.units}</td>
            <td className="text-right">{formatMoney(line.amount)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th colSpan={3} className="text-right">Total</th>
          <th className="text-right">{formatMoney(total)}</th>
        </tr>
      </tfoot>
    </table>
  );
}
