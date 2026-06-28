import { describe, expect, it } from 'vitest';
import { daysheetToCsv } from './billOpsDaysheetExport';
import type { DaysheetData } from './billOpsTypes';

const sample: DaysheetData = {
  currency_symbol: 'GH₵',
  date: '2026-06-18',
  receipt_count: 47,
  void_count: 0,
  no_charge_closes: 2,
  cash_collected: 12450,
  reconciliation: { status: 'ok', delta_amount: 0, latest_run: null },
  by_cashier: [{ cashier: 'Akosua', total: 8200 }],
  by_visit_type: [{ visit_type_label: 'OPD', total: 10000 }],
};

describe('daysheetToCsv', () => {
  it('includes summary and breakdown rows', () => {
    const csv = daysheetToCsv(sample);
    expect(csv).toContain('2026-06-18');
    expect(csv).toContain('Akosua,8200');
    expect(csv).toContain('OPD,10000');
  });
});
