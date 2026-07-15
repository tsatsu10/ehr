import { describe, expect, it } from 'vitest';
import { reorderToCsv } from './pharmOpsReorderExport';
import type { PharmReorderRow } from './pharmOpsTypes';

function row(over: Partial<PharmReorderRow> = {}): PharmReorderRow {
  return {
    drug_id: 1,
    drug_name: 'Amoxicillin 500 mg',
    on_hand: 5,
    reorder_point: 50,
    sold_qty: 40,
    avg_per_day: 0.5,
    days_of_supply: 10,
    suggested_order_qty: 20,
    stock_status: 'low',
    status_label: 'Low stock',
    unit_cost: 3,
    estimated_cost: 60,
    ...over,
  };
}

describe('reorderToCsv', () => {
  it('uses the suggested quantity when no edit was made, and computes estimated cost', () => {
    const csv = reorderToCsv([row()], {}, 'GH₵');
    expect(csv).toContain('Amoxicillin 500 mg,5,50,10,20,3,60,Low stock');
    expect(csv).toContain('Estimated total,GH₵60.00');
  });

  it('uses the pharmacist-edited quantity over the suggested one', () => {
    const csv = reorderToCsv([row()], { 1: 30 }, 'GH₵');
    expect(csv).toContain('Amoxicillin 500 mg,5,50,10,30,3,90,Low stock');
    expect(csv).toContain('Estimated total,GH₵90.00');
  });

  it('flags the total as partial when a unit cost is unknown, and escapes drug names', () => {
    const csv = reorderToCsv(
      [row({ drug_id: 2, drug_name: '=SUM(A1)', unit_cost: null, estimated_cost: null })],
      {},
      'GH₵',
    );
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain('Estimated total (partial — some costs unknown),GH₵0.00');
  });
});
