/**
 * M4-F40 — documentation status chip listing unsigned required forms.
 */

import type { DocumentationStatus } from '@core/types';

interface DocumentationStatusChipProps {
  documentationStatus?: DocumentationStatus | null;
  requireSign: boolean;
  encounterSigned: boolean;
}

export function DocumentationStatusChip({
  documentationStatus,
  requireSign,
  encounterSigned,
}: DocumentationStatusChipProps) {
  if (encounterSigned) {
    return <span className="badge badge-success ml-2">Signed</span>;
  }

  const unsigned = documentationStatus?.unsigned_required ?? [];
  if (unsigned.length > 0) {
    const labels = unsigned.map((item) => item.title).join(', ');
    const variant = requireSign ? 'danger' : 'warning';
    return (
      <span className={`badge badge-${variant} ml-2`} title={labels}>
        Unsigned: {labels}
      </span>
    );
  }

  if (requireSign) {
    return <span className="badge badge-danger ml-2">Unsigned — sign before complete</span>;
  }

  return <span className="badge badge-warning ml-2">Unsigned — payment blocked</span>;
}
