import type { CommLens, CommListRow, MessageListRow, ReminderListRow } from './communicationsTypes';
import { COMM_PAGE_SIZE } from './communicationsTypes';
import { PaginationBar } from '@components/PaginationBar';

interface CommunicationsListProps {
  lens: CommLens;
  rows: CommListRow[];
  selectedId: number | null;
  loading: boolean;
  error: string | null;
  onSelect: (id: number, type: 'message' | 'reminder') => void;
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
}: CommunicationsListProps) {
  if (loading) {
    return <div className="p-3 text-muted"><em>Loading…</em></div>;
  }
  if (error) {
    return <div className="p-3 text-danger">{error}</div>;
  }
  if (!rows.length) {
    return <div className="p-3 text-muted"><em>No items in this view.</em></div>;
  }

  return (
    <>
      {rows.map((row) => {
        const selected = selectedId === row.id;
        if (isMessageRow(row, lens)) {
          return (
            <button
              key={`msg-${row.id}`}
              type="button"
              className={`oe-nc-comm-row${selected ? ' is-selected' : ''}`}
              role="option"
              aria-selected={selected}
              onClick={() => onSelect(row.id, 'message')}
            >
              <div className="oe-nc-comm-row__title">
                {row.patient_name || row.type || 'Message'}
                {row.patient_unassigned && (
                  <span className="badge badge-warning oe-nc-comm-row__badge">No patient</span>
                )}
                {row.is_unread && (
                  <span className="badge badge-primary oe-nc-comm-row__badge"> New</span>
                )}
              </div>
              <div className="oe-nc-comm-row__meta">
                {row.from_name} · {row.date_display || row.date}
              </div>
              <div className="oe-nc-comm-row__meta">{row.status}</div>
            </button>
          );
        }

        const reminder = row as ReminderListRow;
        return (
          <button
            key={`rem-${reminder.id}`}
            type="button"
            className={`oe-nc-comm-row${selected ? ' is-selected' : ''}`}
            role="option"
            aria-selected={selected}
            onClick={() => onSelect(reminder.id, 'reminder')}
          >
            <div className="oe-nc-comm-row__title">
              {reminder.patient_name || 'Reminder'}
              <span className={`oe-nc-comm-urgency--${reminder.urgency} oe-nc-comm-row__badge`}>
                {' '}{reminder.urgency_label}
              </span>
            </div>
            <div className="oe-nc-comm-row__meta">
              {reminder.due_display || reminder.due_date} · {reminder.from_name}
            </div>
            <div className="oe-nc-comm-row__meta">{reminder.preview}</div>
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
      <div className="oe-nc-comm-pagination px-2 py-1 text-muted small">
        {total} item(s)
      </div>
    ) : null;
  }

  if (total <= COMM_PAGE_SIZE) {
    return total > 0 ? (
      <div className="oe-nc-comm-pagination px-2 py-1 text-muted small">
        {total} item(s)
      </div>
    ) : null;
  }

  const page = Math.floor(begin / COMM_PAGE_SIZE) + 1;

  return (
    <div className="oe-nc-comm-pagination px-2">
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
