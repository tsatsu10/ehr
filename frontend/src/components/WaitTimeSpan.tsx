/**
 * WaitTimeSpan — formats wait time with severity colour coding.
 *
 * - Normal: plain text
 * - ≥ 120 min or carry-over: amber
 * - ≥ 240 min or prev-day visit: red
 */

import { formatWaitLabel, waitSeverity } from '@core/formatWait';
import type { VisitCard } from '@core/types';
import { cn } from '@/lib/utils';

export interface WaitTimeSpanProps {
  card: Pick<VisitCard, 'wait_minutes' | 'wait_label' | 'visit_date'>;
  suffix?: string;
}

const SEVERITY_CLASS = {
  long: 'font-bold !text-[#dc2626]',
  medium: 'font-bold !text-[#d97706]',
} as const;

export function WaitTimeSpan({ card, suffix = '' }: WaitTimeSpanProps) {
  const label = card.wait_label || formatWaitLabel(card.wait_minutes);
  const text = `${label}${suffix}`;
  const severity = waitSeverity(card.wait_minutes, card.visit_date);

  if (severity === 'long' || severity === 'medium') {
    return (
      <span className={cn(SEVERITY_CLASS[severity])} data-wait-severity={severity}>
        {text}
      </span>
    );
  }
  return <>{text}</>;
}
