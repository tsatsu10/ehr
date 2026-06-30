import { describe, expect, it } from 'vitest';
import { allowedLenses, firstAllowedLens } from './useClinicalDocPageHeading';

describe('clinical-doc page heading', () => {
  it('builds allowed lens tabs from props', () => {
    const tabs = allowedLenses({
      canVisit: true,
      canConsult: true,
      canScreening: false,
      canNursing: false,
      canOrders: true,
      canSpecialty: false,
    });
    expect(tabs).toEqual(['visit', 'consult', 'orders']);
  });

  it('falls back when initial tab is not allowed', () => {
    expect(firstAllowedLens('specialty', ['visit', 'consult'])).toBe('visit');
  });
});
