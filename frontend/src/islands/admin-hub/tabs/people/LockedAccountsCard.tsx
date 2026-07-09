/**
 * Locked-accounts indicator (login brute-force hardening).
 *
 * Shows staff currently blocked by core's failed-login counter and lets an
 * admin clear the counter — no email reset links (staff accounts are
 * admin-managed; clinics may lack SMTP). Renders nothing when no one is
 * locked or the feature is off.
 */

import { useCallback, useEffect, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { showDeskToast } from '@components/deskToast';
import { Button } from '@components/ui/button';
import { oeFetch } from '@core/oeFetch';

interface LockedAccountRow {
  user_id: number;
  username: string;
  display_name: string;
  fail_counter: number;
  auto_unlock_in_seconds: number | null;
}

interface LockedAccountsPayload {
  enabled: boolean;
  items: LockedAccountRow[];
  max_failed_logins: number;
  window_seconds: number;
}

interface LockedAccountsCardProps {
  ajaxUrl: string;
  csrfToken: string;
  refreshKey?: number;
}

function formatWait(seconds: number | null): string {
  if (seconds === null) {
    return 'until unlocked by an admin';
  }
  if (seconds <= 0) {
    return 'auto-unlock imminent';
  }
  const minutes = Math.ceil(seconds / 60);
  return `auto-unlocks in ~${minutes} min`;
}

export function LockedAccountsCard({ ajaxUrl, csrfToken, refreshKey = 0 }: LockedAccountsCardProps) {
  const [data, setData] = useState<LockedAccountsPayload | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const payload = await oeFetch<LockedAccountsPayload>('admin.staff.locked_list', {
        ajaxUrl,
        csrfToken,
      });
      setData(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load locked accounts.');
    }
  }, [ajaxUrl, csrfToken]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const unlock = useCallback(
    async (row: LockedAccountRow) => {
      setBusyUserId(row.user_id);
      try {
        const payload = await oeFetch<LockedAccountsPayload>('admin.staff.unlock', {
          method: 'POST',
          ajaxUrl,
          csrfToken,
          json: { user_id: row.user_id },
        });
        setData(payload);
        showDeskToast(`${row.display_name || row.username} unlocked`, 'success');
      } catch (err) {
        showDeskToast(err instanceof Error ? err.message : 'Unlock failed', 'danger');
      } finally {
        setBusyUserId(null);
      }
    },
    [ajaxUrl, csrfToken],
  );

  if (error) {
    return <div className={deskCalloutClass('error', 'mb-3')}>{error}</div>;
  }
  if (!data?.enabled || data.items.length === 0) {
    return null;
  }

  return (
    <div id="nc-locked-accounts" className={deskCalloutClass('warn', 'mb-3')}>
      <p className="mb-2 font-semibold">
        {data.items.length === 1
          ? '1 account is locked after repeated failed logins'
          : `${data.items.length} accounts are locked after repeated failed logins`}
      </p>
      <ul className="mb-0 list-none space-y-1 p-0">
        {data.items.map((row) => (
          <li key={row.user_id} className="flex flex-wrap items-center gap-2">
            <span>
              <strong>{row.display_name || row.username}</strong>{' '}
              <span className="text-sm text-[var(--oe-nc-text-muted)]">
                ({row.username} · {row.fail_counter} failed attempts · {formatWait(row.auto_unlock_in_seconds)})
              </span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busyUserId === row.user_id}
              onClick={() => {
                void unlock(row);
              }}
            >
              {busyUserId === row.user_id ? 'Unlocking…' : 'Unlock now'}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
