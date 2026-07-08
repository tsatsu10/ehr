import { useCallback, useEffect, useState } from 'react';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';
import { RowActionsMenu } from '@components/RowActionsMenu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import { oeFetch } from '@core/oeFetch';
import { AdminEmptyState } from '../../adminUi';
import { PeoplePanel } from '../../peopleUi';
import type { StaffListPayload, StaffRow } from '../../peopleTypes';
import { buildStaffRowActions } from './StaffRowActions';

interface StaffDirectoryProps {
  ajaxUrl: string;
  csrfToken: string;
  onAccessSummary: (row: StaffRow) => void;
  onAdvancedEdit: (row: StaffRow) => void;
  onResetPassword: (row: StaffRow) => void;
  refreshKey?: number;
}

export function StaffDirectory({
  ajaxUrl,
  csrfToken,
  onAccessSummary,
  onAdvancedEdit,
  onResetPassword,
  refreshKey = 0,
}: StaffDirectoryProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<StaffListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await oeFetch<StaffListPayload>('admin.staff.list', {
        ajaxUrl,
        csrfToken,
        params: { page, page_size: 25, search, status },
      });
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load staff');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [ajaxUrl, csrfToken, page, search, status]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const deactivate = useCallback(async (row: StaffRow) => {
    if (!window.confirm(`Deactivate ${row.display_name || row.username}?`)) {
      return;
    }
    try {
      await oeFetch('admin.staff.deactivate', {
        ajaxUrl,
        csrfToken,
        json: { user_id: row.id },
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deactivate failed');
    }
  }, [ajaxUrl, csrfToken, load]);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / (data?.page_size ?? 25)));

  return (
    <PeoplePanel
      title="Staff directory"
      description="Search active clinic users. Use Add staff for onboarding; advanced edit for edge cases."
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <Label htmlFor="nc-staff-search">Search</Label>
          <Input
            id="nc-staff-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Name or username"
          />
        </div>
        <div>
          <Label htmlFor="nc-staff-status">Status</Label>
          <NativeSelect
            id="nc-staff-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(1);
            }}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </NativeSelect>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => { void load(); }}>
          Refresh
        </Button>
      </div>

      {error && <p className="text-sm text-[var(--color-oe-danger,#b91c1c)]">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading staff…</p>
      ) : !rows.length ? (
        <AdminEmptyState title="No staff match your filters" />
      ) : (
        <>
          <p className="text-sm text-[var(--oe-nc-text-muted)]">{total} match{total === 1 ? '' : 'es'}</p>
          <Table className={ncShadcnTableClass({ bordered: true })}>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Desks</TableHead>
                <TableHead aria-label="Actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.display_name || '—'}</TableCell>
                  <TableCell><code>{row.username}</code></TableCell>
                  <TableCell>{row.role_template_label ?? '—'}</TableCell>
                  <TableCell>{(row.desks ?? []).join(', ') || '—'}</TableCell>
                  <TableCell className="text-right">
                    <RowActionsMenu
                      label={`Actions for ${row.display_name || row.username}`}
                      items={buildStaffRowActions(row, {
                        onAccessSummary,
                        onDeactivate: (r) => { void deactivate(r); },
                        onAdvancedEdit,
                        onResetPassword,
                      })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-sm text-[var(--oe-nc-text-muted)]">Page {page} of {totalPages}</span>
            <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </>
      )}
    </PeoplePanel>
  );
}
