import { Button } from '@components/ui/button';
import { Download } from 'lucide-react';
import type { ConfigExportMeta } from './adminTypes';
import { AdminSection } from './adminUi';

interface ConfigExportCardProps {
  meta: ConfigExportMeta;
  scopeLabel: string;
  exporting: boolean;
  onExport: () => void;
}

export function ConfigExportCard({
  meta,
  scopeLabel,
  exporting,
  onExport,
}: ConfigExportCardProps) {
  return (
    <AdminSection
      id="nc-admin-config-export"
      title="Site template export"
      description="Download facility-scoped M6 settings, visit types, and fee schedule as JSON for a second branch or NG7 prep — not a full SQL site dump."
      icon={<Download className="h-4 w-4" aria-hidden />}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!meta.can_export || exporting}
          onClick={onExport}
        >
          {exporting ? 'Preparing…' : 'Download M6 config JSON'}
        </Button>
        <span className="text-sm text-[var(--oe-nc-text-muted)]">
          Scope: {scopeLabel || 'current clinic'}
        </span>
      </div>
      {!meta.can_export && meta.blocked_reason && (
        <p className="mb-0 mt-2 text-sm text-[var(--oe-nc-text-muted)]">{meta.blocked_reason}</p>
      )}
    </AdminSection>
  );
}
