import type { CurrencyFormat } from '@core/formatMoney';
import { formatMoney as formatMoneyCore } from '@core/formatMoney';

let currencyFormat: CurrencyFormat = {
  currency_symbol: '',
  currency_decimals: 2,
  currency_symbol_position: 'before',
};

export function setChartDepthCurrencyFormat(format: CurrencyFormat): void {
  currencyFormat = format;
}

export function formatChartMoney(amount: number | null | undefined): string {
  return formatMoneyCore(amount, currencyFormat);
}
