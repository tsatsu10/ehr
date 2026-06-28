/** Coupled Admin Hub toggles — keep PHP ClinicAdminService::applySettingDependencies in sync. */

const CHART_DEPTH_SUB_KEYS = [
  'enable_chart_depth_finance',
  'enable_chart_depth_referral',
  'enable_chart_depth_export',
] as const;

function isSettingOn(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

/** Apply dependent toggles when a single field changes in the Admin Hub form. */
export function applyAdminSettingCoupling(
  key: string,
  value: unknown,
  prev: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...prev, [key]: value };

  if (
    (CHART_DEPTH_SUB_KEYS as readonly string[]).includes(key)
    && isSettingOn(value)
  ) {
    next.enable_chart_depth = true;
  }

  if (key === 'enable_chart_depth' && !isSettingOn(value)) {
    for (const subKey of CHART_DEPTH_SUB_KEYS) {
      next[subKey] = false;
    }
  }

  return next;
}
