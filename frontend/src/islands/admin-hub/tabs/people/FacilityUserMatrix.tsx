import { useCallback, useEffect, useState } from 'react';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
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
import type { GuidedAclTone } from '../../guidedAclTasks';
import type { PeopleSubTabId } from '../../peopleTypes';
import { AdminEmptyState } from '../../adminUi';
import type { FacilityMatrixGridPayload } from '../../peopleTypes';
import { PeopleViewShell } from './PeopleViewShell';

interface FacilityUserMatrixProps {
  ajaxUrl: string;
  csrfToken: string;
  defaultFacilityId: number;
  originSub: PeopleSubTabId;
  tone?: GuidedAclTone;
  onBack: () => void;
  onEditCell: (userId: number, facilityId: number) => void;
}

export function FacilityUserMatrix({
  ajaxUrl,
  csrfToken,
  defaultFacilityId,
  originSub,
  tone = 'primary',
  onBack,
  onEditCell,
}: FacilityUserMatrixProps) {
  const [facilityId, setFacilityId] = useState(defaultFacilityId);
  const [search, setSearch] = useState('');
  const [data, setData] = useState<FacilityMatrixGridPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await oeFetch<FacilityMatrixGridPayload>('admin.facility_user.matrix', {
        ajaxUrl,
        csrfToken,
        params: {
          facility_id: facilityId > 0 ? facilityId : undefined,
          search,
        },
      });
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [ajaxUrl, csrfToken, facilityId, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const fields = data?.fields ?? [];
  const rows = data?.rows ?? [];

  return (
    <PeopleViewShell
      title="Facility user matrix"
      description="All users and facilities — per-cell FACUSR values."
      originSub={originSub}
      tone={tone}
      onBack={onBack}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <Label htmlFor="matrix-search">Search user</Label>
          <Input id="matrix-search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="matrix-facility">Facility filter</Label>
          <NativeSelect
            id="matrix-facility"
            value={String(facilityId)}
            onChange={(e) => setFacilityId(Number(e.target.value))}
          >
            <option value="0">All facilities</option>
            {(data?.facilities ?? []).map((fac) => (
              <option key={fac.id} value={fac.id}>{fac.name}</option>
            ))}
          </NativeSelect>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => { void load(); }}>
          Refresh
        </Button>
      </div>

      {error && <p className="text-sm text-[var(--color-oe-danger,#b91c1c)]">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading matrix…</p>
      ) : !data?.has_facusr_fields ? (
        <AdminEmptyState title="No FACUSR layout fields configured" />
      ) : !rows.length ? (
        <AdminEmptyState title="No rows match your filters" />
      ) : (
        <div className="overflow-x-auto">
          <Table className={ncShadcnTableClass({ bordered: true })}>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Facility</TableHead>
                {fields.map((field) => (
                  <TableHead key={field.field_id}>{field.title}</TableHead>
                ))}
                <TableHead aria-label="Actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.user_id}-${row.facility_id}`}>
                  <TableCell><code>{row.username}</code></TableCell>
                  <TableCell>{row.display_name}</TableCell>
                  <TableCell>{row.facility_name}</TableCell>
                  {fields.map((field) => (
                    <TableCell key={field.field_id} className="text-sm">
                      {row.cells[field.field_id] || '—'}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => onEditCell(row.user_id, row.facility_id)}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PeopleViewShell>
  );
}
