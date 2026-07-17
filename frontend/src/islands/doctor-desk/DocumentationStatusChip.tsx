/**
 * M4-F40 — documentation status chip listing unsigned required forms.
 */

import { Badge } from '@components/ui/badge';
import { t } from '@core/i18n';
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
    return <Badge variant="success" className="ml-2">{t('Signed')}</Badge>;
  }

  const unsigned = documentationStatus?.unsigned_required ?? [];
  const preview = documentationStatus?.encounter_note_preview;
  if (unsigned.length > 0) {
    const labels = unsigned.map((item) => item.title).join(', ');
    const previewHint = preview?.cc_preview
      ? ` · ${preview.cc_preview}`
      : (preview?.problem_count ?? 0) > 0
        ? ` · ${t('{count} problems', { count: preview?.problem_count ?? 0 })}`
        : '';
    return (
      <Badge variant={requireSign ? 'danger' : 'warning'} className="ml-2" title={labels + previewHint}>
        {t('Unsigned: {labels}', { labels })}
        {previewHint}
      </Badge>
    );
  }

  if (preview?.cc_preview && !preview.signed) {
    return (
      <Badge variant="neutral" className="ml-2" title={preview.cc_preview}>
        {t('Draft · {preview}', { preview: preview.cc_preview })}
      </Badge>
    );
  }

  if (requireSign) {
    return (
      <Badge variant="danger" className="ml-2">
        {t('Unsigned — sign before complete')}
      </Badge>
    );
  }

  return (
    <Badge variant="warning" className="ml-2">
      {t('Unsigned — payment blocked')}
    </Badge>
  );
}
