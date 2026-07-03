import { describe, expect, it } from 'vitest';
import { DEFAULT_REGISTRY_FILTERS } from './registryDefaults';
import { applyPresetToFilters, filtersToApiPayload } from './registryFilterUtils';

describe('registryFilterUtils PR-4', () => {
  it('maps allergy, medication, and communications filters to API payload', () => {
    const payload = filtersToApiPayload({
      ...DEFAULT_REGISTRY_FILTERS,
      visit_states: [],
      allergy_substance_contains: 'penicillin',
      medication_contains: 'amoxicillin',
      unread_staff_message: 'yes',
      open_dated_reminder: 'no',
    });

    expect(payload.allergy_substance_contains).toBe('penicillin');
    expect(payload.medication_contains).toBe('amoxicillin');
    expect(payload.unread_staff_message).toBe('yes');
    expect(payload.open_dated_reminder).toBe('no');
  });

  it('applies PR-4 preset fields to form state', () => {
    const filters = applyPresetToFilters({
      allergy_substance_contains: 'latex',
      medication_contains: 'metformin',
      unread_staff_message: 'yes',
      open_dated_reminder: 'yes',
    });

    expect(filters.allergy_substance_contains).toBe('latex');
    expect(filters.medication_contains).toBe('metformin');
    expect(filters.unread_staff_message).toBe('yes');
    expect(filters.open_dated_reminder).toBe('yes');
  });
});
