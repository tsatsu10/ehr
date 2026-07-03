import type { AncillaryLbfPackStatus, FormBundleBoardPayload } from '../adminTypes';

interface FormBundleBoardProps {
  board: FormBundleBoardPayload;
  ancillaryLbfPacks: AncillaryLbfPackStatus[];
  importingPackKey: string | null;
  installingAll: boolean;
  onImportPack: (packKey: string) => void;
  onInstallAllMissing: () => void;
}

function statusBadgeClass(row: FormBundleBoardPayload['rows'][number]): string {
  if (!row.installed) {
    return 'badge-secondary';
  }
  if (!row.esign_ok) {
    return 'badge-warning';
  }
  return 'badge-success';
}

export function FormBundleBoard({
  board,
  ancillaryLbfPacks,
  importingPackKey,
  installingAll,
  onImportPack,
  onInstallAllMissing,
}: FormBundleBoardProps) {
  const missingImportable = board.rows.filter((row) => row.can_import && row.pack_key);
  const showInstallAll = missingImportable.length > 1;

  return (
    <div className="card mb-3" id="nc-admin-form-bundle-board">
      <div className="card-body">
        <div className="d-flex flex-wrap align-items-start justify-content-between mb-2">
          <div>
            <h5 className="card-title mb-1">Clinic form bundle</h5>
            <p className="text-muted small mb-0">
              Required New Clinic forms — install and E-Sign readiness (M15-F06).
            </p>
          </div>
          <div className="d-flex flex-wrap">
            {showInstallAll && (
              <button
                type="button"
                className="btn btn-outline-primary btn-sm mr-2 mb-2"
                disabled={installingAll || importingPackKey !== null}
                onClick={onInstallAllMissing}
              >
                {installingAll ? 'Installing…' : 'Install missing ancillary forms'}
              </button>
            )}
            <a
              className="btn btn-outline-secondary btn-sm mb-2"
              href={board.forms_admin_url}
              target="_top"
            >
              Forms Administration
            </a>
          </div>
        </div>

        {!board.esign_globally_enabled && (
          <div className="alert alert-warning py-2 small mb-3">
            E-Sign globals are off. Enable <code>esign_individual</code> (Cash clinic profile applies this) before go-live.
          </div>
        )}

        <div className="table-responsive">
          <table className="table table-sm table-bordered mb-3">
            <thead className="thead-light">
              <tr>
                <th scope="col">Form</th>
                <th scope="col">formdir</th>
                <th scope="col">Required for</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {board.rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.title}</td>
                  <td><code className="small">{row.formdir}</code></td>
                  <td className="small text-muted">{row.required_for}</td>
                  <td>
                    <span className={`badge ${statusBadgeClass(row)}`}>
                      {row.status_label}
                    </span>
                    {row.esign_detail && !row.esign_ok && (
                      <div className="small text-muted mt-1">{row.esign_detail}</div>
                    )}
                  </td>
                  <td className="text-right">
                    {row.can_import && row.pack_key ? (
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        disabled={importingPackKey === row.pack_key || installingAll}
                        onClick={() => onImportPack(row.pack_key!)}
                      >
                        {importingPackKey === row.pack_key ? 'Importing…' : 'Import LBF'}
                      </button>
                    ) : (
                      <span className="small text-muted">{row.import_hint ?? '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border rounded p-3 bg-light small">
          <strong>Test E-Sign on a staging encounter</strong>
          <p className="mb-2 mt-1 text-muted">{board.test_esign_help}</p>
          <div className="d-flex flex-wrap">
            <a className="btn btn-outline-primary btn-sm mr-2 mb-1" href={board.doctor_desk_url} target="_top">
              Open Doctor Desk
            </a>
            {board.clinical_doc_hub_enabled && (
              <a className="btn btn-outline-primary btn-sm mr-2 mb-1" href={board.clinical_doc_hub_url} target="_top">
                Clinical Documentation Hub
              </a>
            )}
            <a className="btn btn-outline-secondary btn-sm mb-1" href={board.layout_editor_url} target="_top">
              Layout editor (Advanced)
            </a>
          </div>
        </div>

        {ancillaryLbfPacks.length > 0 && (
          <p className="small text-muted mb-0 mt-2">
            Ancillary packs:
            {' '}
            {ancillaryLbfPacks.map((pack) => `${pack.title} (${pack.installed ? 'installed' : 'pending'})`).join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}
