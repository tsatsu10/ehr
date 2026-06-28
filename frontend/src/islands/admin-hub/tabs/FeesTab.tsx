import type { FeeScheduleRow } from '../adminTypes';
import { formatPrice } from '../adminUtils';

interface FeesTabProps {
  feeSchedule: FeeScheduleRow[];
  settings: Record<string, unknown>;
  webroot: string;
  csv: string;
  importing: boolean;
  onCsvChange: (value: string) => void;
  onAdd: () => void;
  onEdit: (row: FeeScheduleRow) => void;
  onArchive: (row: FeeScheduleRow) => void;
  onImport: () => void;
}

export function FeesTab({
  feeSchedule,
  settings,
  webroot,
  csv,
  importing,
  onCsvChange,
  onAdd,
  onEdit,
  onArchive,
  onImport,
}: FeesTabProps) {
  return (
    <>
      <div className="alert alert-info" id="nc-admin-fee-guidelines">
        <strong>How fee lines work</strong>
        <ul className="mb-2 pl-3 small">
          <li>Each line is a shortcut the cashier can post to the patient fee sheet.</li>
          <li>Billing code must already exist in OpenEMR (Administration → Codes) for the selected code type.</li>
          <li>Category groups charges on daily cash reports — pick the closest match.</li>
          <li>Use a starter template when adding common items, then adjust price and codes.</li>
        </ul>
        <a
          className="btn btn-outline-primary btn-sm"
          href={`${webroot}/interface/super/layout_service_codes.php`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open OpenEMR Codes admin
        </a>
      </div>
      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <p className="text-muted mb-0">Cash fee schedule for cashier charges and billing codes.</p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              id="nc-admin-add-fee"
              onClick={onAdd}
            >
              Add fee line
            </button>
          </div>
          <div id="nc-admin-fee-schedule">
            {!feeSchedule.length ? (
              <div className="text-muted"><em>No fee lines configured.</em></div>
            ) : (
              <table className="table table-sm table-bordered mb-0">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Billing</th>
                    <th>Scope</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {feeSchedule.map((row) => (
                    <tr key={row.id} className={row.is_active ? '' : 'text-muted'}>
                      <td><code>{row.code}</code></td>
                      <td>{row.name}</td>
                      <td>{row.category_label || row.category || '—'}</td>
                      <td>{formatPrice(row.price_amount, settings)}</td>
                      <td className="small">{row.code_type} · {row.billing_code}</td>
                      <td className="small">{row.scope_label ?? ''}</td>
                      <td>
                        {row.is_active
                          ? 'Active'
                          : <span className="text-muted">Archived</span>}
                      </td>
                      <td className="text-nowrap">
                        {row.is_active && (
                          <>
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-0 mr-2 nc-admin-edit-fee"
                              onClick={() => onEdit(row)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-0 text-danger nc-admin-archive-fee"
                              onClick={() => onArchive(row)}
                            >
                              Archive
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <hr />
          <h6>Import from CSV</h6>
          <p className="small text-muted mb-2">
            Columns: code, name, category, price_amount, code_type, billing_code, sort_order (optional).
          </p>
          <textarea
            className="form-control form-control-sm mb-2"
            id="nc-admin-fee-csv"
            rows={4}
            placeholder="OPD_CONSULT,OPD consultation,consult,50,CPT4,OPD_CONSULT,10"
            value={csv}
            onChange={(e) => onCsvChange(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            id="nc-admin-fee-import"
            disabled={importing}
            onClick={onImport}
          >
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
        </div>
      </div>
    </>
  );
}
