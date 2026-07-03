import { describe, expect, it } from 'vitest';
import { formatFefoLotLabel } from './pharmOpsLotUtils';

describe('formatFefoLotLabel', () => {
  it('returns null when lot number missing', () => {
    expect(formatFefoLotLabel({ lot_number: '' })).toBeNull();
  });

  it('formats lot expiration and warehouse', () => {
    expect(formatFefoLotLabel({
      lot_number: 'A1',
      expiration: '2026-12-01',
      warehouse: 'Main',
    })).toBe('Lot A1 · exp 2026-12-01 · Main');
  });
});
