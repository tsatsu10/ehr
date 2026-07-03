import { describe, it, expect } from 'vitest';
import { buildAllergyChips } from './patientBannerUtils';
import { MRD_CLINICAL_ANCHORS } from '@core/mrdBannerLinks';

describe('buildAllergyChips', () => {
  it('adds MRD deep links when enabled', () => {
    const chips = buildAllergyChips(
      { allergies_severe: ['Penicillin'] },
      {
        mrdDeepLinks: true,
        pid: 42,
        chartOpenUrl: 'http://localhost/chart?pid=42',
      },
    );

    expect(chips).toHaveLength(1);
    expect(chips[0].href).toContain(`anchor=${MRD_CLINICAL_ANCHORS.allergies}`);
    expect(chips[0].href).toContain('pid=42');
  });

  it('shows allergy count chip when configured and count exceeds three', () => {
    const chips = buildAllergyChips(
      {
        allergies_severe: ['A', 'B', 'C', 'D', 'E'],
        allergy_count: 5,
      },
      {
        showAllergyCountChip: true,
        mrdDeepLinks: true,
        pid: 7,
      },
    );

    expect(chips).toHaveLength(1);
    expect(chips[0].label).toBe('5 allergies');
  });

  it('shows problem count chip with problems anchor', () => {
    const chips = buildAllergyChips(
      { allergies_severe: [], problem_count: 2 },
      { mrdDeepLinks: true, pid: 9 },
    );

    expect(chips.some((chip) => chip.label === '2 problems')).toBe(true);
    expect(chips.find((chip) => chip.label === '2 problems')?.href).toContain(
      `anchor=${MRD_CLINICAL_ANCHORS.problems}`,
    );
  });
});
