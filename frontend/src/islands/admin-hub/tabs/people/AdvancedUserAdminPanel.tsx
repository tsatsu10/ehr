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
import { AdminEmptyState } from '../../adminUi';
import type { GuidedAclTone } from '../../guidedAclTasks';
import type { PeopleSubTabId } from '../../peopleTypes';
import { PeopleWarningCallout } from '../../peopleUi';
import type { StaffListPayload, StaffUserDetail } from '../../peopleTypes';
import { PeopleViewShell } from './PeopleViewShell';

interface AdvancedUserAdminPanelProps {
  ajaxUrl: string;
  csrfToken: string;
  originSub: PeopleSubTabId;
  tone?: GuidedAclTone;
  onBack: () => void;
  initialUserId?: number;
  onResetPassword?: (userId: number) => void;
}

export function AdvancedUserAdminPanel({
  ajaxUrl,
  csrfToken,
  originSub,
  tone = 'advanced',
  onBack,
  initialUserId,
  onResetPassword,
}: AdvancedUserAdminPanelProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('all');
  const [list, setList] = useState<StaffListPayload | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(initialUserId ?? null);
  const [detail, setDetail] = useState<StaffUserDetail | null>(null);
  const [form, setForm] = useState({
    fname: '',
    lname: '',
    mname: '',
    email: '',
    active: true,
    facility_id: 0,
    groups: [] as string[],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await oeFetch<StaffListPayload>('admin.staff.list', {
        ajaxUrl,
        csrfToken,
        params: { page: 1, page_size: 100, search, status },
      });
      setList(data);
      if (!selectedId && data.rows?.[0]) {
        setSelectedId(data.rows[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [ajaxUrl, csrfToken, search, status, selectedId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void oeFetch<StaffUserDetail>('admin.staff.get', {
      ajaxUrl,
      csrfToken,
      params: { user_id: selectedId },
    })
      .then((data) => {
        setDetail(data);
        setForm({
          fname: data.fname,
          lname: data.lname,
          mname: data.mname,
          email: data.email,
          active: data.active,
          facility_id: data.facility_id,
          groups: [...(data.groups ?? [])],
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load user'));
  }, [ajaxUrl, csrfToken, selectedId]);

  const toggleGroup = (value: string) => {
    setForm((prev) => ({
      ...prev,
      groups: prev.groups.includes(value)
        ? prev.groups.filter((g) => g !== value)
        : [...prev.groups, value],
    }));
  };

  const save = async () => {
    if (!selectedId) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await oeFetch<StaffUserDetail>('admin.staff.update', {
        ajaxUrl,
        csrfToken,
        json: { user_id: selectedId, ...form },
      });
      setDetail(updated);
      setMessage('User saved');
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const allGroups = [
    ...(detail?.active_groups ?? []),
    ...(detail?.inactive_groups ?? []),
  ];

  return (
    <PeopleViewShell
      title="Advanced user admin"
      description="Full user record editor on the Staff tab — for Emergency Login and multi-group edge cases."
      originSub={originSub}
      tone={tone}
      onBack={onBack}
    >
      <PeopleWarningCallout>
        Emergency Login and superuser groups can lock users out of billing or stock admin. Change only when you know the impact.
      </PeopleWarningCallout>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <Label htmlFor="adv-search">Search</Label>
          <Input id="adv-search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="adv-status">Status</Label>
          <NativeSelect id="adv-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </NativeSelect>
        </div>
      </div>

      {error && <p className="text-sm text-[var(--color-oe-danger,#b91c1c)]">{error}</p>}
      {message && <p className="text-sm text-[var(--color-oe-cta,#047857)]">{message}</p>}

      {loading ? (
        <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading users…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">Users</h3>
            {!list?.rows?.length ? (
              <AdminEmptyState title="No users match" />
            ) : (
              <Table className={ncShadcnTableClass({ bordered: true })}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Username</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={selectedId === row.id ? 'bg-[var(--oe-nc-bg-tint,#f8fafc)]' : undefined}
                      onClick={() => setSelectedId(row.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <TableCell>{row.display_name}</TableCell>
                      <TableCell><code>{row.username}</code></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {detail && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Edit {detail.username}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="adv-fname">First name</Label>
                  <Input id="adv-fname" value={form.fname} onChange={(e) => setForm((f) => ({ ...f, fname: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="adv-lname">Last name</Label>
                  <Input id="adv-lname" value={form.lname} onChange={(e) => setForm((f) => ({ ...f, lname: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="adv-mname">Middle</Label>
                  <Input id="adv-mname" value={form.mname} onChange={(e) => setForm((f) => ({ ...f, mname: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="adv-email">Email</Label>
                  <Input id="adv-email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="adv-facility">Default facility</Label>
                  <NativeSelect
                    id="adv-facility"
                    value={String(form.facility_id)}
                    onChange={(e) => setForm((f) => ({ ...f, facility_id: Number(e.target.value) }))}
                  >
                    {(detail.facilities ?? []).map((fac) => (
                      <option key={fac.id} value={fac.id}>{fac.name}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    />
                    Active
                  </label>
                </div>
              </div>

              <div>
                <Label>Access groups</Label>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded border border-[var(--oe-nc-border)] p-2">
                  {allGroups.map((group) => (
                    <li key={group.value}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.groups.includes(group.value)}
                          onChange={() => toggleGroup(group.value)}
                        />
                        {group.label}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              <Button type="button" size="sm" disabled={saving} onClick={() => { void save(); }}>
                {saving ? 'Saving…' : 'Save user'}
              </Button>
              {onResetPassword && selectedId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onResetPassword(selectedId)}
                >
                  Reset password…
                </Button>
              ) : null}
            </div>
          )}
        </div>
      )}
    </PeopleViewShell>
  );
}
