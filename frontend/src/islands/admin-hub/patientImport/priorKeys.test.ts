import { describe, expect, it } from 'vitest';
import { emptyAcceptedKeys, hasAcceptedKeys, mergeAcceptedKeys } from './priorKeys';

describe('priorKeys accumulation', () => {
  it('starts empty', () => {
    expect(emptyAcceptedKeys()).toEqual({ name_dob: [], name_phone: [], national_id: [] });
    expect(hasAcceptedKeys(emptyAcceptedKeys())).toBe(false);
  });

  it('merges a chunk response into the running total', () => {
    const merged = mergeAcceptedKeys(emptyAcceptedKeys(), {
      name_dob: ['ama|mensah|1988-03-12'],
      name_phone: [],
      national_id: ['GHA-1'],
    });
    expect(merged).toEqual({ name_dob: ['ama|mensah|1988-03-12'], name_phone: [], national_id: ['GHA-1'] });
    expect(hasAcceptedKeys(merged)).toBe(true);
  });

  it('accumulates across multiple chunks without dropping earlier keys', () => {
    let running = emptyAcceptedKeys();
    running = mergeAcceptedKeys(running, { name_dob: ['a'], name_phone: [], national_id: [] });
    running = mergeAcceptedKeys(running, { name_dob: ['b'], name_phone: ['c'], national_id: [] });
    expect(running).toEqual({ name_dob: ['a', 'b'], name_phone: ['c'], national_id: [] });
  });

  it('is a no-op when the incoming response has no accepted_keys', () => {
    const running = mergeAcceptedKeys({ name_dob: ['a'], name_phone: [], national_id: [] }, undefined);
    expect(running).toEqual({ name_dob: ['a'], name_phone: [], national_id: [] });
  });
});
