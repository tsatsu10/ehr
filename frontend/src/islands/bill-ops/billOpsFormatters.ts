import type { CurrencyFormat } from '@core/formatMoney';
import { formatMoney as formatMoneyCore } from '@core/formatMoney';

let currencyFormat: CurrencyFormat = {
  currency_symbol: 'GH₵',
  currency_decimals: 2,
  currency_symbol_position: 'before',
};

export function setBillOpsCurrencyFormat(format: CurrencyFormat): void {
  currencyFormat = format;
}

export function formatBillMoney(amount: number | null | undefined): string {
  return formatMoneyCore(amount, currencyFormat);
}

export function localDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
