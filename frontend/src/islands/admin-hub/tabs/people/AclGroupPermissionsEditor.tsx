import { useCallback, useEffect, useState } from 'react';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';
import { oeFetch } from '@core/oeFetch';
import type { GuidedAclTone } from '../../guidedAclTasks';
import type { PeopleSubTabId } from '../../peopleTypes';
import { PeopleInfoCallout, PeopleWarningCallout } from '../../peopleUi';
import type { AclGroupListPayload, AclGroupPermissionsPayload } from '../../peopleTypes';
import { PeopleViewShell } from './PeopleViewShell';

interface AclGroupPermissionsEditorProps {
  ajaxUrl: string;
  csrfToken: string;
  originSub: PeopleSubTabId;
  tone?: GuidedAclTone;
  onBack: () => void;
}

export function AclGroupPermissionsEditor({
  ajaxUrl,
  csrfToken,
  originSub,
  tone = 'primary',
  onBack,
}: AclGroupPermissionsEditorProps) {
  const [groups, setGroups] = useState<AclGroupListPayload['groups']>([]);
  const [groupValue, setGroupValue] = useState('');
  const [returnValue, setReturnValue] = useState('');
  const [perms, setPerms] = useState<AclGroupPermissionsPayload | null>(null);
  const [selectedActive, setSelectedActive] = useState<string[]>([]);
  const [selectedInactive, setSelectedInactive] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    void oeFetch<AclGroupListPayload>('admin.acl.groups', { ajaxUrl, csrfToken })
      .then((data) => {
        setGroups(data.groups ?? []);
        if (data.groups?.[0]) {
          setGroupValue(data.groups[0].value);
          setReturnValue(data.groups[0].return_value);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Load failed'))
      .finally(() => setLoading(false));
  }, [ajaxUrl, csrfToken]);

  const onGroupChange = (value: string) => {
    setGroupValue(value);
    const match = groups.find((g) => g.value === value);
    if (match) {
      setReturnValue(match.return_value);
    }
  };

  const loadPermissions = useCallback(async () => {
    if (!groupValue || !returnValue) {
      return;
    }
    setError(null);
    try {
      const data = await oeFetch<AclGroupPermissionsPayload>('admin.acl.group_permissions', {
        ajaxUrl,
        csrfToken,
        params: { group: groupValue, return_value: returnValue },
      });
      setPerms(data);
      setWarnings(data.warnings ?? []);
      setSelectedActive([]);
      setSelectedInactive([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load permissions');
      setPerms(null);
    }
  }, [ajaxUrl, csrfToken, groupValue, returnValue]);

  useEffect(() => {
    void loadPermissions();
  }, [loadPermissions]);

  const toggleAco = (id: string, list: 'active' | 'inactive') => {
    const setter = list === 'active' ? setSelectedActive : setSelectedInactive;
    setter((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const addAcos = async () => {
    if (!selectedInactive.length) {
      return;
    }
    setBusy(true);
    try {
      const data = await oeFetch<AclGroupPermissionsPayload>('admin.acl.group_permissions_add', {
        ajaxUrl,
        csrfToken,
        json: { group: groupValue, return_value: returnValue, aco_ids: selectedInactive },
      });
      setPerms(data);
      setWarnings(data.warnings ?? []);
      setSelectedInactive([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add failed');
    } finally {
      setBusy(false);
    }
  };

  const removeAcos = async () => {
    if (!selectedActive.length) {
      return;
    }
    setBusy(true);
    try {
      const data = await oeFetch<AclGroupPermissionsPayload>('admin.acl.group_permissions_remove', {
        ajaxUrl,
        csrfToken,
        json: { group: groupValue, return_value: returnValue, aco_ids: selectedActive },
      });
      setPerms(data);
      setWarnings(data.warnings ?? []);
      setSelectedActive([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setBusy(false);
    }
  };

  const renderSections = (
    sections: AclGroupPermissionsPayload['active'],
    list: 'active' | 'inactive',
    selected: string[],
  ) => (
    <div className="space-y-3">
      {(sections ?? []).map((section) => (
        <div key={section.name}>
          <h4 className="text-sm font-medium">{section.name}</h4>
          <ul className="mt-1 space-y-1">
            {section.acos.map((aco) => (
              <li key={aco.id}>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(aco.id)}
                    onChange={() => toggleAco(aco.id, list)}
                  />
                  {aco.title}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );

  return (
    <PeopleViewShell
      title="Edit group permissions"
      description="Grant or revoke ACO permissions for a GACL group."
      originSub={originSub}
      tone={tone}
      onBack={onBack}
    >
      {loading ? (
        <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading groups…</p>
      ) : (
        <>
          <div className="max-w-md">
            <Label htmlFor="acl-group">Group</Label>
            <NativeSelect id="acl-group" value={groupValue} onChange={(e) => onGroupChange(e.target.value)}>
              {groups.map((group) => (
                <option key={`${group.value}-${group.return_value}`} value={group.value}>
                  {group.title} ({group.return_title})
                </option>
              ))}
            </NativeSelect>
          </div>

          {warnings.map((w) => (
            <PeopleWarningCallout key={w}>{w}</PeopleWarningCallout>
          ))}
          {error && <p className="text-sm text-[var(--color-oe-danger,#b91c1c)]">{error}</p>}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold">Active permissions</h3>
              <PeopleInfoCallout>Select to remove from this group.</PeopleInfoCallout>
              <div className="mt-2 max-h-80 overflow-y-auto rounded border border-[var(--oe-nc-border)] p-2">
                {renderSections(perms?.active ?? [], 'active', selectedActive)}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={busy || !selectedActive.length}
                onClick={() => { void removeAcos(); }}
              >
                Remove selected
              </Button>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Inactive permissions</h3>
              <PeopleInfoCallout>Select to grant to this group.</PeopleInfoCallout>
              <div className="mt-2 max-h-80 overflow-y-auto rounded border border-[var(--oe-nc-border)] p-2">
                {renderSections(perms?.inactive ?? [], 'inactive', selectedInactive)}
              </div>
              <Button
                type="button"
                size="sm"
                className="mt-2"
                disabled={busy || !selectedInactive.length}
                onClick={() => { void addAcos(); }}
              >
                Add selected
              </Button>
            </div>
          </div>
        </>
      )}
    </PeopleViewShell>
  );
}
