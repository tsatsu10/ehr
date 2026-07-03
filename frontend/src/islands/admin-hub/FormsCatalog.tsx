import { useMemo, useState } from 'react';
import type { FormsCatalogItem, FormsCatalogPayload } from './adminTypes';

interface FormsCatalogProps {
  catalog: FormsCatalogPayload;
  togglingId: number | null;
  onToggle: (item: FormsCatalogItem, enabled: boolean) => void;
}

export function FormsCatalog({ catalog, togglingId, onToggle }: FormsCatalogProps) {
  const [query, setQuery] = useState('');
  const [bundleOnly, setBundleOnly] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog.items.filter((item) => {
      if (bundleOnly && !item.bundle_required) {
        return false;
      }
      if (needle === '') {
        return true;
      }
      return item.name.toLowerCase().includes(needle)
        || item.directory.toLowerCase().includes(needle)
        || item.category.toLowerCase().includes(needle);
    });
  }, [bundleOnly, catalog.items, query]);

  return (
    <div className="card mb-3" id="nc-admin-forms-catalog">
      <div className="card-body">
        <div className="d-flex flex-wrap align-items-start justify-content-between mb-2">
          <div>
            <h5 className="card-title mb-1">Registered forms</h5>
            <p className="text-muted small mb-0">
              Enable or disable encounter forms. Bundle-required forms are listed first (M15-F07).
            </p>
          </div>
          <a className="btn btn-outline-secondary btn-sm" href={catalog.forms_admin_url} target="_top">
            Full Forms Administration
          </a>
        </div>

        {!catalog.can_edit && (
          <div className="alert alert-info py-2 small mb-3">
            Read-only — enabling or disabling forms requires core <code>admin/forms</code> ACL.
          </div>
        )}

        <div className="d-flex flex-wrap align-items-center mb-3">
          <input
            type="search"
            className="form-control form-control-sm mr-2 mb-2"
            style={{ maxWidth: '16rem' }}
            placeholder="Search forms…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search registered forms"
          />
          <label className="small mb-2">
            <input
              type="checkbox"
              className="mr-1"
              checked={bundleOnly}
              onChange={(event) => setBundleOnly(event.target.checked)}
            />
            Bundle forms only
          </label>
        </div>

        <div className="table-responsive">
          <table className="table table-sm table-bordered mb-0">
            <thead className="thead-light">
              <tr>
                <th scope="col">Form</th>
                <th scope="col">Directory</th>
                <th scope="col">Category</th>
                <th scope="col" className="text-center">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const blockedOff = item.enabled && item.disable_blocked;
                const canToggle = catalog.can_edit && !blockedOff;
                return (
                  <tr key={item.id}>
                    <td>
                      <div>{item.name}</div>
                      {item.bundle_required && (
                        <span className="badge badge-primary badge-sm mr-1">Bundle</span>
                      )}
                      {item.enable_warning && item.enabled && (
                        <div className="small text-warning mt-1">{item.enable_warning}</div>
                      )}
                      {!item.enabled && item.disable_block_reason && (
                        <div className="small text-muted mt-1">{item.disable_block_reason}</div>
                      )}
                    </td>
                    <td><code className="small">{item.directory}</code></td>
                    <td className="small text-muted">{item.category || '—'}</td>
                    <td className="text-center">
                      <button
                        type="button"
                        className={`btn btn-sm ${item.enabled ? 'btn-success' : 'btn-outline-secondary'}`}
                        disabled={!canToggle || togglingId === item.id}
                        title={
                          blockedOff
                            ? item.disable_block_reason ?? 'Cannot disable'
                            : item.enabled
                              ? 'Disable form'
                              : 'Enable form'
                        }
                        onClick={() => onToggle(item, !item.enabled)}
                      >
                        {togglingId === item.id ? '…' : item.enabled ? 'On' : 'Off'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted small">No forms match your filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
