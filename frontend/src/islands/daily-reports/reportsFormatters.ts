export function localDateString(date = new Date()): string {
  return date.toLocaleDateString('en-CA');
}

export function initialVisitDate(): string {
  const fromUrl = new URL(window.location.href).searchParams.get('date');
  if (fromUrl && /^\d{4}-\d{2}-\d{2}$/.test(fromUrl)) return fromUrl;
  return localDateString();
}

export function initialReportTab(): string {
  const fromUrl = new URL(window.location.href).searchParams.get('tab');
  return fromUrl ?? 'visits';
}

export function formatMoney(amount: number | string | null | undefined): string {
  return Number(amount ?? 0).toFixed(2);
}

export function formatWaitMinutes(minutes: number | string | null | undefined): string {
  const total = Number.parseInt(String(minutes ?? 0), 10) || 0;
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}
