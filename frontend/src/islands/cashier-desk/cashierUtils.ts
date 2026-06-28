import type { CashierChargeLine, CashierDiscountLine, CashierFeeScheduleItem, CashierStagedLine } from '@core/types';

export function formatMoney(amount: number | null | undefined): string {
  return Number(amount ?? 0).toFixed(2);
}

export function newClientRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pay-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function buildStagedFromSuggestions(
  suggested: CashierFeeScheduleItem[],
  charges: CashierChargeLine[],
): CashierStagedLine[] {
  const postedCodes = new Set(charges.map((line) => line.code));
  return suggested
    .filter((fee) => !postedCodes.has(fee.billing_code ?? fee.code))
    .map((fee) => ({
      fee_schedule_id: fee.id,
      code: fee.code,
      name: fee.name,
      units: 1,
      unit_price: fee.price_amount,
      suggested: true,
    }));
}

export function stagedLinesHaveDiscount(
  staged: CashierStagedLine[],
  feeSchedule: CashierFeeScheduleItem[],
  allowDiscount: boolean,
): boolean {
  if (!allowDiscount) return false;

  const fees = new Map(feeSchedule.map((fee) => [fee.id, fee]));
  return staged.some((line) => {
    const fee = fees.get(line.fee_schedule_id);
    if (!fee) return false;
    return line.unit_price + 0.001 < fee.price_amount;
  });
}

export function getDiscountLines(
  staged: CashierStagedLine[],
  feeSchedule: CashierFeeScheduleItem[],
): CashierDiscountLine[] {
  const fees = new Map(feeSchedule.map((fee) => [fee.id, fee]));
  return staged
    .map((line) => {
      const fee = fees.get(line.fee_schedule_id);
      const standard = fee?.price_amount ?? line.unit_price;
      const discount = standard - line.unit_price;
      if (discount <= 0.001) return null;
      return {
        name: line.name || fee?.name || 'Fee',
        standard,
        posted: line.unit_price,
        discount,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}
