import type { CommLens, CommListRow, MessageListRow, ReminderListRow } from './communicationsTypes';
import { COMM_PAGE_SIZE } from './communicationsTypes';
import { Badge } from '@components/ui/badge';
import { PaginationBar } from '@components/PaginationBar';
import { initialsFromName } from '@components/patientBannerUtils';
import { avatarColor } from './commAvatar';
import { t } from '@core/i18n';

interface CommunicationsListProps {
  lens: CommLens;
  rows: CommListRow[];
  selectedId: number | null;
  loading: boolean;
  error: string | null;
  onSelect: (id: number, type: 'message' | 'reminder') => void;
  /** Primary action offered from the empty state (New message / Create reminder). */
  onEmptyAction?: () => void;
}

function isMessageRow(_row: CommListRow, lens: CommLens): _row is MessageListRow {
  return lens === 'messages';
}

export function CommunicationsList({
  lens,
  rows,
  selectedId,
  loading,
  error,
  onSelect,
  onEmptyAction,
}: CommunicationsListProps) {
  // Only show the loading state when there is nothing to display — background
  // refreshes (the reminders poll, search retypes, manual refresh) keep the
  // current rows on screen instead of flashing skeletons and losing scroll.
  if (loading && !rows.length) {
    return (
      <div className="nc-comm-list-state" role="status" aria-label={t('Loading…')}>
        {[0, 1, 2].map((i) => (
          <div className="nc-comm-skeleton-row" key={i} aria-hidden="true">
            <span className="nc-comm-skeleton nc-comm-skeleton--avatar" />
            <span className="nc-comm-skeleton-lines">
              <span className="nc-comm-skeleton nc-comm-skeleton--line" />
              <span className="nc-comm-skeleton nc-comm-skeleton--line nc-comm-skeleton--short" />
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (error && !loading) {
    return <div className="nc-comm-list-state nc-comm-list-state--error">{error}</div>;
  }
  if (!rows.length) {
    return (
      <div className="nc-comm-list-state">
        <strong className="nc-comm-empty-title">
          {lens === 'messages' ? t('No messages') : t('No reminders')}
        </strong>
        <span>
          {lens === 'messages'
            ? t('Messages sent to you appear here.')
            : t('Reminders due in the next 30 days appear here.')}
        </span>
        {onEmptyAction && (
          <button type="button" className="nc-comm-empty-action" onClick={onEmptyAction}>
            {lens === 'messages' ? t('New message') : t('Create reminder')}
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      {rows.map((row) => {
        const selected = selectedId === row.id;
        if (isMessageRow(row, lens)) {
          const title = row.patient_name || row.type || t('Message');
          return (
            <button
              key={`msg-${row.id}`}
              type="button"
              className={`nc-comm-row${selected ? ' is-selected' : ''}${row.is_unread ? ' is-unread' : ''}`}
              role="option"
              aria-selected={selected}
              onClick={() => onSelect(row.id, 'message')}
            >
              <span
                className="nc-comm-avatar"
                style={{ background: avatarColor(row.from_name || title) }}
                aria-hidden="true"
              >
                {initialsFromName(title)}
              </span>
              {/* Compact two-line row (artifact chat-row): name + time on top,
                  "sender: preview" below — the sender folds into the preview
                  like a group-chat inbox instead of taking a third line. */}
              <span className="nc-comm-row-body">
                <span className="nc-comm-row-top">
                  <span className="nc-comm-row-name">{title}</span>
                  {row.patient_unassigned && (
                    <Badge variant="warning" className="nc-comm-row-badge nc-comm-row-badge--warn">
                      {t('No patient')}
                    </Badge>
                  )}
                  <span className="nc-comm-row-time">{row.date_display || row.date}</span>
                </span>
                <span className="nc-comm-row-sub">
                  <span className="nc-comm-row-preview">
                    {row.from_name
                      ? `${row.from_name}: ${row.preview || row.type || t('Message')}`
                      : (row.preview || row.type || t('Message'))}
                  </span>
                  {row.is_unread && <span className="nc-comm-unread-dot" aria-label={t('Unread')} />}
                </span>
              </span>
            </button>
          );
        }

        const reminder = row as ReminderListRow;
        return (
          <button
            key={`rem-${reminder.id}`}
            type="button"
            className={`nc-comm-row${selected ? ' is-selected' : ''}`}
            role="option"
            aria-selected={selected}
            onClick={() => onSelect(reminder.id, 'reminder')}
          >
            <span
              className="nc-comm-avatar"
              style={{ background: avatarColor(reminder.patient_name) }}
              aria-hidden="true"
            >
              {initialsFromName(reminder.patient_name || t('Reminder'))}
            </span>
            <span className="nc-comm-row-body">
              <span className="nc-comm-row-top">
                <span className="nc-comm-row-name">{reminder.patient_name || t('Reminder')}</span>
                <span className="nc-comm-row-time">{reminder.due_display || reminder.due_date}</span>
              </span>
              <span className="nc-comm-row-sub">
                <span className={`nc-comm-urgency--${reminder.urgency} nc-comm-row-urgency`}>
                  {reminder.urgency_label}
                </span>
                <span className="nc-comm-row-preview">{reminder.preview}</span>
              </span>
            </span>
          </button>
        );
      })}
    </>
  );
}

export function CommunicationsPagination({
  lens,
  total,
  begin,
  onPageChange,
}: {
  lens: CommLens;
  total: number;
  begin: number;
  onPageChange: (begin: number) => void;
}) {
  if (lens !== 'messages') {
    return total > 0 ? (
      <div className="nc-comm-pagination">
        {t('{count} item(s)', { count: String(total) })}
      </div>
    ) : null;
  }

  if (total <= COMM_PAGE_SIZE) {
    return total > 0 ? (
      <div className="nc-comm-pagination">
        {t('{count} item(s)', { count: String(total) })}
      </div>
    ) : null;
  }

  const page = Math.floor(begin / COMM_PAGE_SIZE) + 1;

  return (
    <div className="nc-comm-pagination px-2">
      <PaginationBar
        id="nc-comm-pagination"
        page={page}
        pageSize={COMM_PAGE_SIZE}
        total={total}
        onPageChange={(nextPage) => onPageChange((nextPage - 1) * COMM_PAGE_SIZE)}
      />
    </div>
  );
}
