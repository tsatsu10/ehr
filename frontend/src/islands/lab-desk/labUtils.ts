import type { BadgeProps } from '@components/ui/badge';

export function orderStatusBadgeVariant(status: string): NonNullable<BadgeProps['variant']> {
  const s = status.toLowerCase();
  if (s === 'complete') return 'success';
  if (s === 'routed' || s === 'in_progress') return 'info';
  if (s === 'canceled' || s === 'cancelled') return 'neutral';
  return 'outline';
}
