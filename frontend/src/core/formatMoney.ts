export interface CurrencyFormat {
  currency_code?: string;
  currency_symbol: string;
  currency_decimals?: number;
  currency_symbol_position?: 'before' | 'after';
}

const DEFAULT_FORMAT: CurrencyFormat = {
  currency_symbol: '',
  currency_decimals: 2,
  currency_symbol_position: 'before',
};

export function formatMoney(
  amount: number | string | null | undefined,
  format: Partial<CurrencyFormat> = DEFAULT_FORMAT,
): string {
  const decimals = format.currency_decimals ?? 2;
  const formatted = Number(amount ?? 0).toFixed(decimals);
  const symbol = format.currency_symbol ?? '';

  if (!symbol) {
    return formatted;
  }

  if (format.currency_symbol_position === 'after') {
    return `${formatted} ${symbol}`;
  }

  return `${symbol} ${formatted}`;
}
