import { deskCalloutClass } from '@components/deskCalloutStyles';

interface QueueTruncationBannerProps {
  /** True when the desk/board query hit its row cap and some rows were withheld. */
  truncated?: boolean;
  /** The row cap that was hit (for the message). */
  cap?: number;
  className?: string;
}

/**
 * SCALE-1.2 — non-blocking notice shown when a queue/board list hit its hard row
 * cap. A single cash-clinic facility never has this many *active* visits at once,
 * so this is a safety valve that should essentially never appear in normal use —
 * but when it does, staff see it instead of silently missing patients.
 */
export function QueueTruncationBanner({ truncated, cap, className }: QueueTruncationBannerProps) {
  if (!truncated) {
    return null;
  }

  return (
    <div className={deskCalloutClass('warn', className)} role="status">
      Showing the first {cap ?? 200} — refine your filters or date to see the rest.
    </div>
  );
}
