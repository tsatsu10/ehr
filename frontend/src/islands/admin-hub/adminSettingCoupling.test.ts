import { describe, expect, it } from 'vitest';
import { applyAdminSettingCoupling } from './adminSettingCoupling';

describe('applyAdminSettingCoupling', () => {
  it('turns on chart depth master when a sub-flag is enabled', () => {
    const next = applyAdminSettingCoupling(
      'enable_chart_depth_finance',
      true,
      { enable_chart_depth: false, enable_chart_depth_finance: false },
    );
    expect(next.enable_chart_depth).toBe(true);
    expect(next.enable_chart_depth_finance).toBe(true);
  });

  it('turns off chart depth sub-flags when master is disabled', () => {
    const next = applyAdminSettingCoupling(
      'enable_chart_depth',
      false,
      {
        enable_chart_depth: true,
        enable_chart_depth_finance: true,
        enable_chart_depth_referral: true,
        enable_chart_depth_export: true,
      },
    );
    expect(next.enable_chart_depth).toBe(false);
    expect(next.enable_chart_depth_finance).toBe(false);
    expect(next.enable_chart_depth_referral).toBe(false);
    expect(next.enable_chart_depth_export).toBe(false);
  });
});
