/**
 * M4-F40 — documentation status chip listing unsigned required forms.
 */

import { Badge } from '@components/ui/badge';
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
    return <Badge variant="success" className="ml-2">Signed</Badge>;
  }

  const unsigned = documentationStatus?.unsigned_required ?? [];
  if (unsigned.length > 0) {
    const labels = unsigned.map((item) => item.title).join(', ');
    return (
      <Badge variant={requireSign ? 'danger' : 'warning'} className="ml-2" title={labels}>
        Unsigned: {labels}
      </Badge>
    );
  }

  if (requireSign) {
    return (
      <Badge variant="danger" className="ml-2">
        Unsigned — sign before complete
      </Badge>
    );
  }

  return (
    <Badge variant="warning" className="ml-2">
      Unsigned — payment blocked
    </Badge>
  );
}
