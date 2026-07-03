import { describe, it, expect } from 'vitest';
import { OeFetchError } from '@core/oeFetch';
import { ALLERGIES_UNDOCUMENTED_CODE, isAllergiesUndocumentedError } from './doctorShortcutNav';

describe('doctorShortcutNav', () => {
  it('detects allergies_undocumented API errors', () => {
    const err = new OeFetchError('Document allergies', 409, ALLERGIES_UNDOCUMENTED_CODE);
    expect(isAllergiesUndocumentedError(err)).toBe(true);
    expect(isAllergiesUndocumentedError(new Error('other'))).toBe(false);
  });
});
