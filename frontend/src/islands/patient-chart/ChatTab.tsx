import { useCallback, useEffect, useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@components/ui/button';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ChartEmptyState, ChartLoadingState } from './chartUi';
import { listChat, sendChatMessage } from './chatApi';
import type { ChartChatMessage } from './patientChartTypes';

interface ChatTabProps {
  ajaxUrl: string;
  csrfToken: string;
  pid: number;
  active: boolean;
}

/** Stored MySQL datetime → regional DD/MM/YYYY HH:MM (no timezone shift). */
function formatChatTimestamp(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day, hour, minute] = match;
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

export function ChatTab({ ajaxUrl, csrfToken, pid, active }: ChatTabProps) {
  const ctx = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const [messages, setMessages] = useState<ChartChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const loadThread = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listChat(ctx, pid);
      setMessages(data.messages ?? []);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load messages.');
    } finally {
      setLoading(false);
    }
  }, [ctx, pid]);

  useEffect(() => {
    if (active && !loaded) {
      void loadThread();
    }
  }, [active, loaded, loadThread]);

  const doSend = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setSendError(null);
    try {
      const message = await sendChatMessage(ctx, pid, body);
      setMessages((prev) => [...prev, message]);
      setDraft('');
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not send message.');
    } finally {
      setSending(false);
    }
  }, [ctx, draft, pid, sending]);

  if (loading && !loaded) {
    return <ChartLoadingState label="Loading messages…" />;
  }

  return (
    <div className="nc-chart-chat">
      <div className={deskCalloutClass('info')} role="status">
        Messages here stay in the chart for staff. They are not sent to the patient&rsquo;s
        phone — SMS/WhatsApp delivery isn&rsquo;t connected yet.
      </div>

      {error && (
        <div className={deskCalloutClass('error')} role="alert">
          {error}
        </div>
      )}

      <div className="nc-chart-chat__thread">
        {messages.length === 0 ? (
          <ChartEmptyState
            title="No messages yet"
            description="Notes logged here will appear as a thread for this patient."
          />
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`nc-chart-chat__row nc-chart-chat__row--${message.direction}`}
            >
              <div className="nc-chart-chat__bubble">
                <p className="nc-chart-chat__bubble-body">{message.body}</p>
              </div>
              <div className="nc-chart-chat__meta">
                {message.author ? `${message.author} · ` : ''}
                {formatChatTimestamp(message.created_at)}
              </div>
            </div>
          ))
        )}
      </div>

      {sendError && (
        <div className={deskCalloutClass('error')} role="alert">
          {sendError}
        </div>
      )}

      <div className="nc-chart-chat__composer">
        <textarea
          className="nc-chart-chat__composer-input"
          rows={2}
          placeholder="Write a note for this patient's chart…"
          value={draft}
          disabled={sending}
          maxLength={2000}
          aria-label="Message"
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          disabled={sending || draft.trim() === ''}
          onClick={() => void doSend()}
        >
          <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {sending ? 'Sending…' : 'Send'}
        </Button>
      </div>
    </div>
  );
}
