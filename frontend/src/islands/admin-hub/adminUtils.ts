import type { CalendarCategory } from './adminTypes';

export function profileLabel(profile: string): string {
  if (profile === 'lab_direct') return 'Lab direct';
  if (profile === 'pharmacy_walkin') return 'Pharmacy walk-in';
  return 'Full OPD';
}

export function categoryLabel(
  pcCatid: number | string,
  calendarCategories: CalendarCategory[]
): string {
  const id = Number.parseInt(String(pcCatid), 10);
  const match = calendarCategories.find(
    (row) => Number.parseInt(String(row.pc_catid), 10) === id
  );
  if (!match) return String(pcCatid || '—');
  return `${match.name} (${match.pc_catid})`;
}

export function formatPrice(
  amount: number | string | null | undefined,
  settings: Record<string, unknown>
): string {
  const symbol = String(settings.currency_symbol ?? '');
  const decimals = settings.currency_decimals !== undefined
    ? Number(settings.currency_decimals)
    : 2;
  const formatted = Number(amount ?? 0).toFixed(decimals);
  return symbol ? `${symbol} ${formatted}` : formatted;
}

export function initialAdminTab(): string {
  const fromUrl = new URL(window.location.href).searchParams.get('tab');
  return fromUrl ?? 'queue';
}

export function localDateString(date = new Date()): string {
  return date.toLocaleDateString('en-CA');
}
