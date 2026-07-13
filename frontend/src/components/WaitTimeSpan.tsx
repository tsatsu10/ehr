/**
 * WaitTimeSpan — formats wait time with severity colour coding.
 *
 * - Normal: plain text
 * - ≥ 120 min or carry-over: amber
 * - ≥ 240 min or prev-day visit: red
 */

import { formatWaitLabel, waitSeverity } from '@core/formatWait';
import { useMinuteTick } from '@core/useMinuteTick';
import type { VisitCard } from '@core/types';
import { cn } from '@/lib/utils';

export interface WaitTimeSpanProps {
  card: Pick<VisitCard, 'wait_minutes' | 'wait_label' | 'visit_date'> & { started_at_epoch?: number | null };
  suffix?: string;
}

const SEVERITY_CLASS = {
  long: 'font-bold !text-[#dc2626]',
  medium: 'font-bold !text-[#d97706]',
} as const;

export function WaitTimeSpan({ card, suffix = '' }: WaitTimeSpanProps) {
  // SCALE-1.8 follow-up — current time from the shared ticker (refreshes ~every 30s),
  // so a client-computed wait stays live even when the delta poll returns "unchanged".
  const nowMs = useMinuteTick();

  // When the card carries a stable start epoch, compute the wait on the client so it
  // keeps advancing without a network refresh. Otherwise fall back to the
  // server-computed values (preserves behaviour for any card without the epoch).
  const hasEpoch = typeof card.started_at_epoch === 'number' && card.started_at_epoch > 0;
  const minutes = hasEpoch
    ? Math.max(0, Math.floor((nowMs / 1000 - (card.started_at_epoch as number)) / 60))
    : (card.wait_minutes ?? 0);
  const label = hasEpoch
    ? formatWaitLabel(minutes)
    : (card.wait_label || formatWaitLabel(card.wait_minutes ?? 0));
  const text = `${label}${suffix}`;
  const severity = waitSeverity(minutes, card.visit_date);

  if (severity === 'long' || severity === 'medium') {
    return (
      <span className={cn(SEVERITY_CLASS[severity])} data-wait-severity={severity}>
        {text}
      </span>
    );
  }
  return <>{text}</>;
}
