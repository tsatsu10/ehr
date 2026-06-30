import { describe, expect, it } from 'vitest';
import { stockBadgeClass, stockLabel } from './pharmOpsStockUtils';

describe('pharmOpsStockUtils', () => {
  it('maps stock status to labels', () => {
    expect(stockLabel('in_stock')).toBe('In stock');
    expect(stockLabel('low')).toBe('Low stock');
    expect(stockLabel('out_of_stock')).toBe('Out of stock');
    expect(stockLabel('unknown')).toBeNull();
  });

  it('maps stock status to badge classes', () => {
    expect(stockBadgeClass('in_stock')).toBe('badge-success');
    expect(stockBadgeClass('low')).toBe('badge-warning');
    expect(stockBadgeClass('out_of_stock')).toBe('badge-danger');
  });
});
