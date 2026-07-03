import { useCallback, useEffect, useState } from 'react';
import { oeFetch } from '@core/oeFetch';

export interface FlowBoardLaneMapRow {
  apptstat_code: string;
  apptstat_label: string;
  is_check_in: boolean;
  is_check_out: boolean;
  lane_key: string;
  lane_label: string;
  lane_seq: number;
  status_seq: number;
}

interface LaneMapPayload {
  facility_id: number;
  default_lane_keys: string[];
  default_lane_labels: Record<string, string>;
  rows: FlowBoardLaneMapRow[];
  is_custom: boolean;
}

interface FlowBoardLaneMapPanelProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  schedulingEnabled: boolean;
}

export function FlowBoardLaneMapPanel({
  ajaxUrl,
  csrfToken,
  facilityId,
  schedulingEnabled,
}: FlowBoardLaneMapPanelProps) {
  const [rows, setRows] = useState<FlowBoardLaneMapRow[]>([]);
  const [laneLabels, setLaneLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCustom, setIsCustom] = useState(false);

  const load = useCallback(async () => {
    if (!schedulingEnabled || facilityId <= 0) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await oeFetch<LaneMapPayload>('scheduling.flow_board.lane_map', {
        ajaxUrl,
        csrfToken,
        params: { facility_id: facilityId },
      });
      setRows(data.rows);
      setLaneLabels(data.default_lane_labels);
      setIsCustom(data.is_custom);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load lane mapping');
    } finally {
      setLoading(false);
    }
  }, [ajaxUrl, csrfToken, facilityId, schedulingEnabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await oeFetch<LaneMapPayload>('scheduling.flow_board.lane_map.save', {
        method: 'POST',
        ajaxUrl,
        csrfToken,
        json: { facility_id: facilityId, rows },
      });
      setRows(data.rows);
      setIsCustom(data.is_custom);
      setSuccess('Lane mapping saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save lane mapping');
    } finally {
      setSaving(false);
    }
  };

  if (!schedulingEnabled) {
    return null;
  }

  return (
    <div className="border rounded p-3 mt-2 bg-light" id="nc-admin-flowboard-lane-map">
      <h6 className="mb-1">Flow Board lane mapping (§10.3)</h6>
      <p className="text-muted small mb-2">
        Map each appointment status to an ordered flow lane. Check-in/out statuses should stay on
        Arrived and Checked out lanes.
        {isCustom ? ' Custom mapping active.' : ' Showing computed defaults until you save.'}
      </p>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {success && <div className="alert alert-success py-2 small">{success}</div>}
      {loading ? (
        <p className="text-muted small mb-0">Loading lane mapping…</p>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-sm table-bordered mb-2">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Lane</th>
                  <th>Lane label</th>
                  <th>Order</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.apptstat_code}>
                    <td>
                      <strong>{row.apptstat_label}</strong>
                      <code className="ml-1 small">{row.apptstat_code}</code>
                      {row.is_check_in && <span className="badge badge-info ml-1">Check-in</span>}
                      {row.is_check_out && <span className="badge badge-secondary ml-1">Check-out</span>}
                    </td>
                    <td>
                      <select
                        className="form-control form-control-sm"
                        value={row.lane_key}
                        onChange={(e) => {
                          const laneKey = e.target.value;
                          setRows((prev) => prev.map((item) => (
                            item.apptstat_code === row.apptstat_code
                              ? {
                                ...item,
                                lane_key: laneKey,
                                lane_label: laneLabels[laneKey] ?? item.lane_label,
                              }
                              : item
                          )));
                        }}
                      >
                        {Object.entries(laneLabels).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={row.lane_label}
                        onChange={(e) => {
                          const value = e.target.value;
                          setRows((prev) => prev.map((item) => (
                            item.apptstat_code === row.apptstat_code
                              ? { ...item, lane_label: value }
                              : item
                          )));
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        min={0}
                        max={99}
                        value={row.lane_seq}
                        onChange={(e) => {
                          const laneSeq = Number(e.target.value);
                          setRows((prev) => prev.map((item) => (
                            item.apptstat_code === row.apptstat_code
                              ? { ...item, lane_seq: laneSeq }
                              : item
                          )));
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saving || rows.length === 0}
            onClick={() => { void handleSave(); }}
          >
            {saving ? 'Saving…' : 'Save lane mapping'}
          </button>
        </>
      )}
    </div>
  );
}
