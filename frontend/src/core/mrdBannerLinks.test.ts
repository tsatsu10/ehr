import { describe, it, expect } from 'vitest';
import { buildMrdClinicalDeepLink, MRD_CLINICAL_ANCHORS } from './mrdBannerLinks';

describe('mrdBannerLinks', () => {
  it('builds clinical deep link with tab and anchor', () => {
    const url = buildMrdClinicalDeepLink(42, MRD_CLINICAL_ANCHORS.allergies);
    expect(url).toContain('pid=42');
    expect(url).toContain('tab=clinical');
    expect(url).toContain(`anchor=${MRD_CLINICAL_ANCHORS.allergies}`);
  });

  it('uses chart_open_url as base when provided', () => {
    const url = buildMrdClinicalDeepLink(
      7,
      MRD_CLINICAL_ANCHORS.labs,
      'http://localhost/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/patient-chart.php?pid=7',
    );
    expect(url).toContain('pid=7');
    expect(url).toContain('anchor=clinical-labs');
  });

  it('returns empty href for invalid pid', () => {
    expect(buildMrdClinicalDeepLink(0, MRD_CLINICAL_ANCHORS.vitals)).toBe('');
  });
});
