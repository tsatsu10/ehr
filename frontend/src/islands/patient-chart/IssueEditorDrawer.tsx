import { useEffect, useMemo, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  sheetBodyClass,
} from '@components/ui/sheet';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { oeFetch } from '@core/oeFetch';

const TYPE_NOUN: Record<string, string> = {
  medical_problem: 'problem',
  allergy: 'allergy',
  medication: 'medication',
  medical_device: 'medical device',
  surgery: 'surgery',
  health_concern: 'health concern',
};

interface IssueGetResponse {
  id: number;
  type: string;
  title: string;
  begdate: string;
  enddate: string;
  comments: string;
  reaction: string;
  has_diagnosis_code: boolean;
  stock_editor_url: string;
}

interface IssueEditorDrawerProps {
  open: boolean;
  pid: number;
  /** Issue type (medical_problem | allergy | medication | …). */
  type: string;
  /** 0 = add new; >0 = edit that issue. */
  issueId: number;
  ajaxUrl: string;
  csrfToken: string;
  onClose: () => void;
  onSaved: () => void;
}

export function IssueEditorDrawer({
  open,
  pid,
  type,
  issueId,
  ajaxUrl,
  csrfToken,
  onClose,
  onSaved,
}: IssueEditorDrawerProps) {
  const [title, setTitle] = useState('');
  const [begdate, setBegdate] = useState('');
  const [enddate, setEnddate] = useState('');
  const [comments, setComments] = useState('');
  const [reaction, setReaction] = useState('');
  const [hasCode, setHasCode] = useState(false);
  const [stockEditorUrl, setStockEditorUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opts = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);
  const noun = TYPE_NOUN[type] ?? 'item';
  const isAllergy = type === 'allergy';

  useEffect(() => {
    if (!open) return;
    // Reset every open.
    setTitle('');
    setBegdate('');
    setEnddate('');
    setComments('');
    setReaction('');
    setHasCode(false);
    setStockEditorUrl('');
    setError(null);
    if (issueId <= 0) return;

    let cancelled = false;
    setLoading(true);
    oeFetch<IssueGetResponse>('patients.chart.issue_get', { ...opts, params: { pid, id: issueId } })
      .then((d) => {
        if (cancelled) return;
        setTitle(d.title ?? '');
        setBegdate(d.begdate ?? '');
        setEnddate(d.enddate ?? '');
        setComments(d.comments ?? '');
        setReaction(d.reaction ?? '');
        setHasCode(!!d.has_diagnosis_code);
        setStockEditorUrl(d.stock_editor_url ?? '');
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the record.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, issueId, pid, opts]);

  const save = async () => {
    if (title.trim() === '') { setError('A title is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      await oeFetch('patients.chart.issue_save', {
        ...opts,
        params: { pid },
        json: {
          issue: {
            id: issueId,
            type,
            title: title.trim(),
            begdate: begdate.trim(),
            enddate: enddate.trim(),
            comments: comments.trim(),
            ...(isAllergy ? { reaction: reaction.trim() } : {}),
          },
        },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent side="right" aria-labelledby="nc-issue-editor-title">
        <SheetHeader>
          <SheetTitle id="nc-issue-editor-title">
            {issueId > 0 ? `Edit ${noun}` : `Add ${noun}`}
          </SheetTitle>
        </SheetHeader>
        <div className={sheetBodyClass}>
          {loading ? (
            <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading…</p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="nc-issue-title">Title</Label>
                <Input
                  id="nc-issue-title"
                  maxLength={255}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="nc-issue-begdate">Onset date</Label>
                  <Input id="nc-issue-begdate" type="date" value={begdate} onChange={(e) => setBegdate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nc-issue-enddate">Resolved date</Label>
                  <Input id="nc-issue-enddate" type="date" value={enddate} onChange={(e) => setEnddate(e.target.value)} />
                </div>
              </div>
              {isAllergy && (
                <div className="space-y-1.5">
                  <Label htmlFor="nc-issue-reaction">Reaction</Label>
                  <Input
                    id="nc-issue-reaction"
                    maxLength={255}
                    value={reaction}
                    onChange={(e) => setReaction(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="nc-issue-comments">Comments</Label>
                <Textarea
                  id="nc-issue-comments"
                  rows={3}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                />
              </div>
              {hasCode && (
                <div className={deskCalloutClass('info', 'text-sm')} role="status">
                  This record has a coded diagnosis and other stock-only fields. They are kept as-is
                  here — use the stock editor to change the code, severity, or occurrence.
                </div>
              )}
              {error && (
                <div className={deskCalloutClass('error', 'text-sm')} id="nc-issue-error" role="alert">{error}</div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-[var(--oe-nc-border)] p-4">
          <div>
            {issueId > 0 && stockEditorUrl && (
              <Button variant="link" size="sm" className="h-auto p-0" asChild>
                <a href={stockEditorUrl} target="_top">
                  Full editor (delete, codes…)
                </a>
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="button" id="nc-issue-save" disabled={saving || loading} onClick={() => { void save(); }}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
