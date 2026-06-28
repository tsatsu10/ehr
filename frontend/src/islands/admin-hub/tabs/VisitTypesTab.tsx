import type { CalendarCategory, VisitTypeRow } from '../adminTypes';
import { categoryLabel, profileLabel } from '../adminUtils';

interface VisitTypesTabProps {
  visitTypes: VisitTypeRow[];
  calendarCategories: CalendarCategory[];
  onAdd: () => void;
  onEdit: (row: VisitTypeRow) => void;
  onArchive: (row: VisitTypeRow) => void;
}

export function VisitTypesTab({
  visitTypes,
  calendarCategories,
  onAdd,
  onEdit,
  onArchive,
}: VisitTypesTabProps) {
  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <p className="text-muted mb-0">Visit types map to calendar categories for encounters.</p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            id="nc-admin-add-visit-type"
            onClick={onAdd}
          >
            Add visit type
          </button>
        </div>
        <div id="nc-admin-visit-types">
          {!visitTypes.length ? (
            <div className="text-muted"><em>No visit types configured.</em></div>
          ) : (
            <table className="table table-sm table-bordered mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Calendar category</th>
                  <th>Profile</th>
                  <th>Scope</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visitTypes.map((row) => {
                  const status = row.is_active
                    ? (row.is_default ? <span className="badge badge-primary">Default</span> : 'Active')
                    : <span className="text-muted">Archived</span>;
                  return (
                    <tr key={row.id} className={row.is_active ? '' : 'text-muted'}>
                      <td>{row.label}</td>
                      <td>{categoryLabel(row.pc_catid, calendarCategories)}</td>
                      <td>{profileLabel(row.service_profile)}</td>
                      <td className="small">{row.scope_label ?? ''}</td>
                      <td>{status}</td>
                      <td className="text-nowrap">
                        {row.is_active && (
                          <>
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-0 mr-2 nc-admin-edit-type"
                              onClick={() => onEdit(row)}
                            >
                              Edit
                            </button>
                            {!row.is_default && (
                              <button
                                type="button"
                                className="btn btn-link btn-sm p-0 text-danger nc-admin-archive-type"
                                onClick={() => onArchive(row)}
                              >
                                Archive
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
