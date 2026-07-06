import { describe, expect, it } from 'vitest';
import { rosSystemsForVariant, visibleSectionIds } from './encounterVariants';

describe('encounterVariants HLF-5', () => {
  it('includes ros and background for general_opd', () => {
    expect(visibleSectionIds('general_opd')).toEqual([
      'cc', 'hpi', 'ros', 'background', 'vitals', 'pe', 'problems',
    ]);
  });

  it('includes data_reviewed for referral consult', () => {
    expect(visibleSectionIds('referral_consult')).toContain('data_reviewed');
    expect(visibleSectionIds('referral_consult')).toContain('ros');
  });

  it('omits ros for follow_up', () => {
    expect(visibleSectionIds('follow_up')).not.toContain('ros');
    expect(rosSystemsForVariant('follow_up')).toEqual([]);
  });
});
