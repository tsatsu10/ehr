import { useCallback, useEffect, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { NativeSelect } from '@components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
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
    <div className="border rounded p-3 mt-2 bg-[var(--oe-nc-bg-tint)]" id="nc-admin-flowboard-lane-map">
      <h6 className="mb-1">Flow Board lane mapping (§10.3)</h6>
      <p className="text-[var(--oe-nc-text-muted)] text-sm mb-2">
        Map each appointment status to an ordered flow lane. Check-in/out statuses should stay on
        Arrived and Checked out lanes.
        {isCustom ? ' Custom mapping active.' : ' Showing computed defaults until you save.'}
      </p>
      {error && <div className={deskCalloutClass('error', 'py-2 text-sm')}>{error}</div>}
      {success && <div className={deskCalloutClass('success', 'py-2 text-sm')}>{success}</div>}
      {loading ? (
        <p className="text-[var(--oe-nc-text-muted)] text-sm mb-0">Loading lane mapping…</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table className={ncShadcnTableClass({ bordered: true, className: 'mb-2' })}>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Lane</TableHead>
                  <TableHead>Lane label</TableHead>
                  <TableHead>Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.apptstat_code}>
                    <TableCell>
                      <strong>{row.apptstat_label}</strong>
                      <code className="ml-1 text-sm">{row.apptstat_code}</code>
                      {row.is_check_in && <Badge variant="info" className="ml-1">Check-in</Badge>}
                      {row.is_check_out && <Badge variant="neutral" className="ml-1">Check-out</Badge>}
                    </TableCell>
                    <TableCell>
                      <NativeSelect
                        className="h-8 py-1"
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
                      </NativeSelect>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        className="h-8"
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
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="h-8"
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={saving || rows.length === 0}
            onClick={() => { void handleSave(); }}
          >
            {saving ? 'Saving…' : 'Save lane mapping'}
          </Button>
        </>
      )}
    </div>
  );
}
