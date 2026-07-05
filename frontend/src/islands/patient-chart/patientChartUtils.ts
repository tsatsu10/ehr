import { completionVariant as completionVariantPill } from '@components/patientBannerUtils';

export function completionVariant(score: number, threshold = 70): 'success' | 'warn' | 'danger' {
  const variant = completionVariantPill(score, threshold);
  if (variant === 'warning') return 'warn';
  if (variant === 'success' || variant === 'danger') return variant;
  return 'warn';
}

export function formatStateLabel(state?: string): string {
  if (!state) return '—';
  return state.replace(/_/g, ' ');
}

export {
  initialsFromName,
  completionBadgeVariant,
} from '@components/patientBannerUtils';

export function isValidChartTab(tab: string): tab is import('./patientChartTypes').ChartTabId {
  return ['overview', 'profile', 'visits', 'clinical', 'messages'].includes(tab);
}
