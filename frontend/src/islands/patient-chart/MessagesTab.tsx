import { MessageSquare, Plus } from 'lucide-react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { NativeSelect } from '@components/ui/native-select';
import { Label } from '@components/ui/label';
import { useState } from 'react';
import { NoteDetailModal } from './NoteDetailModal';
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
  /** CP-5 — native note detail + activity filter (flag ON payload). */
  ajaxUrl: string;
  csrfToken: string;
  pid: number;
  activity: string;
  onActivityChange: (next: string) => void;
}

function MessageRow({ item, onOpen }: { item: ChartMessageRow; onOpen?: (id: number) => void }) {
  const variant = item.active === false ? 'neutral' : 'info';

  return (
    <article className="nc-chart-visit-row">
      <div className="flex flex-wrap justify-between gap-2">
        <div className="min-w-0 flex-1">
          {onOpen && item.id ? (
            <Button
              variant="link"
              className="h-auto p-0 font-medium"
              onClick={() => onOpen(item.id as number)}
            >
              {item.title ?? 'Message'}
            </Button>
          ) : item.detail_url ? (
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

export function MessagesTab({
  data,
  loading,
  loadingMore,
  error,
  onLoadMore,
  ajaxUrl,
  csrfToken,
  pid,
  activity,
  onActivityChange,
}: MessagesTabProps) {
  const [openNoteId, setOpenNoteId] = useState<number | null>(null);
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
        action={data.native_notes ? (
          <div className="flex items-center gap-2">
            <Label htmlFor="nc-chart-notes-filter" className="normal-case font-normal text-sm text-[var(--oe-nc-text-muted)]">
              Show
            </Label>
            <NativeSelect
              id="nc-chart-notes-filter"
              className="h-8 w-auto"
              value={activity}
              onChange={(e) => onActivityChange(e.target.value)}
            >
              <option value="all">All notes</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </NativeSelect>
          </div>
        ) : undefined}
      >
        {messages.length === 0 ? (
          <ChartEmptyState title="No chart messages for this patient" />
        ) : (
          <div id="nc-chart-messages-list" className="space-y-2">
            {messages.map((item, idx) => (
              <MessageRow
                key={`msg-${item.title ?? idx}-${item.date ?? ''}`}
                item={item}
                onOpen={data.native_notes ? (id) => setOpenNoteId(id) : undefined}
              />
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

      <NoteDetailModal
        open={openNoteId !== null}
        onClose={() => setOpenNoteId(null)}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        pid={pid}
        noteId={openNoteId}
      />
    </ChartStack>
  );
}
