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
import { PeopleWarningCallout } from '../../peopleUi';
import type { AclGroupListPayload, AclReturnValuesPayload } from '../../peopleTypes';
import { PeopleViewShell } from './PeopleViewShell';

interface GaclAdvancedPanelProps {
  ajaxUrl: string;
  csrfToken: string;
  originSub: PeopleSubTabId;
  tone?: GuidedAclTone;
  onBack: () => void;
}

export function GaclAdvancedPanel({
  ajaxUrl,
  csrfToken,
  originSub,
  tone = 'advanced',
  onBack,
}: GaclAdvancedPanelProps) {
  const [groups, setGroups] = useState<AclGroupListPayload['groups']>([]);
  const [returnValues, setReturnValues] = useState<AclReturnValuesPayload['return_values']>([]);
  const [createForm, setCreateForm] = useState({
    title: '',
    identifier: '',
    return_value: '',
    description: '',
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [groupData, returnData] = await Promise.all([
      oeFetch<AclGroupListPayload>('admin.acl.groups', { ajaxUrl, csrfToken }),
      oeFetch<AclReturnValuesPayload>('admin.acl.return_values', { ajaxUrl, csrfToken }),
    ]);
    setGroups(groupData.groups ?? []);
    setReturnValues(returnData.return_values ?? []);
    setCreateForm((f) => {
      if (!f.return_value && returnData.return_values?.[0]) {
        return { ...f, return_value: returnData.return_values[0].return_value };
      }
      return f;
    });
  }, [ajaxUrl, csrfToken]);

  useEffect(() => {
    void reload()
      .catch((err) => setError(err instanceof Error ? err.message : 'Load failed'))
      .finally(() => setLoading(false));
  }, [reload]);

  const createGroup = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const data = await oeFetch<AclGroupListPayload>('admin.acl.group_create', {
        ajaxUrl,
        csrfToken,
        json: createForm,
      });
      setGroups(data.groups ?? []);
      setMessage('ACL group created');
      setCreateForm({ title: '', identifier: '', return_value: createForm.return_value, description: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const removeGroup = async (title: string, returnValue: string) => {
    if (!window.confirm(`Remove ACL group "${title}"?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await oeFetch<AclGroupListPayload>('admin.acl.group_remove', {
        ajaxUrl,
        csrfToken,
        json: { title, return_value: returnValue },
      });
      setGroups(data.groups ?? []);
      setMessage('ACL group removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PeopleViewShell
      title="Advanced GACL"
      description="Create or remove ACL groups — expert use only."
      originSub={originSub}
      tone={tone}
      onBack={onBack}
    >
      <PeopleWarningCallout>
        Incorrect GACL changes can break login or expose stock billing screens. Use vendor support guidance before editing.
      </PeopleWarningCallout>

      {error && <p className="text-sm text-[var(--color-oe-danger,#b91c1c)]">{error}</p>}
      {message && <p className="text-sm text-[var(--color-oe-cta,#047857)]">{message}</p>}

      {loading ? (
        <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading GACL data…</p>
      ) : (
        <>
          <div>
            <h3 className="text-sm font-semibold">Existing groups</h3>
            <Table className={ncShadcnTableClass({ bordered: true })}>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Return value</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={`${group.value}-${group.return_value}`}>
                    <TableCell>{group.title}</TableCell>
                    <TableCell>{group.return_title}</TableCell>
                    <TableCell className="text-sm">{group.note}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy || group.value === 'Administrators'}
                        onClick={() => { void removeGroup(group.value, group.return_value); }}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-lg border border-[var(--oe-nc-border)] p-4">
            <h3 className="text-sm font-semibold">Create ACL group</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="gacl-title">Title</Label>
                <Input
                  id="gacl-title"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="gacl-id">Identifier</Label>
                <Input
                  id="gacl-id"
                  value={createForm.identifier}
                  onChange={(e) => setCreateForm((f) => ({ ...f, identifier: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="gacl-return">Return value</Label>
                <NativeSelect
                  id="gacl-return"
                  value={createForm.return_value}
                  onChange={(e) => setCreateForm((f) => ({ ...f, return_value: e.target.value }))}
                >
                  {returnValues.map((ret) => (
                    <option key={ret.return_value} value={ret.return_value}>{ret.title}</option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="gacl-desc">Description</Label>
                <Input
                  id="gacl-desc"
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
            <Button type="button" size="sm" className="mt-3" disabled={busy} onClick={() => { void createGroup(); }}>
              Create group
            </Button>
          </div>
        </>
      )}
    </PeopleViewShell>
  );
}
