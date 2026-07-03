import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { oeFetch } from '@core/oeFetch';

export interface DoctorRosterRow {
  user_id: number;
  display_name: string;
  taking_patients: boolean;
  queue_load: number;
}

interface RosterPayload {
  enabled: boolean;
  doctors: DoctorRosterRow[];
  my_user_id: number;
}

interface Props {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  visitDate: string | null;
  refreshToken: number;
}

export function DoctorRosterBar({
  ajaxUrl,
  csrfToken,
  facilityId,
  visitDate,
  refreshToken,
}: Props) {
  const [doctors, setDoctors] = useState<DoctorRosterRow[]>([]);
  const [myUserId, setMyUserId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {};
      if (facilityId > 0) params.facility_id = facilityId;
      if (visitDate) params.visit_date = visitDate;
      const data = await oeFetch<RosterPayload>('doctor.roster', {
        ajaxUrl,
        csrfToken,
        params,
      });
      setDoctors(data.doctors ?? []);
      setMyUserId(data.my_user_id ?? 0);
    } catch (err) {
      setDoctors([]);
      setError(err instanceof Error ? err.message : 'Could not load roster');
    } finally {
      setLoading(false);
    }
  }, [ajaxUrl, csrfToken, facilityId, visitDate]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const toggleTaking = useCallback(async (userId: number, next: boolean) => {
    setSavingUserId(userId);
    try {
      await oeFetch('doctor.roster.set_taking', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: {
          user_id: userId,
          taking_patients: next ? 1 : 0,
          facility_id: facilityId > 0 ? facilityId : undefined,
        },
      });
      setDoctors((prev) =>
        prev.map((row) =>
          row.user_id === userId ? { ...row, taking_patients: next } : row
        )
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update roster');
    } finally {
      setSavingUserId(0);
    }
  }, [ajaxUrl, csrfToken, facilityId]);

  if (loading && doctors.length === 0) {
    return (
      <Card className="mb-3 oe-nc-doctor-roster">
        <CardContent className="py-3 text-muted small">Loading on-duty roster…</CardContent>
      </Card>
    );
  }

  if (doctors.length === 0) {
    return null;
  }

  return (
    <Card className="mb-3 oe-nc-doctor-roster" id="nc-doctor-roster">
      <CardHeader className="py-3">
        <CardTitle className="text-base">On-duty doctors</CardTitle>
        <CardDescription>Taking patients toggle + queue load (V1.1-RTa)</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {error && <div className="alert alert-warning py-2 small mb-2">{error}</div>}
        <ul className="list-unstyled mb-0">
          {doctors.map((row) => {
            const isSelf = row.user_id === myUserId;
            const canToggle = isSelf && savingUserId !== row.user_id;
            return (
              <li
                key={row.user_id}
                className="d-flex align-items-center justify-content-between py-1 border-bottom"
              >
                <div>
                  <strong>{row.display_name}</strong>
                  {isSelf && <span className="text-muted small ml-1">(you)</span>}
                  <div className="text-muted small">
                    Load: {row.queue_load}
                    {!row.taking_patients && ' · Not taking patients'}
                  </div>
                </div>
                {isSelf ? (
                  <button
                    type="button"
                    className={`btn btn-sm ${row.taking_patients ? 'btn-success' : 'btn-outline-secondary'}`}
                    disabled={!canToggle}
                    onClick={() => void toggleTaking(row.user_id, !row.taking_patients)}
                  >
                    {row.taking_patients ? 'Taking' : 'Paused'}
                  </button>
                ) : (
                  <span
                    className={`badge ${row.taking_patients ? 'badge-success' : 'badge-secondary'}`}
                  >
                    {row.taking_patients ? 'On' : 'Off'}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
