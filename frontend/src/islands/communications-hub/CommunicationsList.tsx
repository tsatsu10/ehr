import type { CommLens, CommListRow, MessageListRow, ReminderListRow } from './communicationsTypes';
import { COMM_PAGE_SIZE } from './communicationsTypes';
import { Badge } from '@components/ui/badge';
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
    return <div className="p-3 text-[var(--oe-nc-text-muted)]"><em>Loading…</em></div>;
  }
  if (error) {
    return <div className="p-3 text-[var(--oe-nc-danger,#dc2626)]">{error}</div>;
  }
  if (!rows.length) {
    return <div className="p-3 text-[var(--oe-nc-text-muted)]"><em>No items in this view.</em></div>;
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
              className={`nc-comm-row${selected ? ' is-selected' : ''}`}
              role="option"
              aria-selected={selected}
              onClick={() => onSelect(row.id, 'message')}
            >
              <div className="nc-comm-row-title">
                {row.patient_name || row.type || 'Message'}
                {row.patient_unassigned && (
                  <Badge variant="warning" className="nc-comm-row-badge">No patient</Badge>
                )}
                {row.is_unread && (
                  <Badge className="nc-comm-row-badge"> New</Badge>
                )}
              </div>
              <div className="nc-comm-row-meta">
                {row.from_name} · {row.date_display || row.date}
              </div>
              <div className="nc-comm-row-meta">{row.status}</div>
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
            <div className="nc-comm-row-title">
              {reminder.patient_name || 'Reminder'}
              <span className={`nc-comm-urgency--${reminder.urgency} nc-comm-row-badge`}>
                {' '}{reminder.urgency_label}
              </span>
            </div>
            <div className="nc-comm-row-meta">
              {reminder.due_display || reminder.due_date} · {reminder.from_name}
            </div>
            <div className="nc-comm-row-meta">{reminder.preview}</div>
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
      <div className="nc-comm-pagination px-2 py-1 text-[var(--oe-nc-text-muted)] text-sm">
        {total} item(s)
      </div>
    ) : null;
  }

  if (total <= COMM_PAGE_SIZE) {
    return total > 0 ? (
      <div className="nc-comm-pagination px-2 py-1 text-[var(--oe-nc-text-muted)] text-sm">
        {total} item(s)
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
