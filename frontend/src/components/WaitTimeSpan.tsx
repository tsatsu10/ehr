/**
 * WaitTimeSpan — formats wait time with severity colour coding.
 *
 * - Normal: plain text
 * - ≥ 120 min or carry-over: amber (oe-nc-wait-medium)
 * - ≥ 240 min or prev-day visit: red (oe-nc-wait-long)
 *
 * Uses existing CSS severity classes from components.css.
 */

import { formatWaitLabel, waitSeverity } from '@core/formatWait';
import type { VisitCard } from '@core/types';

export interface WaitTimeSpanProps {
  card: Pick<VisitCard, 'wait_minutes' | 'wait_label' | 'visit_date'>;
  suffix?: string;
}

export function WaitTimeSpan({ card, suffix = '' }: WaitTimeSpanProps) {
  const label = card.wait_label || formatWaitLabel(card.wait_minutes);
  const text = `${label}${suffix}`;
  const severity = waitSeverity(card.wait_minutes, card.visit_date);

  if (severity === 'long') {
    return <span className="oe-nc-wait-long">{text}</span>;
  }
  if (severity === 'medium') {
    return <span className="oe-nc-wait-medium">{text}</span>;
  }
  return <>{text}</>;
}
