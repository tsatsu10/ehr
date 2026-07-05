import type { CashierChargeLine } from '@core/types';
import { deskCalloutClass } from '@components/deskCalloutStyles';
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

interface ChargesTableProps {
  charges: CashierChargeLine[];
  total: number;
}

export function ChargesTable({ charges, total }: ChargesTableProps) {
  if (charges.length === 0) {
    return (
      <div className={deskCalloutClass('warn', 'mb-0 text-sm')}>
        No charges posted yet. Add lines from the clinic fee schedule below.
      </div>
    );
  }

  return (
    <Table className={ncShadcnTableClass({ bordered: true, className: 'mb-0' })}>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {charges.map((line) => (
          <TableRow key={line.id}>
            <TableCell>{line.code}</TableCell>
            <TableCell>{line.description}</TableCell>
            <TableCell className="text-right">{line.units}</TableCell>
            <TableCell className="text-right">{formatMoney(line.amount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableHead colSpan={3} className="text-right">Total</TableHead>
          <TableHead className="text-right">{formatMoney(total)}</TableHead>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
