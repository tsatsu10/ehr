import { describe, expect, it } from 'vitest';
import { stockBadgeVariant, stockLabel } from './pharmOpsStockUtils';

describe('pharmOpsStockUtils', () => {
  it('maps stock status to labels', () => {
    expect(stockLabel('in_stock')).toBe('In stock');
    expect(stockLabel('low')).toBe('Low stock');
    expect(stockLabel('out_of_stock')).toBe('Out of stock');
    expect(stockLabel('unknown')).toBeNull();
  });

  it('maps stock status to badge variants', () => {
    expect(stockBadgeVariant('in_stock')).toBe('success');
    expect(stockBadgeVariant('low')).toBe('warning');
    expect(stockBadgeVariant('out_of_stock')).toBe('danger');
  });
});
