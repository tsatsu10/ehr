import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@components/ui/button';
import { oeFetch } from '@core/oeFetch';
import { useInterval } from '@core/useInterval';
import { CommunicationsDetail } from './CommunicationsDetail';
import { CommunicationsList, CommunicationsPagination } from './CommunicationsList';
import { MessageComposePane } from './MessageComposePane';
import { ReminderCreatePane } from './ReminderCreatePane';
import { ReminderLogPane } from './ReminderLogPane';
import type {
  CommComposeMode,
  CommHubPreferences,
  CommLens,
  CommListRow,
  CommunicationsHubProps,
  HubCounts,
  MessageDetail,
  MessagesListResult,
  ReminderListRow,
  RemindersListResult,
} from './communicationsTypes';
import { COMM_PAGE_SIZE, COMM_POLL_MS } from './communicationsTypes';
import { readCommHubSelection, writeCommHubSelection } from './commHubSessionStorage';
import { useCommunicationsPageHeading } from './useCommunicationsPageHeading';

const EMPTY_COUNTS: HubCounts = { messages_active: 0, reminders_in_window: 0 };

const DEFAULT_PREFERENCES: CommHubPreferences = {
  lens: 'messages',
  activity: '1',
  scope: 'my',
  sort: { sortby: 'pnotes.date', sortorder: 'desc' },
};

export function CommunicationsHub({
  ajaxUrl,
  csrfToken,
  canViewAllUsers,
  initialLens,
  preferences = DEFAULT_PREFERENCES,
  webroot,
  composeLaunch = null,
}: CommunicationsHubProps) {
  const [lens, setLens] = useState<CommLens>(initialLens === 'reminders' ? 'reminders' : 'messages');
  const [counts, setCounts] = useState<HubCounts>(EMPTY_COUNTS);
  const [search, setSearch] = useState('');
  const [activity, setActivity] = useState(preferences.activity);
  const [showAll, setShowAll] = useState(preferences.scope === 'all_users' && canViewAllUsers);
  const [sort, setSort] = useState(preferences.sort);
  const [begin, setBegin] = useState(0);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<CommListRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<'message' | 'reminder' | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [messageDetail, setMessageDetail] = useState<MessageDetail | null>(null);
  const [reminderDetail, setReminderDetail] = useState<ReminderListRow | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<CommComposeMode>('idle');
  const [composeReplyId, setComposeReplyId] = useState<number | null>(null);
  const [composeAttachment, setComposeAttachment] = useState(composeLaunch?.attachment ?? null);
  const [composeSeedPid, setComposeSeedPid] = useState<number | null>(composeLaunch?.pid ?? null);
  const [statusChanging, setStatusChanging] = useState(false);
  const [assigningPatient, setAssigningPatient] = useState(false);
  const [selectionRestored, setSelectionRestored] = useState(false);
  const [forwardReminderId, setForwardReminderId] = useState<number | null>(null);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const persistPreferences = useCallback(async () => {
    try {
      await oeFetch('communications.save_preferences', {
        ...fetchOptions,
        method: 'POST',
        json: {
          lens,
          activity,
          scope: showAll && canViewAllUsers ? 'all_users' : 'my',
          sort,
        },
      });
    } catch {
      /* non-fatal */
    }
  }, [activity, canViewAllUsers, fetchOptions, lens, showAll, sort]);

  const refreshCounts = useCallback(async () => {
    try {
      const data = await oeFetch<HubCounts>('communications.hub_counts', fetchOptions);
      setCounts(data);
    } catch {
      /* non-fatal */
    }
  }, [fetchOptions]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      if (lens === 'messages') {
        const data = await oeFetch<MessagesListResult>('communications.messages_list', {
          ...fetchOptions,
          params: {
            activity,
            show_all: showAll ? '1' : '',
            sortby: sort.sortby,
            sortorder: sort.sortorder,
            begin,
            limit: COMM_PAGE_SIZE,
            q: search,
          },
        });
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
      } else {
        const data = await oeFetch<RemindersListResult>('communications.reminders_list', {
          ...fetchOptions,
          params: { days: 30 },
        });
        const reminderRows = data.rows ?? [];
        setRows(reminderRows);
        setTotal(data.total ?? reminderRows.length);
      }
    } catch (err) {
      setRows([]);
      setListError(err instanceof Error ? err.message : 'Could not load list');
    } finally {
      setListLoading(false);
    }
  }, [activity, begin, fetchOptions, lens, search, showAll, sort]);

  const loadMessageDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    setMessageDetail(null);
    setReminderDetail(null);
    try {
      const data = await oeFetch<MessageDetail>('communications.message_detail', {
        ...fetchOptions,
        params: { id },
      });
      setMessageDetail(data);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Could not load message');
    } finally {
      setDetailLoading(false);
    }
  }, [fetchOptions]);

  const loadDetail = useCallback((id: number, type: 'message' | 'reminder') => {
    if (type === 'reminder') {
      setDetailLoading(false);
      setDetailError(null);
      setMessageDetail(null);
      const match = rows.find((r) => r.id === id) as ReminderListRow | undefined;
      setReminderDetail(match ?? null);
      if (!match) {
        setDetailError('Reminder not found or already completed.');
      }
      return;
    }
    void loadMessageDetail(id);
  }, [loadMessageDetail, rows]);

  const handleRefresh = useCallback(() => {
    void refreshCounts();
    void loadList();
    if (selectedId && selectedType === 'message') {
      void loadMessageDetail(selectedId);
    }
  }, [loadList, loadMessageDetail, refreshCounts, selectedId, selectedType]);

  useEffect(() => {
    if (!composeLaunch?.open_compose) {
      return;
    }
    setLens('messages');
    setComposeMode('new');
    setComposeReplyId(null);
    setComposeAttachment(composeLaunch.attachment ?? null);
    setComposeSeedPid(composeLaunch.pid ?? null);
    setSelectedId(null);
    setSelectedType(null);
    setMessageDetail(null);
    setReminderDetail(null);
    setDetailError(null);
    setMobileDetailOpen(true);
  }, [composeLaunch]);

  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const skipPrefsPersistRef = useRef(true);

  useEffect(() => {
    if (skipPrefsPersistRef.current) {
      skipPrefsPersistRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void persistPreferences();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [persistPreferences]);

  useEffect(() => {
    if (selectionRestored || listLoading || composeLaunch?.open_compose) {
      return;
    }
    const stored = readCommHubSelection();
    if (!stored || stored.lens !== lens) {
      setSelectionRestored(true);
      return;
    }
    const exists = rows.some((row) => row.id === stored.selectedId);
    if (!exists) {
      writeCommHubSelection(null);
      setSelectionRestored(true);
      return;
    }
    setSelectedId(stored.selectedId);
    setSelectedType(stored.selectedType);
    setMobileDetailOpen(true);
    loadDetail(stored.selectedId, stored.selectedType);
    setSelectionRestored(true);
  }, [
    composeLaunch?.open_compose,
    lens,
    listLoading,
    loadDetail,
    rows,
    selectionRestored,
  ]);

  useEffect(() => {
    if (selectedId && selectedType) {
      writeCommHubSelection({ lens, selectedId, selectedType });
      return;
    }
    writeCommHubSelection(null);
  }, [lens, selectedId, selectedType]);

  useInterval(
    () => { handleRefresh(); },
    lens === 'reminders' ? COMM_POLL_MS : null
  );

  const switchLens = useCallback((next: CommLens) => {
    setLens(next);
    setSelectedId(null);
    setSelectedType(null);
    setMessageDetail(null);
    setReminderDetail(null);
    setDetailError(null);
    setBegin(0);
    setMobileDetailOpen(false);
    setComposeMode('idle');
    setComposeReplyId(null);
    setSelectionRestored(false);
    writeCommHubSelection(null);
  }, []);

  useCommunicationsPageHeading({
    lens,
    counts,
    canViewAllUsers,
    activity,
    showAll,
    onLensChange: switchLens,
    onSearchChange: (q) => {
      setSearch(q);
      setBegin(0);
    },
    onActivityChange: (value) => {
      setActivity(value);
      setBegin(0);
    },
    onShowAllChange: (value) => {
      setShowAll(value);
      setBegin(0);
    },
    sort,
    onSortChange: (nextSort) => {
      setSort(nextSort);
      setBegin(0);
    },
    onRefresh: handleRefresh,
  });

  const handleSelect = useCallback((id: number, type: 'message' | 'reminder') => {
    setComposeMode('idle');
    setComposeReplyId(null);
    setSelectedId(id);
    setSelectedType(type);
    setMobileDetailOpen(true);
    loadDetail(id, type);
  }, [loadDetail]);

  const openCompose = useCallback(() => {
    setComposeMode('new');
    setComposeReplyId(null);
    setComposeAttachment(null);
    setComposeSeedPid(null);
    setSelectedId(null);
    setSelectedType(null);
    setMessageDetail(null);
    setReminderDetail(null);
    setDetailError(null);
    setMobileDetailOpen(true);
  }, []);

  const openReply = useCallback((noteId: number) => {
    setComposeMode('reply');
    setComposeReplyId(noteId);
    setMobileDetailOpen(true);
  }, []);

  const closeCompose = useCallback(() => {
    setComposeMode('idle');
    setComposeReplyId(null);
    if (!selectedId) {
      setMobileDetailOpen(false);
    }
  }, [selectedId]);

  const openReminderCreate = useCallback(() => {
    setForwardReminderId(null);
    setComposeMode('reminder_create');
    setComposeReplyId(null);
    setSelectedId(null);
    setSelectedType(null);
    setMessageDetail(null);
    setReminderDetail(null);
    setDetailError(null);
    setMobileDetailOpen(true);
  }, []);

  const openReminderForward = useCallback((reminderId: number) => {
    setForwardReminderId(reminderId);
    setComposeMode('reminder_create');
    setComposeReplyId(null);
    setMobileDetailOpen(true);
  }, []);

  const openReminderLog = useCallback(() => {
    setComposeMode('reminder_log');
    setComposeReplyId(null);
    setSelectedId(null);
    setSelectedType(null);
    setMessageDetail(null);
    setReminderDetail(null);
    setDetailError(null);
    setMobileDetailOpen(true);
  }, []);

  const closeSubPane = useCallback(() => {
    setComposeMode('idle');
    setForwardReminderId(null);
    if (!selectedId) {
      setMessageDetail(null);
      setReminderDetail(null);
      setDetailError(null);
      setMobileDetailOpen(false);
    }
  }, [selectedId]);

  const handleReminderCreated = useCallback(() => {
    setComposeMode('idle');
    setForwardReminderId(null);
    setSelectedId(null);
    setSelectedType(null);
    setMessageDetail(null);
    setReminderDetail(null);
    setDetailError(null);
    void refreshCounts();
    void loadList();
  }, [loadList, refreshCounts]);

  const handleMessageSent = useCallback((messageId: number) => {
    setComposeMode('idle');
    setComposeReplyId(null);
    setComposeAttachment(null);
    setComposeSeedPid(null);
    setSelectedId(messageId);
    setSelectedType('message');
    setMobileDetailOpen(true);
    void refreshCounts();
    void loadList();
    void loadMessageDetail(messageId);
  }, [loadList, loadMessageDetail, refreshCounts]);

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    setSelectedType(null);
    setMessageDetail(null);
    setReminderDetail(null);
    setDetailError(null);
    setMobileDetailOpen(false);
    writeCommHubSelection(null);
  }, []);

  const markMessageDone = useCallback(async () => {
    if (!selectedId) return;
    try {
      await oeFetch('communications.message_done', {
        ...fetchOptions,
        json: { noteid: selectedId },
      });
      clearSelection();
      void refreshCounts();
      void loadList();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not mark message done');
    }
  }, [clearSelection, fetchOptions, loadList, refreshCounts, selectedId]);

  const markReminderDone = useCallback(async () => {
    if (!selectedId) return;
    try {
      await oeFetch('communications.reminder_done', {
        ...fetchOptions,
        json: { dr_id: selectedId },
      });
      clearSelection();
      void refreshCounts();
      void loadList();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not complete reminder');
    }
  }, [clearSelection, fetchOptions, loadList, refreshCounts, selectedId]);

  const handleStatusChange = useCallback(async (noteId: number, status: string) => {
    setStatusChanging(true);
    try {
      await oeFetch('communications.message_status', {
        ...fetchOptions,
        method: 'POST',
        json: { noteid: noteId, message_status: status },
      });
      void refreshCounts();
      void loadList();
      void loadMessageDetail(noteId);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not update message status');
    } finally {
      setStatusChanging(false);
    }
  }, [fetchOptions, loadList, loadMessageDetail, refreshCounts]);

  const handleAssignPatient = useCallback(async (noteId: number, pid: number) => {
    setAssigningPatient(true);
    try {
      await oeFetch('communications.assign_patient', {
        ...fetchOptions,
        method: 'POST',
        json: { noteid: noteId, pid },
      });
      void refreshCounts();
      void loadList();
      void loadMessageDetail(noteId);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not assign patient');
    } finally {
      setAssigningPatient(false);
    }
  }, [fetchOptions, loadList, loadMessageDetail, refreshCounts]);

  const handleDeleteMessage = useCallback(async (noteId: number) => {
    try {
      await oeFetch('communications.message_delete', {
        ...fetchOptions,
        method: 'POST',
        json: { noteid: noteId },
      });
      clearSelection();
      void refreshCounts();
      void loadList();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not delete message');
    }
  }, [clearSelection, fetchOptions, loadList, refreshCounts]);

  const showMarkDone = composeMode === 'idle' && lens === 'messages' && selectedType === 'message' && messageDetail?.can_mark_done;
  const showReminderComplete = composeMode === 'idle' && lens === 'reminders' && selectedId !== null;

  const listRef = useRef<HTMLDivElement>(null);

  const moveSelection = useCallback((delta: number) => {
    if (!rows.length) {
      return;
    }
    const currentIndex = selectedId !== null
      ? rows.findIndex((row) => row.id === selectedId)
      : -1;
    let nextIndex = currentIndex + delta;
    if (nextIndex < 0) {
      nextIndex = rows.length - 1;
    } else if (nextIndex >= rows.length) {
      nextIndex = 0;
    }
    const row = rows[nextIndex];
    const type = lens === 'messages' ? 'message' : 'reminder';
    handleSelect(row.id, type);
  }, [handleSelect, lens, rows, selectedId]);

  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) {
      return undefined;
    }

    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveSelection(1);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelection(-1);
        return;
      }
      if (event.key === 'Enter' && selectedId === null && rows.length > 0 && composeMode === 'idle') {
        event.preventDefault();
        const type = lens === 'messages' ? 'message' : 'reminder';
        handleSelect(rows[0].id, type);
        return;
      }
      if (event.key === 'Escape' && mobileDetailOpen) {
        event.preventDefault();
        setMobileDetailOpen(false);
      }
    };

    listEl.addEventListener('keydown', handler);
    return () => listEl.removeEventListener('keydown', handler);
  }, [
    composeMode,
    handleSelect,
    lens,
    mobileDetailOpen,
    moveSelection,
    rows,
    selectedId,
  ]);

  return (
    <div className={`nc-comm-hub${mobileDetailOpen ? ' is-detail-open' : ''}`} id="nc-communications-hub">
      <div className="nc-comm-split">
        <section className="nc-comm-list-pane" aria-label="List">
          <div
            ref={listRef}
            className="nc-comm-list"
            id="nc-comm-list"
            role="listbox"
            tabIndex={0}
            aria-label="Items"
            aria-live="polite"
          >
            <CommunicationsList
              lens={lens}
              rows={rows}
              selectedId={selectedId}
              loading={listLoading}
              error={listError}
              onSelect={handleSelect}
            />
          </div>
          <CommunicationsPagination
            lens={lens}
            total={total}
            begin={begin}
            onPageChange={setBegin}
          />
        </section>

        <section className="nc-comm-detail-pane" id="nc-comm-detail-pane" aria-label="Detail">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="nc-hidden-md nc-comm-back h-auto p-0"
            id="nc-comm-back"
            onClick={() => setMobileDetailOpen(false)}
          >
            <i className="fa fa-arrow-left" aria-hidden="true" /> Back to list
          </Button>
          <div id="nc-comm-detail" className="nc-comm-detail">
            {composeMode === 'new' || composeMode === 'reply' ? (
              <MessageComposePane
                ajaxUrl={ajaxUrl}
                csrfToken={csrfToken}
                replyNoteId={composeMode === 'reply' ? composeReplyId : null}
                attachment={composeMode === 'new' ? composeAttachment : null}
                initialPid={composeMode === 'new' ? composeSeedPid : null}
                onCancel={closeCompose}
                onSent={handleMessageSent}
              />
            ) : composeMode === 'reminder_create' ? (
              <ReminderCreatePane
                ajaxUrl={ajaxUrl}
                csrfToken={csrfToken}
                forwardReminderId={forwardReminderId}
                onCancel={closeSubPane}
                onCreated={handleReminderCreated}
              />
            ) : composeMode === 'reminder_log' ? (
              <ReminderLogPane
                ajaxUrl={ajaxUrl}
                csrfToken={csrfToken}
                onClose={closeSubPane}
              />
            ) : (
              <CommunicationsDetail
                loading={detailLoading}
                error={detailError}
                message={messageDetail}
                reminder={reminderDetail}
                webroot={webroot}
                ajaxUrl={ajaxUrl}
                csrfToken={csrfToken}
                onReply={openReply}
                onStatusChange={(noteId, status) => { void handleStatusChange(noteId, status); }}
                onAssignPatient={(noteId, pid) => { void handleAssignPatient(noteId, pid); }}
                onDelete={(noteId) => { void handleDeleteMessage(noteId); }}
                onForwardReminder={openReminderForward}
                statusChanging={statusChanging}
                assigningPatient={assigningPatient}
              />
            )}
          </div>
        </section>
      </div>

      <footer className="nc-comm-footer" id="nc-comm-footer">
        {showMarkDone && (
          <Button type="button" size="sm" id="nc-comm-mark-done" onClick={() => { void markMessageDone(); }}>
            Mark done
          </Button>
        )}
        {showReminderComplete && (
          <Button type="button" size="sm" id="nc-comm-reminder-complete" onClick={() => { void markReminderDone(); }}>
            Mark completed
          </Button>
        )}
        {lens === 'reminders' && composeMode === 'idle' && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              id="nc-comm-create-reminder"
              onClick={openReminderCreate}
            >
              Create reminder
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              id="nc-comm-view-log"
              onClick={openReminderLog}
            >
              View log
            </Button>
          </>
        )}
        {lens === 'messages' && composeMode === 'idle' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            id="nc-comm-compose-link"
            onClick={openCompose}
          >
            Compose
          </Button>
        )}
      </footer>
    </div>
  );
}
