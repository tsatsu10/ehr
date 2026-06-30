export function stockLabel(status?: string): string | null {
  if (!status || status === 'unknown') return null;
  if (status === 'in_stock') return 'In stock';
  if (status === 'low') return 'Low stock';
  if (status === 'out_of_stock') return 'Out of stock';
  return status.replace(/_/g, ' ');
}

export function stockBadgeClass(status?: string): string {
  if (status === 'out_of_stock') return 'badge-danger';
  if (status === 'low') return 'badge-warning';
  if (status === 'in_stock') return 'badge-success';
  return 'badge-secondary';
}
