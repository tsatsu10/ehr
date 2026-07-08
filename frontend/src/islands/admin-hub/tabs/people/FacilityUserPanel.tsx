import { useCallback, useEffect, useState } from 'react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';
import { oeFetch } from '@core/oeFetch';
import { AdminEmptyState } from '../../adminUi';
import { PeoplePanel } from '../../peopleUi';
import type { FacilityMatrixPayload, FacilityUserPayload } from '../../peopleTypes';

interface FacilityUserPanelProps {
  ajaxUrl: string;
  csrfToken: string;
  defaultFacilityId: number;
  initialUserId?: number;
  initialFacilityId?: number;
  onOpenMatrix: () => void;
}

export function FacilityUserPanel({
  ajaxUrl,
  csrfToken,
  defaultFacilityId,
  initialUserId,
  initialFacilityId,
  onOpenMatrix,
}: FacilityUserPanelProps) {
  const [matrix, setMatrix] = useState<FacilityMatrixPayload | null>(null);
  const [userId, setUserId] = useState(initialUserId ?? 0);
  const [facilityId, setFacilityId] = useState(initialFacilityId ?? defaultFacilityId);
  const [payload, setPayload] = useState<FacilityUserPayload | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void oeFetch<FacilityMatrixPayload>('admin.facility_user.list', { ajaxUrl, csrfToken })
      .then((data) => {
        setMatrix(data);
        if (!initialUserId && data.users?.[0]) {
          setUserId(data.users[0].id);
        }
        if (!initialFacilityId && data.facilities?.[0] && defaultFacilityId <= 0) {
          setFacilityId(data.facilities[0].id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Load failed'))
      .finally(() => setLoading(false));
  }, [ajaxUrl, csrfToken, defaultFacilityId, initialFacilityId, initialUserId]);

  useEffect(() => {
    if (initialUserId) {
      setUserId(initialUserId);
    }
    if (initialFacilityId) {
      setFacilityId(initialFacilityId);
    }
  }, [initialFacilityId, initialUserId]);

  const loadFields = useCallback(async () => {
    if (userId <= 0 || facilityId <= 0) {
      setPayload(null);
      return;
    }
    setError(null);
    try {
      const data = await oeFetch<FacilityUserPayload>('admin.facility_user.get', {
        ajaxUrl,
        csrfToken,
        params: { user_id: userId, facility_id: facilityId },
      });
      setPayload(data);
      setValues(data.values ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load facility fields');
      setPayload(null);
    }
  }, [ajaxUrl, csrfToken, userId, facilityId]);

  useEffect(() => {
    void loadFields();
  }, [loadFields]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await oeFetch('admin.facility_user.save', {
        ajaxUrl,
        csrfToken,
        json: { user_id: userId, facility_id: facilityId, values },
      });
      setMessage('Saved facility user fields');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading facilities…</p>;
  }

  if (!matrix?.has_facusr_fields) {
    return (
      <PeoplePanel
        title="Facility user information"
        description="Per-facility provider and billing identifiers."
      >
        <AdminEmptyState title="No FACUSR layout fields configured" />
      </PeoplePanel>
    );
  }

  return (
    <PeoplePanel
      title="Facility user information"
      description={`Edit FACUSR fields (${matrix.field_count} fields configured).`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="fac-user">Staff member</Label>
          <NativeSelect id="fac-user" value={String(userId)} onChange={(e) => setUserId(Number(e.target.value))}>
            {(matrix.users ?? []).map((user) => (
              <option key={user.id} value={user.id}>{user.display_name} ({user.username})</option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="fac-site">Facility</Label>
          <NativeSelect id="fac-site" value={String(facilityId)} onChange={(e) => setFacilityId(Number(e.target.value))}>
            {(matrix.facilities ?? []).map((fac) => (
              <option key={fac.id} value={fac.id}>{fac.name}</option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {(payload?.fields ?? []).map((field) => (
          <div key={field.field_id}>
            <Label htmlFor={`fac-field-${field.field_id}`}>{field.title}</Label>
            <Input
              id={`fac-field-${field.field_id}`}
              value={values[field.field_id] ?? ''}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.field_id]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-[var(--color-oe-danger,#b91c1c)]">{error}</p>}
      {message && <p className="text-sm text-[var(--color-oe-cta,#047857)]">{message}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={saving} onClick={() => { void save(); }}>
          {saving ? 'Saving…' : 'Save fields'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onOpenMatrix}>
          Matrix view (all users)
        </Button>
      </div>
    </PeoplePanel>
  );
}
