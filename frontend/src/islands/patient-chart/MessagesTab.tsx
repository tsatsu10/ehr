import { MessageSquare, Plus } from 'lucide-react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import {
  ChartEmptyState,
  ChartLoadingState,
  ChartSection,
  ChartStack,
} from './chartUi';
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
    <article className="nc-chart-visit-row">
      <div className="flex flex-wrap justify-between gap-2">
        <div className="min-w-0 flex-1">
          {item.detail_url ? (
            <a
              href={item.detail_url}
              target="_top"
              className="font-medium text-[var(--oe-nc-primary)] hover:underline"
            >
              {item.title ?? 'Message'}
            </a>
          ) : (
            <strong className="text-sm">{item.title ?? '—'}</strong>
          )}
          {item.status && <Badge variant={variant} className="ml-2">{item.status}</Badge>}
          {item.assigned_to && (
            <span className="text-sm text-[var(--oe-nc-text-muted)]"> → {item.assigned_to}</span>
          )}
          {item.preview && (
            <div className="mt-1 text-sm text-[var(--oe-nc-text-muted)]">{item.preview}</div>
          )}
          <div className="mt-1 text-sm text-[var(--oe-nc-text-muted)]">
            {item.author ?? '—'}
            {item.date ? ` · ${item.date}` : ''}
          </div>
        </div>
      </div>
    </article>
  );
}

export function MessagesTab({ data, loading, loadingMore, error, onLoadMore }: MessagesTabProps) {
  if (loading) {
    return <ChartLoadingState label="Loading messages…" />;
  }

  if (error) {
    return <div className={deskCalloutClass('error')}>{error}</div>;
  }

  if (!data) return null;

  const urls = data.editor_urls ?? {};
  const messages = data.messages ?? [];
  const reminders = data.reminders ?? [];

  return (
    <ChartStack>
      <ChartSection
        title="Chart communications"
        description="Messages and reminders scoped to this patient"
        icon={<MessageSquare className="h-4 w-4" aria-hidden />}
        variant="muted"
        action={(
          <div className="flex flex-wrap gap-1">
            {urls.add_message && (
              <Button size="sm" asChild>
                <a href={urls.add_message} target="_top">
                  <Plus className="mr-1 h-4 w-4" aria-hidden />
                  New message
                </a>
              </Button>
            )}
            {urls.pnotes && (
              <Button variant="outline" size="sm" asChild>
                <a href={urls.pnotes} target="_top">All notes</a>
              </Button>
            )}
            {urls.dated_reminders && (
              <Button variant="outline" size="sm" asChild>
                <a href={urls.dated_reminders} target="_top">Reminders</a>
              </Button>
            )}
          </div>
        )}
      >
        <p className="mb-0 text-sm text-[var(--oe-nc-text-muted)]">
          Use the clinic Communications hub for staff inbox across all patients.
        </p>
      </ChartSection>

      <ChartSection
        title={`Messages (${data.message_total ?? 0})`}
        bodyClassName="pt-2"
      >
        {messages.length === 0 ? (
          <ChartEmptyState title="No chart messages for this patient" />
        ) : (
          <div id="nc-chart-messages-list" className="space-y-2">
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
            className="mt-3 cursor-pointer"
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        )}
      </ChartSection>

      <ChartSection title="Reminders">
        {reminders.length === 0 ? (
          <ChartEmptyState title="No reminders for this patient" />
        ) : (
          <div className="space-y-2">
            {reminders.map((item, idx) => (
              <MessageRow key={`rem-${item.title ?? idx}-${item.date ?? ''}`} item={item} />
            ))}
          </div>
        )}
      </ChartSection>
    </ChartStack>
  );
}
