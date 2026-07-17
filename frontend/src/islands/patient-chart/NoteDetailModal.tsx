import { useEffect, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  dialogContentSizeClass,
} from '@components/ui/dialog';

interface NoteDetail {
  id: number;
  title: string;
  author: string;
  assigned_to: string;
  date: string | null;
  status: string | null;
  active: boolean;
  thread_html: string;
}

interface NoteDetailModalProps {
  open: boolean;
  onClose: () => void;
  ajaxUrl: string;
  csrfToken: string;
  pid: number;
  noteId: number | null;
}

/**
 * CP-5 — native read view of one patient note (thread), replacing the stock
 * pnotes screen jump. Read-only by design: any chart-authorised staff member
 * may view (stock parity); writing happens in the Communications hub.
 */
export function NoteDetailModal({ open, onClose, ajaxUrl, csrfToken, pid, noteId }: NoteDetailModalProps) {
  const [detail, setDetail] = useState<NoteDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !noteId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    (async () => {
      try {
        const data = await oeFetch<NoteDetail>('patients.note_detail', {
          ajaxUrl,
          csrfToken,
          params: { pid, note_id: noteId },
        });
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the note.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, noteId, ajaxUrl, csrfToken, pid]);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        id="nc-chart-note-detail"
        className={dialogContentSizeClass.confirm}
        aria-labelledby="nc-chart-note-detail-title"
      >
        <DialogHeader>
          <DialogTitle id="nc-chart-note-detail-title">
            {detail?.title ?? 'Message'}
          </DialogTitle>
          <DialogClose aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>
        <DialogBody>
          {error && <div className={deskCalloutClass('error', 'mb-3 py-2 text-sm')}>{error}</div>}
          {loading && <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading note…</p>}
          {detail && (
            <div className="space-y-2">
              <p className="mb-0 text-sm text-[var(--oe-nc-text-muted)]">
                {detail.author || '—'}
                {detail.date ? ` · ${detail.date}` : ''}
                {detail.assigned_to ? ` · → ${detail.assigned_to}` : ''}
                {detail.status && <Badge variant="neutral" className="ml-2">{detail.status}</Badge>}
                {!detail.active && <Badge variant="neutral" className="ml-2">Inactive</Badge>}
              </p>
              <div
                className="nc-chart-note-thread text-sm"
                // Server-rendered pnotes thread — escaped server-side BEFORE
                // linkifying (renderThreadHtml, unit-pinned), same renderer as
                // the Communications hub detail view.
                dangerouslySetInnerHTML={{ __html: detail.thread_html }}
              />
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
