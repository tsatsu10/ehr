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

  it('couples doctor ready notify flags', () => {
    const on = applyAdminSettingCoupling(
      'enable_doctor_ready_web_push',
      true,
      { enable_doctor_ready_notify: false },
    );
    expect(on.enable_doctor_ready_notify).toBe(true);

    const off = applyAdminSettingCoupling(
      'enable_doctor_ready_notify',
      false,
      {
        enable_doctor_ready_notify: true,
        notify_unassigned_to_all_on_duty: true,
        enable_doctor_ready_web_push: true,
      },
    );
    expect(off.notify_unassigned_to_all_on_duty).toBe(false);
    expect(off.enable_doctor_ready_web_push).toBe(false);
  });
});
