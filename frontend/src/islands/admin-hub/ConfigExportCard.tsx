import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import type { ConfigExportMeta } from './adminTypes';

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
    <Card className="mb-3" id="nc-admin-config-export">
      <CardContent>
        <h5 className="text-base font-semibold mb-1">Site template export (M15-F13)</h5>
        <p className="text-[var(--oe-nc-text-muted)] text-sm mb-3">
          Download facility-scoped M6 settings, visit types, and fee schedule as JSON for a second
          branch or NG7 prep — not a full SQL site dump.
        </p>
        <div className="flex flex-wrap items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mr-2"
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
          <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0 mt-2">{meta.blocked_reason}</p>
        )}
      </CardContent>
    </Card>
  );
}
