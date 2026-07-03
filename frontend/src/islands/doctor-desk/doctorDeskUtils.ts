import type { CurrencyFormat } from '@core/formatMoney';
import { formatMoney as formatMoneyCore } from '@core/formatMoney';
import type { DoctorConsultPayload } from '@core/types';

let currencyFormat: CurrencyFormat = {
  currency_symbol: '',
  currency_decimals: 2,
  currency_symbol_position: 'before',
};

export function setDoctorDeskCurrencyFormat(format: CurrencyFormat): void {
  currencyFormat = format;
}

export function formatDoctorMoney(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '';
  return formatMoneyCore(amount, currencyFormat);
}

export type DoctorDeskNotice = {
  message: string;
  variant: 'info' | 'success' | 'warning' | 'danger';
};

/** Notice after returning from core prescribe shortcut (pageshow). */
export function rxReturnNotice(payload: DoctorConsultPayload): DoctorDeskNotice | null {
  if (!payload.pharm_ops_enabled) {
    return null;
  }

  const count = payload.prescriptions?.length ?? 0;
  if (count === 0) {
    return {
      message: 'No prescriptions on this encounter yet. Use Prescribe to add medication.',
      variant: 'info',
    };
  }

  return {
    message: count === 1
      ? 'Prescription list updated — 1 line with current stock badges.'
      : `Prescription list updated — ${count} lines with current stock badges.`,
    variant: 'success',
  };
}
