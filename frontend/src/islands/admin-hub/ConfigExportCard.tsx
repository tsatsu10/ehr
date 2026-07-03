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
    <div className="card mb-3" id="nc-admin-config-export">
      <div className="card-body">
        <h5 className="card-title mb-1">Site template export (M15-F13)</h5>
        <p className="text-muted small mb-3">
          Download facility-scoped M6 settings, visit types, and fee schedule as JSON for a second
          branch or NG7 prep — not a full SQL site dump.
        </p>
        <div className="d-flex flex-wrap align-items-center">
          <button
            type="button"
            className="btn btn-outline-primary btn-sm mr-2"
            disabled={!meta.can_export || exporting}
            onClick={onExport}
          >
            {exporting ? 'Preparing…' : 'Download M6 config JSON'}
          </button>
          <span className="small text-muted">
            Scope: {scopeLabel || 'current clinic'}
          </span>
        </div>
        {!meta.can_export && meta.blocked_reason && (
          <p className="small text-muted mb-0 mt-2">{meta.blocked_reason}</p>
        )}
      </div>
    </div>
  );
}
