import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Textarea } from '@components/ui/textarea';
import { ConfirmModal } from '@components/ConfirmModal';
import { RowActionsMenu, type RowActionItem } from '@components/RowActionsMenu';
import { SegmentedControl } from '@components/SegmentedControl';
import { WidgetCard } from '@components/WidgetCard';
import { oeFetch } from '@core/oeFetch';
import { AdminEmptyState, AdminLoadingState } from '@islands/admin-hub/adminUi';
import { StickyNote } from 'lucide-react';
import type {
  OfficeNote,
  OfficeNoteFilter,
  OfficeNotesListResponse,
  OfficeNotesProps,
} from './officeNotesTypes';
import { formatNoteDateTime, OFFICE_NOTE_FILTERS } from './officeNotesUi';

export function OfficeNotes({ ajaxUrl, csrfToken, legacyUrl }: OfficeNotesProps) {
  const [notes, setNotes] = useState<OfficeNote[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<OfficeNoteFilter>('active');
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [compose, setCompose] = useState('');
  const [savingCompose, setSavingCompose] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<OfficeNote | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const loadNotes = useCallback(
    async (nextFilter: OfficeNoteFilter, nextOffset: number) => {
      setLoading(true);
      setListError(null);
      try {
        const data = await oeFetch<OfficeNotesListResponse>('onotes.list', {
          ...fetchOptions,
          params: { filter: nextFilter, offset: String(nextOffset) },
        });
        setNotes(data.notes);
        setTotal(data.total);
        setPageSize(data.page_size);
        setOffset(data.offset);
      } catch (err) {
        setListError(err instanceof Error ? err.message : 'Could not load notes');
      } finally {
        setLoading(false);
      }
    },
    [fetchOptions],
  );

  useEffect(() => {
    void loadNotes(filter, 0);
  }, [filter, loadNotes]);

  const changeFilter = (next: OfficeNoteFilter) => {
    if (next === filter) return;
    setEditingId(null);
    setFilter(next);
  };

  const submitCompose = async () => {
    const body = compose.trim();
    if (body === '') {
      setComposeError('Enter a note before saving.');
      return;
    }
    setComposeError(null);
    setSavingCompose(true);
    try {
      await oeFetch('onotes.save', { ...fetchOptions, json: { id: 0, body } });
      setCompose('');
      await loadNotes(filter, 0);
    } catch (err) {
      setComposeError(err instanceof Error ? err.message : 'Could not save note');
    } finally {
      setSavingCompose(false);
    }
  };

  const beginEdit = (note: OfficeNote) => {
    setEditingId(note.id);
    setEditBody(note.body);
    setEditError(null);
  };

  const submitEdit = async () => {
    if (editingId === null) return;
    const body = editBody.trim();
    if (body === '') {
      setEditError('Note text is required.');
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      await oeFetch('onotes.save', { ...fetchOptions, json: { id: editingId, body } });
      setEditingId(null);
      await loadNotes(filter, offset);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not save note');
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleArchive = async (note: OfficeNote) => {
    try {
      await oeFetch('onotes.archive', {
        ...fetchOptions,
        json: { id: note.id, active: !note.active },
      });
      await loadNotes(filter, offset);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Could not update note');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await oeFetch('onotes.delete', { ...fetchOptions, json: { id: pendingDelete.id } });
      setPendingDelete(null);
      // If we just removed the last row on a page, step back a page when possible.
      const nextOffset = notes.length === 1 && offset >= pageSize ? offset - pageSize : offset;
      await loadNotes(filter, nextOffset);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Could not delete note');
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const rowActions = (note: OfficeNote): RowActionItem[] => [
    { id: 'edit', label: 'Edit', onClick: () => beginEdit(note) },
    {
      id: 'archive',
      label: note.active ? 'Archive' : 'Restore',
      onClick: () => {
        void toggleArchive(note);
      },
    },
    {
      id: 'delete',
      label: 'Delete',
      destructive: true,
      onClick: () => setPendingDelete(note),
    },
  ];

  const hasPager = total > pageSize;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + notes.length, total);

  return (
    <div className="nc-office-notes space-y-4">
      <header className="nc-office-notes__intro">
        <div className="nc-office-notes__intro-lead">
          <StickyNote className="h-5 w-5" aria-hidden="true" />
          <p className="nc-office-notes__intro-text mb-0">
            Shared notes visible to all clinic staff — shift handovers, closures, reminders.
          </p>
        </div>
        {legacyUrl && (
          <a className="nc-office-notes__legacy-link" href={legacyUrl}>
            Open classic view
          </a>
        )}
      </header>

      <WidgetCard title="Add a note" bodyPad="pad">
        <Textarea
          aria-label="New office note"
          rows={3}
          placeholder="Write a note for the whole clinic…"
          value={compose}
          onChange={(e) => {
            setCompose(e.target.value);
            if (composeError) setComposeError(null);
          }}
        />
        {composeError && (
          <p className="nc-office-notes__message nc-office-notes__message--error" role="alert">
            {composeError}
          </p>
        )}
        <div className="nc-office-notes__compose-actions">
          <Button
            type="button"
            disabled={savingCompose || compose.trim() === ''}
            onClick={() => {
              void submitCompose();
            }}
          >
            {savingCompose ? 'Saving…' : 'Add note'}
          </Button>
        </div>
      </WidgetCard>

      <div className="nc-office-notes__toolbar">
        <SegmentedControl
          ariaLabel="Filter office notes"
          value={filter}
          onChange={(id) => changeFilter(id as OfficeNoteFilter)}
          segments={OFFICE_NOTE_FILTERS}
        />
        {!loading && total > 0 && (
          <span className="nc-office-notes__count">
            Showing {pageStart}–{pageEnd} of {total}
          </span>
        )}
      </div>

      {listError && (
        <p className="nc-office-notes__message nc-office-notes__message--error" role="alert">
          {listError}
        </p>
      )}

      {loading ? (
        <AdminLoadingState label="Loading office notes…" />
      ) : notes.length === 0 ? (
        <AdminEmptyState
          title="No notes here"
          description={
            filter === 'active'
              ? 'Add the first note above — it will show for every staff member.'
              : 'Nothing matches this filter yet.'
          }
        />
      ) : (
        <ul className="nc-office-notes__feed">
          {notes.map((note) => (
            <li key={note.id}>
              <WidgetCard bodyPad="pad" className="nc-office-notes__card">
                {editingId === note.id ? (
                  <div className="nc-office-notes__edit">
                    <Textarea
                      aria-label="Edit office note"
                      rows={4}
                      value={editBody}
                      onChange={(e) => {
                        setEditBody(e.target.value);
                        if (editError) setEditError(null);
                      }}
                    />
                    {editError && (
                      <p
                        className="nc-office-notes__message nc-office-notes__message--error"
                        role="alert"
                      >
                        {editError}
                      </p>
                    )}
                    <div className="nc-office-notes__compose-actions">
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingEdit || editBody.trim() === ''}
                        onClick={() => {
                          void submitEdit();
                        }}
                      >
                        {savingEdit ? 'Saving…' : 'Save'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={savingEdit}
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="nc-office-notes__card-head">
                      <div className="nc-office-notes__card-meta">
                        <span className="nc-office-notes__author">{note.user || 'Unknown'}</span>
                        <span className="nc-office-notes__date">
                          {formatNoteDateTime(note.date)}
                        </span>
                        {!note.active && <Badge variant="neutral">Archived</Badge>}
                      </div>
                      <RowActionsMenu
                        label={`Actions for note by ${note.user || 'unknown'}`}
                        items={rowActions(note)}
                      />
                    </div>
                    <p className="nc-office-notes__body mb-0">{note.body}</p>
                  </>
                )}
              </WidgetCard>
            </li>
          ))}
        </ul>
      )}

      {hasPager && !loading && (
        <div className="nc-office-notes__pager">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={offset <= 0}
            onClick={() => {
              void loadNotes(filter, Math.max(0, offset - pageSize));
            }}
          >
            Previous
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={offset + pageSize >= total}
            onClick={() => {
              void loadNotes(filter, offset + pageSize);
            }}
          >
            Next
          </Button>
        </div>
      )}

      <ConfirmModal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete this note?"
        confirmLabel="Delete note"
        confirmVariant="danger"
        submitting={deleting}
        submittingLabel="Deleting…"
        onConfirm={() => {
          void confirmDelete();
        }}
      >
        <p className="mb-0">
          This permanently removes the note for all staff. To hide it instead, use Archive.
        </p>
      </ConfirmModal>
    </div>
  );
}
