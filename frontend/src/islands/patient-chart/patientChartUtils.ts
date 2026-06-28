export function completionVariant(score: number, threshold = 70): 'success' | 'warn' | 'danger' {
  if (score >= threshold) return 'success';
  if (score >= threshold - 15) return 'warn';
  return 'danger';
}

export function formatStateLabel(state?: string): string {
  if (!state) return '—';
  return state.replace(/_/g, ' ');
}

export function initialsFromName(name?: string): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function isValidChartTab(tab: string): tab is import('./patientChartTypes').ChartTabId {
  return ['overview', 'profile', 'visits', 'clinical', 'messages'].includes(tab);
}
