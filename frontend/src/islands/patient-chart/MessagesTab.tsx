import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import type { ChartMessageRow, ChartMessagesData } from './patientChartTypes';

interface MessagesTabProps {
  data: ChartMessagesData | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  onLoadMore: () => void;
}

function MessageRow({ item }: { item: ChartMessageRow }) {
  const variant = item.active === false ? 'neutral' : 'info';

  return (
    <div className="border rounded p-2 mb-2">
      <div className="flex flex-wrap justify-between items-start">
        <div className="flex-grow">
          {item.detail_url ? (
            <a href={item.detail_url} target="_top">
              {item.title ?? 'Message'}
            </a>
          ) : (
            <strong>{item.title ?? '—'}</strong>
          )}
          {item.status && <Badge variant={variant} className="ml-2">{item.status}</Badge>}
          {item.assigned_to && (
            <span className="text-[var(--oe-nc-text-muted)] text-sm"> → {item.assigned_to}</span>
          )}
          {item.preview && <div className="text-sm text-[var(--oe-nc-text-muted)] mt-1">{item.preview}</div>}
          <div className="text-sm text-[var(--oe-nc-text-muted)] mt-1">
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
    return <div className={deskCalloutClass('error')}>{error}</div>;
  }

  if (!data) return null;

  const urls = data.editor_urls ?? {};
  const messages = data.messages ?? [];
  const reminders = data.reminders ?? [];

  return (
    <>
      <p className="text-[var(--oe-nc-text-muted)] text-sm">
        Chart-scoped messages and reminders for this patient. Use the clinic Communications hub for
        staff inbox across all patients.
      </p>

      <div className="flex flex-wrap mb-3">
        {urls.add_message && (
          <Button size="sm" className="mr-2 mb-2" asChild>
            <a href={urls.add_message} target="_top">
              New message
            </a>
          </Button>
        )}
        {urls.pnotes && (
          <Button variant="outline" size="sm" className="mr-2 mb-2" asChild>
            <a href={urls.pnotes} target="_top">
              Open all notes
            </a>
          </Button>
        )}
        {urls.dated_reminders && (
          <Button variant="outline" size="sm" className="mb-2" asChild>
            <a href={urls.dated_reminders} target="_top">
              Dated reminders
            </a>
          </Button>
        )}
      </div>

      <h5 className="mb-2">
        Messages <span className="text-[var(--oe-nc-text-muted)] text-sm">({data.message_total ?? 0})</span>
      </h5>
      {messages.length === 0 ? (
        <p className="text-[var(--oe-nc-text-muted)]">No chart messages for this patient.</p>
      ) : (
        <div id="nc-chart-messages-list">
          {messages.map((item, idx) => (
            <MessageRow key={`msg-${item.title ?? idx}-${item.date ?? ''}`} item={item} />
          ))}
        </div>
      )}
      {data.has_more && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          disabled={loadingMore}
          onClick={onLoadMore}
        >
          Load more
        </Button>
      )}

      <h5 className="mb-2 mt-4">Reminders</h5>
      {reminders.length === 0 ? (
        <p className="text-[var(--oe-nc-text-muted)] mb-0">No reminders for this patient.</p>
      ) : (
        reminders.map((item, idx) => (
          <MessageRow key={`rem-${item.title ?? idx}-${item.date ?? ''}`} item={item} />
        ))
      )}
    </>
  );
}
