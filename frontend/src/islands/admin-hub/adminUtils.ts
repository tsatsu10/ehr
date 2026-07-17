import { formatMoney, type CurrencyFormat } from '@core/formatMoney';

export function profileLabel(profile: string): string {
  if (profile === 'lab_direct') return 'Lab direct';
  if (profile === 'pharmacy_walkin') return 'Pharmacy walk-in';
  return 'Full OPD';
}

export function formatPrice(
  amount: number | string | null | undefined,
  settings: Record<string, unknown>
): string {
  const format: CurrencyFormat = {
    currency_symbol: String(settings.currency_symbol ?? ''),
    currency_decimals: settings.currency_decimals !== undefined
      ? Number(settings.currency_decimals)
      : 2,
    currency_symbol_position: settings.currency_symbol_position === 'after' ? 'after' : 'before',
  };

  return formatMoney(amount, format);
}

export function initialAdminTab(): string {
  const fromUrl = new URL(window.location.href).searchParams.get('tab');
  if (fromUrl === 'roles') {
    return 'people';
  }
  return fromUrl ?? 'queue';
}

export function localDateString(date = new Date()): string {
  return date.toLocaleDateString('en-CA');
}
