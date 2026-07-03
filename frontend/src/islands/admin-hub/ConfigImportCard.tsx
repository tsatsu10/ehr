import { useRef, type ChangeEvent } from 'react';
import type { ConfigExportMeta, ConfigImportResult } from './adminTypes';

interface ConfigImportCardProps {
  meta: ConfigExportMeta;
  scopeLabel: string;
  preview: ConfigImportResult | null;
  previewing: boolean;
  importing: boolean;
  onChooseFile: (snapshot: Record<string, unknown>) => void;
  onConfirmImport: () => void;
  onClearPreview: () => void;
}

export function ConfigImportCard({
  meta,
  scopeLabel,
  preview,
  previewing,
  importing,
  onChooseFile,
  onConfirmImport,
  onClearPreview,
}: ConfigImportCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const snapshot = JSON.parse(text) as Record<string, unknown>;
      onChooseFile(snapshot);
    } catch {
      onChooseFile({});
    }
  };

  const summary = preview?.summary;
  const canConfirm = !!preview?.dry_run && !previewing && !importing;

  return (
    <div className="card mb-3" id="nc-admin-config-import">
      <div className="card-body">
        <h5 className="card-title mb-1">Site template import (M6)</h5>
        <p className="text-muted small mb-3">
          Upload M6 config JSON from export (M15-F13) to apply settings, visit types, and fee
          schedule to {scopeLabel || 'this clinic'}. Preview runs first; confirm to apply.
        </p>
        <div className="d-flex flex-wrap align-items-center mb-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="d-none"
            aria-hidden
            onChange={(event) => { void handleFileChange(event); }}
          />
          <button
            type="button"
            className="btn btn-outline-primary btn-sm mr-2"
            disabled={!meta.can_import || previewing || importing}
            onClick={() => fileInputRef.current?.click()}
          >
            {previewing ? 'Validating…' : 'Choose M6 config JSON'}
          </button>
          {preview && (
            <button
              type="button"
              className="btn btn-link btn-sm"
              disabled={previewing || importing}
              onClick={onClearPreview}
            >
              Clear preview
            </button>
          )}
        </div>
        {!meta.can_import && meta.import_blocked_reason && (
          <p className="small text-muted mb-0">{meta.import_blocked_reason}</p>
        )}
        {preview && summary && (
          <div className="border rounded p-3 mt-2 bg-light">
            <p className="small font-weight-bold mb-2">Import preview</p>
            <ul className="small mb-2 pl-3">
              <li>{summary.settings_planned ?? 0} clinic settings</li>
              <li>{summary.fees_planned ?? summary.fees_imported ?? 0} fee schedule lines</li>
              <li>{summary.visit_types_planned ?? summary.visit_types_imported ?? 0} visit types</li>
            </ul>
            {(preview.warnings ?? []).length > 0 && (
              <div className="small text-warning mb-2">
                {(preview.warnings ?? []).map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            )}
            {(preview.errors ?? []).length > 0 && (
              <div className="small text-danger mb-2">
                {(preview.errors ?? []).map((err) => (
                  <div key={err}>{err}</div>
                ))}
              </div>
            )}
            <button
              type="button"
              className="btn btn-warning btn-sm"
              disabled={!canConfirm || (preview.errors ?? []).length > 0}
              onClick={onConfirmImport}
            >
              {importing ? 'Importing…' : 'Apply import to this site'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
