import type { CashierDrugChargeLine } from '@core/types';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import { formatMoney } from './cashierUtils';

interface DrugChargesTableProps {
  lines: CashierDrugChargeLine[];
  total: number;
}

/** CBILL-1 — dispensed medicines pulled onto the cashier bill from drug_sales. */
export function DrugChargesTable({ lines, total }: DrugChargesTableProps) {
  return (
    <Table className={ncShadcnTableClass({ bordered: true, className: 'mb-0' })}>
      <TableHeader>
        <TableRow>
          <TableHead>Medicine</TableHead>
          <TableHead className="nc-cashier-cell-num">Qty</TableHead>
          <TableHead className="nc-cashier-cell-num">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line) => (
          <TableRow key={line.sale_id}>
            <TableCell>{line.description}</TableCell>
            <TableCell className="nc-cashier-cell-num">{line.quantity}</TableCell>
            <TableCell className="nc-cashier-cell-num">{formatMoney(line.amount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableHead colSpan={2} className="nc-cashier-cell-num">Medicines subtotal</TableHead>
          <TableHead className="nc-cashier-cell-num">{formatMoney(total)}</TableHead>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
