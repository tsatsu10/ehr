/** Format ISO date strings for registry table cells. */
export function formatRegistryDate(value: string | null | undefined): string {
  if (!value || value === '0000-00-00') return '—';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
