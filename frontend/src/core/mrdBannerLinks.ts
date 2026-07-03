/** Stable Clinical tab section IDs on patient-chart (MRD §6.3). */
export const MRD_CLINICAL_ANCHORS = {
  allergies: 'clinical-allergies',
  problems: 'clinical-problems',
  meds: 'clinical-meds',
  labs: 'clinical-labs',
  vitals: 'clinical-vitals',
  background: 'clinical-background',
} as const;

export type MrdClinicalAnchor = (typeof MRD_CLINICAL_ANCHORS)[keyof typeof MRD_CLINICAL_ANCHORS];

const DEFAULT_CHART_PATH =
  '/interface/modules/custom_modules/oe-module-new-clinic/public/patient-chart.php';

export function buildMrdClinicalDeepLink(
  pid: number,
  anchor: MrdClinicalAnchor | string,
  chartOpenUrl?: string,
): string {
  if (pid <= 0) {
    return '';
  }

  if (chartOpenUrl) {
    try {
      const url = new URL(chartOpenUrl, window.location.origin);
      url.searchParams.set('pid', String(pid));
      url.searchParams.set('tab', 'clinical');
      url.searchParams.set('anchor', anchor);
      return url.toString();
    } catch {
      // fall through to default path
    }
  }

  const params = new URLSearchParams({
    pid: String(pid),
    tab: 'clinical',
    anchor,
  });

  return `${DEFAULT_CHART_PATH}?${params.toString()}`;
}

export function openMrdClinicalDeepLink(
  pid: number,
  anchor: MrdClinicalAnchor | string,
  chartOpenUrl?: string,
): void {
  const href = buildMrdClinicalDeepLink(pid, anchor, chartOpenUrl);
  if (!href) {
    return;
  }
  window.open(href, '_blank', 'noopener,noreferrer');
}
