import type { LabOrderLine } from '@core/types';
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
import { orderStatusBadgeVariant } from './labUtils';

interface LabOrdersTableProps {
  orders: LabOrderLine[];
  labOpsEnabled?: boolean;
  inLab: boolean;
  onEnterResults?: (orderId: number) => void;
}

export function LabOrdersTable({
  orders,
  labOpsEnabled = false,
  inLab,
  onEnterResults,
}: LabOrdersTableProps) {
  if (orders.length === 0) {
    return (
      <div className={deskCalloutClass('info', 'py-2 mb-0')}>
        No lab orders on this encounter yet. Doctor creates orders in core.
      </div>
    );
  }

  return (
    <Table className={ncShadcnTableClass({ bordered: true, className: 'mb-0' })}>
      <TableHeader>
        <TableRow>
          <TableHead>Test</TableHead>
          <TableHead>Code</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((line) => (
          <TableRow key={line.id || line.code}>
            <TableCell>
              {line.title}
              {line.fulfillment_label && (
                <Badge variant="outline" className="ml-1 align-middle">
                  {line.fulfillment_label}
                </Badge>
              )}
              {labOpsEnabled && line.id > 0 && inLab && onEnterResults && (
                <>
                  {' '}
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="nc-lab-enter-results ml-1 h-auto p-0 align-baseline"
                    onClick={() => onEnterResults(line.id)}
                  >
                    Enter results
                  </Button>
                </>
              )}
              {line.requisition_url && (
                <>
                  {' '}
                  <Button variant="link" size="sm" className="ml-1 h-auto p-0 align-baseline" asChild>
                    <a
                      href={line.requisition_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Print req
                    </a>
                  </Button>
                </>
              )}
            </TableCell>
            <TableCell>{line.code}</TableCell>
            <TableCell>
              <Badge variant={orderStatusBadgeVariant(line.status)}>{line.status}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
