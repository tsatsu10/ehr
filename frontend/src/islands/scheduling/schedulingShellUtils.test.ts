import { describe, expect, it } from 'vitest';
import {
  buildSchedulingLensUrl,
  calendarUrlForDate,
  recallsUrlForPatient,
} from './schedulingShellUtils';

describe('schedulingShellUtils', () => {
  const moduleUrl = '/openemr/interface/modules/custom_modules/oe-module-new-clinic/public';

  it('builds recalls lens url with patient filter', () => {
    const url = recallsUrlForPatient(moduleUrl, {
      facilityId: 3,
      providerId: 0,
      date: '2026-07-01',
    }, 42);

    expect(url).toContain('lens=recalls');
    expect(url).toContain('pid=42');
    expect(url).toContain('date=2026-07-01');
    expect(url).toContain('facility_id=3');
  });

  it('builds calendar url for produced appointment date', () => {
    const url = calendarUrlForDate(moduleUrl, {
      facilityId: 3,
      providerId: 10,
      date: '2026-07-01',
    }, '2026-07-15');

    expect(url).toContain('lens=calendar');
    expect(url).toContain('date=2026-07-15');
    expect(url).toContain('provider_id=10');
  });

  it('omits provider when all providers selected', () => {
    const url = buildSchedulingLensUrl(moduleUrl, 'flow', {
      date: '2026-07-01',
      facilityId: 3,
      providerId: 0,
    });

    expect(url).not.toContain('provider_id=');
  });
});
