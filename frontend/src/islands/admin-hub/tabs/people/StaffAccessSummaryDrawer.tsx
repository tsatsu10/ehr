import { useEffect, useState } from 'react';
import { Button } from '@components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogContentSizeClass,
} from '@components/ui/dialog';
import { oeFetch } from '@core/oeFetch';
import type { StaffAccessSummary } from '../../peopleTypes';
import { PeopleWarningCallout } from '../../peopleUi';

interface StaffAccessSummaryDrawerProps {
  userId: number | null;
  ajaxUrl: string;
  csrfToken: string;
  onClose: () => void;
  onOpenMembership?: () => void;
}

export function StaffAccessSummaryDrawer({
  userId,
  ajaxUrl,
  csrfToken,
  onClose,
  onOpenMembership,
}: StaffAccessSummaryDrawerProps) {
  const [summary, setSummary] = useState<StaffAccessSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId === null) {
      setSummary(null);
      return;
    }
    setLoading(true);
    setError(null);
    void oeFetch<StaffAccessSummary>('admin.staff.access_summary', {
      ajaxUrl,
      csrfToken,
      params: { user_id: userId },
    }).then(setSummary).catch((err) => {
      setError(err instanceof Error ? err.message : 'Could not load access summary');
      setSummary(null);
    }).finally(() => setLoading(false));
  }, [userId, ajaxUrl, csrfToken]);

  return (
    <Dialog open={userId !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className={dialogContentSizeClass.confirm}>
        <DialogHeader>
          <DialogTitle>Access summary</DialogTitle>
          <DialogClose aria-label="Close"><span aria-hidden="true">&times;</span></DialogClose>
        </DialogHeader>
        <DialogBody>
          {loading && <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading…</p>}
          {error && <p className="text-sm text-[var(--color-oe-danger,#b91c1c)]">{error}</p>}
          {summary && (
            <div className="space-y-3 text-sm">
              <p><strong>{summary.display_name}</strong> (<code>{summary.username}</code>)</p>
              <p>Template: {summary.role_template?.label ?? '—'}</p>
              <p>Desk apps: {(summary.desk_apps ?? []).join(', ') || '—'}</p>
              <div>
                <p className="font-medium">Groups</p>
                <p className="text-[var(--oe-nc-text-muted)]">{(summary.groups ?? []).join(', ') || '—'}</p>
              </div>
              {(summary.sensitive_acos ?? []).length > 0 && (
                <div>
                  <p className="font-medium">Extra permissions</p>
                  <p className="text-[var(--oe-nc-text-muted)]">{summary.sensitive_acos.join(', ')}</p>
                </div>
              )}
              {(summary.warnings ?? []).map((warning) => (
                <PeopleWarningCallout key={warning}>{warning}</PeopleWarningCallout>
              ))}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          {summary && onOpenMembership && (
            <Button type="button" onClick={() => { onClose(); onOpenMembership(); }}>
              Open ACL editor
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
