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

describe('clinical-doc visit tab types', () => {
  it('accepts sign overview payload shape', () => {
    const overview = {
      encounter_signed: false,
      started_count: 2,
      signed_count: 1,
      unsigned_count: 1,
      required_forms: [{ formdir: 'soap', title: 'Consult note', started: true }],
    };
    expect(overview.required_forms[0]?.title).toBe('Consult note');
  });
});
