import type { LabOrderLine } from '@core/types';
import { orderStatusBadgeClass } from './labUtils';

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
      <div className="alert alert-info py-2 mb-0">
        No lab orders on this encounter yet. Doctor creates orders in core.
      </div>
    );
  }

  return (
    <table className="table table-sm table-bordered mb-0">
      <thead>
        <tr>
          <th>Test</th>
          <th>Code</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((line) => (
          <tr key={line.id || line.code}>
            <td>
              {line.title}
              {line.fulfillment_label && (
                <span className="badge badge-light border ml-1">{line.fulfillment_label}</span>
              )}
              {labOpsEnabled && line.id > 0 && inLab && onEnterResults && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 ml-1 nc-lab-enter-results"
                    onClick={() => onEnterResults(line.id)}
                  >
                    Enter results
                  </button>
                </>
              )}
              {line.requisition_url && (
                <>
                  {' '}
                  <a
                    className="btn btn-link btn-sm p-0 ml-1"
                    href={line.requisition_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Print req
                  </a>
                </>
              )}
            </td>
            <td>{line.code}</td>
            <td>
              <span className={`badge ${orderStatusBadgeClass(line.status)}`}>{line.status}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
