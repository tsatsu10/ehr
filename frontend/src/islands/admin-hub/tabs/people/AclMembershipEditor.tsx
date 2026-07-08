import { useCallback, useEffect, useState } from 'react';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';
import { oeFetch } from '@core/oeFetch';
import type { GuidedAclTone } from '../../guidedAclTasks';
import type { PeopleSubTabId } from '../../peopleTypes';
import { PeopleWarningCallout } from '../../peopleUi';
import type { AclMembershipPayload, AclUserListPayload } from '../../peopleTypes';
import { AclDualListColumn } from './AclDualListColumn';
import { PeopleViewShell } from './PeopleViewShell';

interface AclMembershipEditorProps {
  ajaxUrl: string;
  csrfToken: string;
  originSub: PeopleSubTabId;
  tone?: GuidedAclTone;
  onBack: () => void;
}

export function AclMembershipEditor({
  ajaxUrl,
  csrfToken,
  originSub,
  tone = 'primary',
  onBack,
}: AclMembershipEditorProps) {
  const [users, setUsers] = useState<AclUserListPayload['users']>([]);
  const [username, setUsername] = useState('');
  const [membership, setMembership] = useState<AclMembershipPayload | null>(null);
  const [selectedActive, setSelectedActive] = useState<string[]>([]);
  const [selectedInactive, setSelectedInactive] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    void oeFetch<AclUserListPayload>('admin.acl.users', { ajaxUrl, csrfToken })
      .then((data) => {
        setUsers(data.users ?? []);
        if (data.users?.[0]) {
          setUsername(data.users[0].username);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Load failed'))
      .finally(() => setLoading(false));
  }, [ajaxUrl, csrfToken]);

  const loadMembership = useCallback(async () => {
    if (!username) {
      return;
    }
    setError(null);
    try {
      const data = await oeFetch<AclMembershipPayload>('admin.acl.membership', {
        ajaxUrl,
        csrfToken,
        params: { username },
      });
      setMembership(data);
      setWarnings(data.warnings ?? []);
      setSelectedActive([]);
      setSelectedInactive([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load membership');
      setMembership(null);
    }
  }, [ajaxUrl, csrfToken, username]);

  useEffect(() => {
    void loadMembership();
  }, [loadMembership]);

  const toggle = (list: 'active' | 'inactive', value: string) => {
    const setter = list === 'active' ? setSelectedActive : setSelectedInactive;
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const addGroups = async () => {
    if (!selectedInactive.length) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await oeFetch<AclMembershipPayload>('admin.acl.membership_add', {
        ajaxUrl,
        csrfToken,
        json: { username, groups: selectedInactive },
      });
      setMembership(data);
      setWarnings(data.warnings ?? []);
      setSelectedInactive([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add failed');
    } finally {
      setBusy(false);
    }
  };

  const removeGroups = async () => {
    if (!selectedActive.length) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await oeFetch<AclMembershipPayload>('admin.acl.membership_remove', {
        ajaxUrl,
        csrfToken,
        json: { username, groups: selectedActive },
      });
      setMembership(data);
      setWarnings(data.warnings ?? []);
      setSelectedActive([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setBusy(false);
    }
  };

  const activeItems = (membership?.active ?? []).map((g) => ({ id: g.value, label: g.label }));
  const inactiveItems = (membership?.inactive ?? []).map((g) => ({ id: g.value, label: g.label }));

  return (
    <PeopleViewShell
      title="Assign user to group"
      description="Membership editor — changes apply immediately (no Save button)."
      originSub={originSub}
      tone={tone}
      onBack={onBack}
    >
      {loading ? (
        <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading users…</p>
      ) : (
        <>
          <div className="max-w-md">
            <Label htmlFor="acl-user">User</Label>
            <NativeSelect
              id="acl-user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            >
              {users.map((user) => (
                <option key={user.username} value={user.username}>
                  {user.display_name || user.username} ({user.username})
                  {user.no_membership ? ' — no membership' : ''}
                </option>
              ))}
            </NativeSelect>
          </div>

          {warnings.map((w) => (
            <PeopleWarningCallout key={w}>{w}</PeopleWarningCallout>
          ))}
          {error && <p className="text-sm text-[var(--color-oe-danger,#b91c1c)]">{error}</p>}

          <div className="grid gap-4 lg:grid-cols-2">
            <AclDualListColumn
              title="Member of"
              hint="Select groups to remove, then click Remove selected."
              items={activeItems}
              selected={selectedActive}
              emptyLabel="No active groups"
              actionLabel="Remove selected"
              busy={busy}
              onToggle={(id) => toggle('active', id)}
              onAction={() => { void removeGroups(); }}
            />
            <AclDualListColumn
              title="Available groups"
              hint="Select groups to add, then click Add selected."
              items={inactiveItems}
              selected={selectedInactive}
              emptyLabel="No available groups"
              actionLabel="Add selected"
              actionVariant="default"
              busy={busy}
              onToggle={(id) => toggle('inactive', id)}
              onAction={() => { void addGroups(); }}
            />
          </div>
        </>
      )}
    </PeopleViewShell>
  );
}
