import type { BadgeProps } from '@components/ui/badge';

export function stockLabel(status?: string): string | null {
  if (!status || status === 'unknown') return null;
  if (status === 'in_stock') return 'In stock';
  if (status === 'low') return 'Low stock';
  if (status === 'out_of_stock') return 'Out of stock';
  return status.replace(/_/g, ' ');
}

export function stockBadgeVariant(status?: string): NonNullable<BadgeProps['variant']> {
  if (status === 'out_of_stock') return 'danger';
  if (status === 'low') return 'warning';
  if (status === 'in_stock') return 'success';
  return 'neutral';
}
