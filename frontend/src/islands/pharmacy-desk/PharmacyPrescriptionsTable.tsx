import type { PharmacyPrescriptionLine } from '@core/types';

interface PharmacyPrescriptionsTableProps {
  prescriptions: PharmacyPrescriptionLine[];
}

function statusBadgeClass(status: string): string {
  return status === 'dispensed' ? 'badge-success' : 'badge-warning';
}

function statusLabel(status: string): string {
  return status === 'dispensed' ? 'dispensed' : 'to dispense';
}

export function PharmacyPrescriptionsTable({ prescriptions }: PharmacyPrescriptionsTableProps) {
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
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {prescriptions.map((line) => (
          <tr key={line.id}>
            <td>{line.drug}</td>
            <td>{line.sig}</td>
            <td>{line.quantity}</td>
            <td>
              <span className={`badge ${statusBadgeClass(line.status)}`}>
                {statusLabel(line.status)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
