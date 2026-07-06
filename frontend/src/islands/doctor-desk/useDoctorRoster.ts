import { useCallback, useEffect, useState } from 'react';
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

export function useDoctorRoster({
  ajaxUrl,
  csrfToken,
  facilityId,
  visitDate,
  refreshToken,
  enabled,
}: {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  visitDate: string | null;
  refreshToken: number;
  enabled: boolean;
}) {
  const [doctors, setDoctors] = useState<DoctorRosterRow[]>([]);
  const [myUserId, setMyUserId] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) {
      setDoctors([]);
      setLoading(false);
      return;
    }
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
  }, [ajaxUrl, csrfToken, enabled, facilityId, visitDate]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const toggleTaking = useCallback(async (next: boolean) => {
    if (!myUserId) return;
    setSaving(true);
    try {
      await oeFetch('doctor.roster.set_taking', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: {
          user_id: myUserId,
          taking_patients: next ? 1 : 0,
          facility_id: facilityId > 0 ? facilityId : undefined,
        },
      });
      setDoctors((prev) =>
        prev.map((row) =>
          row.user_id === myUserId ? { ...row, taking_patients: next } : row,
        ),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status');
    } finally {
      setSaving(false);
    }
  }, [ajaxUrl, csrfToken, facilityId, myUserId]);

  const self = doctors.find((row) => row.user_id === myUserId) ?? null;
  const takingCount = doctors.filter((row) => row.taking_patients).length;

  return {
    doctors,
    myUserId,
    self,
    takingCount,
    loading,
    error,
    saving,
    toggleTaking,
    reload: load,
  };
}
