import { useCallback, useEffect, useState } from 'react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';
import { oeFetch } from '@core/oeFetch';
import type { GuidedAclTone } from '../../guidedAclTasks';
import type { PeopleSubTabId, StaffListPayload } from '../../peopleTypes';
import { PeopleInfoCallout, PeopleWarningCallout } from '../../peopleUi';
import { PeopleViewShell } from './PeopleViewShell';

interface PasswordResetPanelProps {
  ajaxUrl: string;
  csrfToken: string;
  originSub: PeopleSubTabId;
  tone?: GuidedAclTone;
  initialUserId?: number;
  onBack: () => void;
}

export function PasswordResetPanel({
  ajaxUrl,
  csrfToken,
  originSub,
  tone = 'primary',
  initialUserId,
  onBack,
}: PasswordResetPanelProps) {
  const [users, setUsers] = useState<StaffListPayload['rows']>([]);
  const [userId, setUserId] = useState(initialUserId ?? 0);
  const [adminPassword, setAdminPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await oeFetch<StaffListPayload>('admin.staff.list', {
        ajaxUrl,
        csrfToken,
        params: { page: 1, page_size: 100, status: 'all' },
      });
      setUsers(data.rows ?? []);
      if (!userId && data.rows?.[0]) {
        setUserId(data.rows[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load staff');
    } finally {
      setLoading(false);
    }
  }, [ajaxUrl, csrfToken, userId]);

  useEffect(() => {
    if (initialUserId) {
      setUserId(initialUserId);
    }
  }, [initialUserId]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const selected = users.find((u) => u.id === userId);

  const submit = async () => {
    setError(null);
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }
    if (userId <= 0) {
      setError('Select a user');
      return;
    }
    setSaving(true);
    try {
      await oeFetch('admin.staff.reset_password', {
        ajaxUrl,
        csrfToken,
        json: {
          user_id: userId,
          admin_password: adminPassword,
          new_password: newPassword,
        },
      });
      setMessage(`Password updated for ${selected?.username ?? 'user'}`);
      setAdminPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PeopleViewShell
      title="Reset password"
      description="RB-08 — enter your own password to authorize, then set a new password for the staff member."
      originSub={originSub}
      tone={tone}
      onBack={onBack}
    >
      <PeopleWarningCallout>
        Require manager approval before resetting passwords. The user must log in with the new password immediately.
      </PeopleWarningCallout>

      {loading ? (
        <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading staff…</p>
      ) : (
        <div className="mx-auto max-w-md space-y-4">
          <div>
            <Label htmlFor="reset-user">Staff member</Label>
            <NativeSelect
              id="reset-user"
              value={String(userId)}
              onChange={(e) => setUserId(Number(e.target.value))}
            >
              {users.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.display_name} ({row.username}){row.active ? '' : ' — inactive'}
                </option>
              ))}
            </NativeSelect>
          </div>

          <PeopleInfoCallout>
            Your password confirms you are authorized to change credentials for{' '}
            <strong>{selected?.display_name || selected?.username || 'this user'}</strong>.
          </PeopleInfoCallout>

          <div>
            <Label htmlFor="reset-admin-pass">Your password</Label>
            <Input
              id="reset-admin-pass"
              type="password"
              autoComplete="current-password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="reset-new-pass">New password</Label>
            <Input
              id="reset-new-pass"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="reset-confirm-pass">Confirm new password</Label>
            <Input
              id="reset-confirm-pass"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-[var(--color-oe-danger,#b91c1c)]">{error}</p>}
          {message && <p className="text-sm text-[var(--color-oe-cta,#047857)]">{message}</p>}

          <Button type="button" disabled={saving} onClick={() => { void submit(); }}>
            {saving ? 'Saving…' : 'Reset password'}
          </Button>
        </div>
      )}
    </PeopleViewShell>
  );
}
