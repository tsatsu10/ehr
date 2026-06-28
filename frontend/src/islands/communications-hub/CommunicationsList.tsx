import type { CommLens, CommListRow, MessageListRow, ReminderListRow } from './communicationsTypes';
import { COMM_PAGE_SIZE } from './communicationsTypes';

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
  if (lens !== 'messages' || total <= COMM_PAGE_SIZE) {
    return total > 0 ? (
      <div className="oe-nc-comm-pagination d-flex justify-content-between align-items-center">
        <span>{total} item(s)</span>
        <span />
      </div>
    ) : null;
  }

  const from = begin + 1;
  const to = Math.min(begin + COMM_PAGE_SIZE, total);

  return (
    <div className="oe-nc-comm-pagination d-flex justify-content-between align-items-center" id="nc-comm-pagination">
      <button
        type="button"
        className="btn btn-link btn-sm p-0"
        disabled={begin <= 0}
        onClick={() => onPageChange(Math.max(0, begin - COMM_PAGE_SIZE))}
      >
        &laquo; Prev
      </button>
      <span>{from}–{to} of {total}</span>
      <button
        type="button"
        className="btn btn-link btn-sm p-0"
        disabled={begin + COMM_PAGE_SIZE >= total}
        onClick={() => onPageChange(begin + COMM_PAGE_SIZE)}
      >
        Next &raquo;
      </button>
    </div>
  );
}
