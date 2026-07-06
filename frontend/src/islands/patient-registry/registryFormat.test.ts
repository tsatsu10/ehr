import { describe, expect, it } from 'vitest';
import { formatRegistryDate } from './registryFormat';

describe('formatRegistryDate', () => {
  it('returns em dash for empty values', () => {
    expect(formatRegistryDate(null)).toBe('—');
    expect(formatRegistryDate('')).toBe('—');
    expect(formatRegistryDate('0000-00-00')).toBe('—');
  });

  it('formats ISO dates', () => {
    expect(formatRegistryDate('2026-03-15')).toMatch(/2026/);
    expect(formatRegistryDate('2026-03-15')).toMatch(/15/);
  });
});
