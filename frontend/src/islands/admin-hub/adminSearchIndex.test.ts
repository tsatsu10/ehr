import { describe, expect, it } from 'vitest';
import {
  ADMIN_DESTINATION_SEARCH_INDEX,
  ADMIN_FIELD_SEARCH_INDEX,
  searchAdminDestinations,
  searchAdminFields,
} from './adminSearchIndex';

describe('adminSearchIndex', () => {
  it('indexes fields from every field-def-driven destination', () => {
    const tabs = new Set(ADMIN_FIELD_SEARCH_INDEX.map((e) => e.tab));
    expect(tabs).toEqual(new Set(['queue-desks', 'features', 'clinic', 'completion']));
    expect(ADMIN_FIELD_SEARCH_INDEX.length).toBeGreaterThan(50);
  });

  it('finds a field by a substring of its label, case-insensitively', () => {
    const results = searchAdminFields('triage desk');
    expect(results.some((r) => r.fieldKey === 'enable_triage')).toBe(true);
  });

  it('finds a field that moved to Features by the ADM-3 split', () => {
    const results = searchAdminFields('billing back office hub');
    expect(results.some((r) => r.tab === 'features' && r.fieldKey === 'enable_bill_ops')).toBe(true);
  });

  it('matches on hint text, not just the label', () => {
    const needle = 'lets doctors order a lab panel';
    const hit = ADMIN_FIELD_SEARCH_INDEX.find((e) => e.hint?.toLowerCase().includes(needle));
    expect(hit).toBeDefined();
    const results = searchAdminFields(needle.slice(0, 15));
    expect(results.some((r) => r.fieldKey === hit!.fieldKey)).toBe(true);
  });

  it('returns nothing for an empty or whitespace-only query', () => {
    expect(searchAdminFields('')).toEqual([]);
    expect(searchAdminFields('   ')).toEqual([]);
  });

  it('caps results at 20', () => {
    const results = searchAdminFields('e'); // matches almost everything
    expect(results.length).toBeLessThanOrEqual(20);
  });

  it('finds a destination by its label', () => {
    const results = searchAdminDestinations('fees');
    expect(results.some((r) => r.tab === 'fees')).toBe(true);
  });

  it('finds a destination by a keyword not in its label', () => {
    const results = searchAdminDestinations('backup');
    expect(results.some((r) => r.tab === 'system')).toBe(true);
  });

  it('covers every non-field-def destination exactly once', () => {
    const tabs = ADMIN_DESTINATION_SEARCH_INDEX.map((e) => e.tab);
    expect(new Set(tabs).size).toBe(tabs.length);
    expect(tabs.sort()).toEqual(
      ['directory', 'fees', 'forms', 'import', 'people', 'setup', 'system', 'types'].sort()
    );
  });
});
