export function orderStatusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'complete') return 'badge-success';
  if (s === 'routed' || s === 'in_progress') return 'badge-info';
  if (s === 'canceled' || s === 'cancelled') return 'badge-secondary';
  return 'badge-light border';
}
