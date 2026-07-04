import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

interface TrendPillProps {
  /** Signed percentage change vs prior period. */
  value: number;
  /** Override screen-reader label (defaults to generated text). */
  ariaLabel?: string;
}

function direction(value: number): 'up' | 'down' | 'flat' {
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
}

const VARIANT_BY_DIRECTION = {
  up: 'success',
  down: 'danger',
  flat: 'neutral',
} as const;

export function TrendPill({ value, ariaLabel }: TrendPillProps) {
  const dir = direction(value);
  const abs = Math.abs(value);
  const icon = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';
  const label =
    ariaLabel ??
    (dir === 'flat' ? 'No change vs last period' : `${dir === 'up' ? 'Up' : 'Down'} ${abs}% vs last period`);

  return (
    <Badge
      variant={VARIANT_BY_DIRECTION[dir]}
      className={cn('oe-nc-trend-pill', `oe-nc-trend-pill--${dir}`)}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">{icon}</span>
      <span aria-hidden="true">{abs}%</span>
    </Badge>
  );
}
