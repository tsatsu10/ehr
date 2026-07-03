import { describe, expect, it } from 'vitest';
import { formatMoney } from './formatMoney';

describe('formatMoney', () => {
  it('places symbol before amount with a space', () => {
    expect(formatMoney(160, {
      currency_symbol: 'GH₵',
      currency_decimals: 2,
      currency_symbol_position: 'before',
    })).toBe('GH₵ 160.00');
  });

  it('places symbol after amount when configured', () => {
    expect(formatMoney(50, {
      currency_symbol: '₦',
      currency_decimals: 2,
      currency_symbol_position: 'after',
    })).toBe('50.00 ₦');
  });

  it('returns numeric string when symbol is empty', () => {
    expect(formatMoney(12.5, { currency_symbol: '', currency_decimals: 2 })).toBe('12.50');
  });
});
