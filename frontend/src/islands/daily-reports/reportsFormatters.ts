import type { CurrencyFormat } from '@core/formatMoney';
import { formatMoney as formatMoneyCore } from '@core/formatMoney';

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

let reportCurrencyFormat: CurrencyFormat = {
  currency_symbol: 'GH₵',
  currency_decimals: 2,
  currency_symbol_position: 'before',
};

export function setReportCurrencyFormat(format: CurrencyFormat): void {
  reportCurrencyFormat = format;
}

export function formatMoney(amount: number | string | null | undefined): string {
  return formatMoneyCore(amount, reportCurrencyFormat);
}

export function formatWaitMinutes(minutes: number | string | null | undefined): string {
  const total = Number.parseInt(String(minutes ?? 0), 10) || 0;
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}
