import type { ChartMessageRow, ChartMessagesData } from './patientChartTypes';

interface MessagesTabProps {
  data: ChartMessagesData | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  onLoadMore: () => void;
}

function MessageRow({ item }: { item: ChartMessageRow }) {
  const variant = item.active === false ? 'secondary' : 'info';

  return (
    <div className="border rounded p-2 mb-2">
      <div className="d-flex flex-wrap justify-content-between align-items-start">
        <div className="flex-grow-1">
          {item.detail_url ? (
            <a href={item.detail_url} target="_top">
              {item.title ?? 'Message'}
            </a>
          ) : (
            <strong>{item.title ?? '—'}</strong>
          )}
          {item.status && <span className={`badge badge-${variant} ml-2`}>{item.status}</span>}
          {item.assigned_to && (
            <span className="text-muted small"> → {item.assigned_to}</span>
          )}
          {item.preview && <div className="small text-muted mt-1">{item.preview}</div>}
          <div className="small text-muted mt-1">
            {item.author ?? '—'}
            {item.date ? ` · ${item.date}` : ''}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MessagesTab({ data, loading, loadingMore, error, onLoadMore }: MessagesTabProps) {
  if (loading) {
    return <em>Loading messages…</em>;
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  if (!data) return null;

  const urls = data.editor_urls ?? {};
  const messages = data.messages ?? [];
  const reminders = data.reminders ?? [];

  return (
    <>
      <p className="text-muted small">
        Chart-scoped messages and reminders for this patient. Use the clinic Communications hub for
        staff inbox across all patients.
      </p>

      <div className="d-flex flex-wrap mb-3">
        {urls.add_message && (
          <a className="btn btn-sm btn-primary mr-2 mb-2" href={urls.add_message} target="_top">
            New message
          </a>
        )}
        {urls.pnotes && (
          <a className="btn btn-sm btn-outline-secondary mr-2 mb-2" href={urls.pnotes} target="_top">
            Open all notes
          </a>
        )}
        {urls.dated_reminders && (
          <a className="btn btn-sm btn-outline-secondary mb-2" href={urls.dated_reminders} target="_top">
            Dated reminders
          </a>
        )}
      </div>

      <h5 className="mb-2">
        Messages <span className="text-muted small">({data.message_total ?? 0})</span>
      </h5>
      {messages.length === 0 ? (
        <p className="text-muted">No chart messages for this patient.</p>
      ) : (
        <div id="nc-chart-messages-list">
          {messages.map((item, idx) => (
            <MessageRow key={`msg-${item.title ?? idx}-${item.date ?? ''}`} item={item} />
          ))}
        </div>
      )}
      {data.has_more && (
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm mt-2"
          disabled={loadingMore}
          onClick={onLoadMore}
        >
          Load more
        </button>
      )}

      <h5 className="mb-2 mt-4">Reminders</h5>
      {reminders.length === 0 ? (
        <p className="text-muted mb-0">No reminders for this patient.</p>
      ) : (
        reminders.map((item, idx) => (
          <MessageRow key={`rem-${item.title ?? idx}-${item.date ?? ''}`} item={item} />
        ))
      )}
    </>
  );
}
