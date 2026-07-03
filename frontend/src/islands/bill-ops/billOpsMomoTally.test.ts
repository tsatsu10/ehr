import { describe, expect, it } from 'vitest';
import { momoTallyStorageKey, readMomoTally, writeMomoTally } from './billOpsMomoTally';

describe('billOpsMomoTally', () => {
  it('reads and writes tally by facility and date', () => {
    const key = momoTallyStorageKey(2, '2026-06-18');
    localStorage.removeItem(key);

    writeMomoTally(2, '2026-06-18', '1500');
    expect(readMomoTally(2, '2026-06-18')).toBe('1500');

    writeMomoTally(2, '2026-06-18', '');
    expect(readMomoTally(2, '2026-06-18')).toBe('');
  });
});
