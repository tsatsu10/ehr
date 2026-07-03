import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CompletionFieldWeightPayload, CompletionFieldWeightRow } from '../adminTypes';

interface CompletionWeightsEditorProps {
  payload: CompletionFieldWeightPayload | null;
  saving: boolean;
  error: string | null;
  onSave: (items: CompletionFieldWeightRow[]) => void;
}

export function CompletionWeightsEditor({
  payload,
  saving,
  error,
  onSave,
}: CompletionWeightsEditorProps) {
  const [items, setItems] = useState<CompletionFieldWeightRow[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setItems(payload?.items ?? []);
    setDirty(false);
  }, [payload]);

  const activeTotal = useMemo(
    () => items.reduce((sum, row) => sum + (row.is_active ? row.weight : 0), 0),
    [items]
  );

  const targetTotal = payload?.target_total ?? 100;
  const totalValid = activeTotal === targetTotal;

  const updateRow = useCallback((fieldKey: string, patch: Partial<CompletionFieldWeightRow>) => {
    setItems((prev) =>
      prev.map((row) => (row.field_key === fieldKey ? { ...row, ...patch } : row))
    );
    setDirty(true);
  }, []);

  const handleSave = useCallback(() => {
    onSave(items);
  }, [items, onSave]);

  if (!payload || items.length === 0) {
    return <p className="text-muted mb-0">Completion weights are not available.</p>;
  }

  return (
    <div className="card mt-3">
      <div className="card-body">
        <h3 className="h6 mb-2">Field weights</h3>
        <p className="small text-muted">
          Active weights must total {targetTotal}. Disable optional fields instead of setting weight to 0
          when you do not want them in the score.
        </p>

        <div className="table-responsive">
          <table className="table table-sm table-bordered mb-3">
            <thead>
              <tr>
                <th scope="col">Level</th>
                <th scope="col">Field</th>
                <th scope="col" className="text-right">Weight</th>
                <th scope="col" className="text-center">Active</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.field_key}>
                  <td>
                    <span className="d-block small text-muted">{row.level_label}</span>
                    <span className="sr-only">Level {row.level}</span>
                  </td>
                  <td>{row.label}</td>
                  <td className="text-right" style={{ width: 110 }}>
                    <input
                      type="number"
                      className="form-control form-control-sm text-right"
                      min={0}
                      max={100}
                      value={row.weight}
                      disabled={!row.is_active}
                      onChange={(event) => {
                        updateRow(row.field_key, { weight: Number(event.target.value) || 0 });
                      }}
                    />
                  </td>
                  <td className="text-center" style={{ width: 72 }}>
                    <input
                      type="checkbox"
                      checked={row.is_active}
                      aria-label={`Include ${row.label} in completion score`}
                      onChange={(event) => {
                        updateRow(row.field_key, { is_active: event.target.checked });
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <p className={`mb-0 font-weight-bold ${totalValid ? 'text-success' : 'text-danger'}`}>
            Active total: {activeTotal} / {targetTotal}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!dirty || !totalValid || saving}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save weights'}
          </button>
        </div>

        {error && <div className="alert alert-danger mt-3 mb-0 py-2">{error}</div>}
      </div>
    </div>
  );
}
